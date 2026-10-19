#!/usr/bin/env node
// tokens.json（案件のデザイントークンの正）から、次を生成する。
//   <outDir>/figma-tokens.json  Figma の Token Import プラグインで読み込む DTCG 形式
//   <outDir>/preview.html       色と文字を目で確認する一覧ページ
//   tokens.json の css.out      アプリが読み込む CSS（Tailwind v4 の :root / @theme）。css がなければ作らない
// 生成の前に、参照の整合性とコントラスト比を検証する。問題があれば終了コード 1。
// 実行したディレクトリに prettier があれば、生成物をその設定で整形してから書き出す。
//
// 使い方: node build.mjs <tokens.json> [outDir=<tokens.json の隣の dist>] [--check]
//   --check  書き出さずに、生成結果と既存のファイルを比べる。違えば終了コード 1（コミット前のチェック用）
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const check = args.includes('--check');
// lint-staged はファイル名を後ろに付けて呼ぶので、拡張子の付いた位置引数は outDir として扱わない
const [tokensPath, outArg] = args.filter((a) => !a.startsWith('--'));
if (!tokensPath) {
  console.error('使い方: node build.mjs <tokens.json> [outDir] [--check]');
  process.exit(2);
}
const T = JSON.parse(readFileSync(tokensPath, 'utf8'));
const outDir = resolve(outArg && !/\.[a-z0-9]+$/i.test(outArg) ? outArg : join(dirname(tokensPath), 'dist'));
const C = T.color;
const TY = T.typography;
const COL = { typography: 'Typography', primitive: 'PrimitiveColor', alias: 'AliasColor', semantic: 'SemanticColor', ...T.collections };

// ---- 色の解決 ----
const primitiveHex = (name) => {
  if (name in C.singles) return C.singles[name];
  const [fam, step] = name.split('/');
  const values = C.primitives[fam]?.values;
  const i = C.steps.indexOf(step);
  return values && i >= 0 ? values[i] : undefined;
};
const hex = (ref) => primitiveHex(C.aliases[ref] ?? ref);

const lum = (h) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// ---- 検証 ----
const errors = [];
const warnings = [];
for (const [fam, { values }] of Object.entries(C.primitives)) {
  if (values.length !== C.steps.length) errors.push(`プリミティブ ${fam} の段階数が steps（${C.steps.length}）と違う: ${values.length}`);
}
for (const [alias, prim] of Object.entries(C.aliases)) {
  if (!primitiveHex(prim)) errors.push(`エイリアス ${alias} の参照先プリミティブがない: ${prim}`);
}
const rows = Object.entries(C.semantic).flatMap(([kind, list]) => list.map((r) => ({ kind, ...r })));
const contrast = [];
for (const r of rows) {
  // 用途別は必ずエイリアスを参照する（プリミティブを直接指さない）
  if (!(r.ref in C.aliases)) errors.push(`${r.token} がエイリアス以外を参照している: ${r.ref}`);
  if (r.on && !(r.on in C.aliases)) errors.push(`${r.token} のコントラストの相手がエイリアスではない: ${r.on}`);
  if (r.on && hex(r.ref) && hex(r.on)) {
    const v = ratio(hex(r.ref), hex(r.on));
    const ok = r.min == null ? null : v >= r.min;
    contrast.push({ ...r, value: v, ok });
    if (ok === false) errors.push(`コントラスト不足 ${r.token}（${hex(r.ref)}）/ ${r.on}（${hex(r.on)}）: ${v.toFixed(2)} < ${r.min}`);
  }
}
const usedAliases = new Set(rows.flatMap((r) => [r.ref, r.on].filter(Boolean)));
for (const a of Object.keys(C.aliases)) {
  if (!usedAliases.has(a) && !(C.aliasNotes ?? {})[a]) warnings.push(`用途別から使われていないエイリアス: ${a}（直接使うならメモを aliasNotes に書く）`);
}
for (const [name, s] of Object.entries(TY.styles)) {
  const size = TY.fontSize[s.size];
  if (size == null) errors.push(`テキストスタイル ${name} の size がない: ${s.size}`);
  if (TY.fontWeight[s.weight] == null) errors.push(`テキストスタイル ${name} の weight がない: ${s.weight}`);
  if (s.fontFamily && TY.fontFamily[s.fontFamily] == null) errors.push(`テキストスタイル ${name} の fontFamily がない: ${s.fontFamily}`);
  // 行の高さ（文字サイズ × 倍率）が 4 の倍数か。倍率は小数第2位までなので ±0.1px は許容
  const h = size * s.lineHeight;
  if (Math.abs(h - Math.round(h / 4) * 4) > 0.1) warnings.push(`${name}: 行の高さ ${h.toFixed(2)}px が4の倍数ではない`);
}

// OpenType 機能（palt など）。Figma の Plugin API は書き込めないので Figma 用 JSON には出さず、
// 一覧ページの見本に当てて、Figma では手作業で設定するよう案内する
const featureSettings = (s) =>
  (s.openTypeFeatures ?? []).length ? s.openTypeFeatures.map((f) => `"${f}"`).join(', ') : '';
const manualFeatures = Object.entries(TY.styles)
  .filter(([, s]) => (s.openTypeFeatures ?? []).length)
  .map(([name, s]) => `${name}: ${s.openTypeFeatures.join(', ')}`);

// ---- DTCG（Figma 用） ----
const set = (root, path, leaf) => {
  let node = root;
  path.slice(0, -1).forEach((k) => {
    node = node[k] ??= {};
  });
  node[path.at(-1)] = leaf;
};
const refOf = (collection, name) => `{${collection}.${name.split('/').join('.')}}`;

// プリミティブは scopes を空にして Figma の色の候補に出さない。
// resolvedType を付けると、既存のバリアブルを更新するときも scopes が反映される
const primitive = (h) => ({ $type: 'color', $value: h, $extensions: { 'com.figma': { resolvedType: 'COLOR', scopes: [] } } });
const Primitives = Object.fromEntries(Object.entries(C.singles).map(([n, h]) => [n, primitive(h)]));
for (const [fam, { values }] of Object.entries(C.primitives)) values.forEach((h, i) => set(Primitives, [fam, C.steps[i]], primitive(h)));

const Alias = {};
for (const [name, prim] of Object.entries(C.aliases)) set(Alias, name.split('/'), { $type: 'color', $value: refOf(COL.primitive, prim) });

const Semantic = {};
for (const r of rows) {
  set(Semantic, r.token.split('/'), {
    $type: 'color',
    $value: refOf(COL.alias, r.ref),
    $description: r.use,
    $extensions: { 'com.figma': { resolvedType: 'COLOR', scopes: (C.scopeOverrides ?? {})[r.token] ?? C.scopes[r.kind] ?? [] } },
  });
}

const Typography = {
  'font-family': Object.fromEntries(Object.entries(TY.fontFamily).map(([k, v]) => [k, { $type: 'fontFamily', $value: v }])),
  'font-size': Object.fromEntries(Object.entries(TY.fontSize).map(([k, px]) => [k, { $type: 'dimension', $value: { value: px, unit: 'px' } }])),
  'font-weight': Object.fromEntries(Object.entries(TY.fontWeight).map(([k, w]) => [k, { $type: 'fontWeight', $value: w }])),
};

// テキストスタイル: 行の高さは倍率（数値で渡すと PERCENT になる）。字間は % を直接指定する
// （Figma のバリアブルは px でしか紐づかないため、行の高さと字間のバリアブルは作らない）
const typography = {};
for (const [name, s] of Object.entries(TY.styles)) {
  set(typography, name.split('/'), {
    $type: 'typography',
    $value: {
      // スタイルごとの fontFamily（ja / en などのキー）があれば優先。Figma のスタイルはフォントを1つしか持てない
      fontFamily: `{${COL.typography}.font-family.${s.fontFamily ?? TY.styleFontFamily ?? Object.keys(TY.fontFamily)[0]}}`,
      fontSize: `{${COL.typography}.font-size.${s.size}}`,
      fontWeight: `{${COL.typography}.font-weight.${s.weight}}`,
      lineHeight: s.lineHeight,
    },
    $description: s.use,
    $extensions: { 'com.figma': { letterSpacing: { unit: 'PERCENT', value: s.letterSpacing ?? 0 } } },
  });
}

const dtcg = {
  [COL.typography]: Typography,
  [COL.primitive]: Primitives,
  [COL.alias]: Alias,
  [COL.semantic]: Semantic,
  styles: { typography },
};

// ---- 一覧ページ ----
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const used = new Set(Object.values(C.aliases));
const ramps = Object.entries(C.primitives)
  .map(
    ([fam, { source, values }]) => `
    <div class="ramp"><div class="ramp-head"><h3>${esc(fam)}</h3><span>${esc(source)}</span></div><div class="chips">${values
      .map((h, i) => `<div class="chip${used.has(`${fam}/${C.steps[i]}`) ? ' used' : ''}"><i style="background:${h}"></i><b>${C.steps[i]}</b><code>${h}</code></div>`)
      .join('')}</div></div>`,
  )
  .join('');
const singles = Object.entries(C.singles)
  .map(([n, h]) => `<div class="chip${used.has(n) ? ' used' : ''}"><i style="background:${h}"></i><b>${esc(n)}</b><code>${h}</code></div>`)
  .join('');
const sw = (h) => `<span class="sw" style="background:${h}"></span>`;
const aliasRows = Object.entries(C.aliases)
  .map(([a, p]) => `<tr><td class="mono">${esc(a)}</td><td class="mono">${sw(hex(a))}${esc(p)} <span class="muted">${hex(a)}</span></td><td>${esc((C.aliasNotes ?? {})[a])}</td></tr>`)
  .join('');
const semanticTables = Object.entries(C.semantic)
  .map(([kind, list]) => {
    const body = list
      .map((r) => {
        const c = contrast.find((x) => x.token === r.token);
        const cr = c ? `${c.value.toFixed(2)}${c.ok == null ? '' : c.ok ? ' ✓' : ' ✗'} <span class="tag">${esc(r.on)}</span>` : '—';
        return `<tr><td class="mono">${esc(r.token)}</td><td class="mono">${sw(hex(r.ref))}${esc(r.ref)} <span class="muted">→ ${esc(C.aliases[r.ref])} ${hex(r.ref) ?? ''}</span></td><td>${esc(r.use)}</td><td class="mono">${cr}</td></tr>`;
      })
      .join('');
    return `<h3>${esc(kind)}</h3><div class="scroll"><table><thead><tr><th>項目</th><th>参照</th><th>用途</th><th>コントラスト比（相手）</th></tr></thead><tbody>${body}</tbody></table></div>`;
  })
  .join('');
const typeRows = Object.entries(TY.styles)
  .map(([name, s]) => {
    const px = TY.fontSize[s.size];
    const w = TY.fontWeight[s.weight];
    const ls = (s.letterSpacing ?? 0) / 100;
    const ot = featureSettings(s);
    const otMeta = ot ? `<span>OpenType: ${esc((s.openTypeFeatures ?? []).join(', '))}（Figma は手作業で設定）</span>` : '';
    // スタイル固有のフォント（例: 欧文だけの meta/sm は en）。既定はページ全体の cssFontStack
    const fam = s.fontFamily ? `;font-family:&quot;${esc(TY.fontFamily[s.fontFamily])}&quot;, sans-serif` : '';
    const famMeta = s.fontFamily ? `<span>フォント: font-family/${esc(s.fontFamily)}（${esc(TY.fontFamily[s.fontFamily])}）</span>` : '';
    return `<div class="type-row"><div class="type-meta"><code>${esc(name)}</code><span>${px}px / ${esc(s.weight)} ${w} / ${s.lineHeight} → ${+(px * s.lineHeight).toFixed(2)}px / 字間 ${s.letterSpacing ?? 0}%（${ls}em）</span>${famMeta}${otMeta}<span>${esc(s.use)}</span></div><p class="sample" style="font-size:${px}px;font-weight:${w};line-height:${s.lineHeight};letter-spacing:${ls}em${ot ? `;font-feature-settings:${esc(ot)}` : ''}${fam}"><span>${esc(s.sample ?? 'あいうえお Aa 123')}</span></p></div>`;
  })
  .join('');
const families = [...new Set(Object.values(TY.fontFamily))];
const weights = [...new Set(Object.values(TY.fontWeight))].sort((a, b) => a - b).join(';');
const fontsHref = `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.replace(/ /g, '+')}:wght@${weights}`).join('&')}&display=swap`;
const problems = [...errors.map((e) => `<li class="err">${esc(e)}</li>`), ...warnings.map((w) => `<li>${esc(w)}</li>`)].join('');

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(T.name)} デザイントークン</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref}">
<style>
  :root { --page: #F8F9FD; --surface: #FFFFFF; --ink: #1B1C1D; --muted: #5C5F62; --line: #E1E2E6; --box: #C9E6FF; --err: #AB3140; color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font-family: ${(TY.cssFontStack ?? 'sans-serif').replace(/[<>]/g, '')}; font-size: 14px; line-height: 1.71; padding: 32px 16px 64px; }
  .wrap { max-width: 1000px; margin-inline: auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; }
  section { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
  h1 { font-size: 28px; line-height: 1.57; margin: 0; } h2 { font-size: 20px; line-height: 1.6; margin: 0; } h3 { font-size: 14px; margin: 8px 0 0; }
  p { margin: 0; }
  .muted { color: var(--muted); }
  .mono, code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  .problems li.err { color: var(--err); font-weight: 700; }
  .ramp { display: grid; gap: 8px; } .ramp-head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; } .ramp-head span { color: var(--muted); font-size: 12px; }
  .chips { display: grid; grid-template-columns: repeat(${C.steps.length}, minmax(0, 1fr)); gap: 4px; }
  .singles { display: flex; gap: 8px; } .singles .chip { width: 72px; }
  .chip { display: grid; gap: 2px; min-width: 0; } .chip i { display: block; aspect-ratio: 1; border-radius: 8px; border: 1px solid var(--line); }
  .chip b, .chip code { font-size: 11px; overflow-wrap: anywhere; } .chip code { color: var(--muted); }
  .chip.used i { outline: 2px solid var(--ink); outline-offset: 2px; }
  @media (max-width: 640px) { .chips { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
  .scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; min-width: 760px; }
  th, td { text-align: left; padding: 8px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  th { font-size: 12px; color: var(--muted); font-weight: 400; } tr:last-child td { border-bottom: 0; }
  .sw { display: inline-block; width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--line); vertical-align: middle; margin-right: 8px; }
  .tag { color: var(--muted); }
  .types { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 24px; }
  .type-row { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 8px 24px; align-items: center; padding-block: 16px; border-bottom: 1px solid var(--line); }
  .type-row:last-child { border-bottom: 0; }
  .type-meta { display: grid; gap: 2px; } .type-meta span { font-size: 12px; line-height: 1.67; color: var(--muted); }
  .sample { max-width: 32em; } .sample span { background: var(--box); box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  @media (max-width: 640px) { .type-row { grid-template-columns: minmax(0, 1fr); } }
</style>
</head>
<body>
<div class="wrap">
  <header style="display:grid;gap:8px">
    <h1>${esc(T.name)} デザイントークン</h1>
    <p class="muted">${esc(T.description)}。tokens.json から生成。プリミティブ → エイリアス → 用途別の3層で、用途別は必ずエイリアスを参照する。</p>
    ${problems ? `<ul class="problems">${problems}</ul>` : '<p>検証: 問題なし</p>'}
  </header>
  <section><h2>プリミティブ</h2><p class="muted">枠付きの色はエイリアスから参照されている段階。</p>${ramps}<div class="singles">${singles}</div></section>
  <section><h2>エイリアス</h2><div class="scroll"><table><thead><tr><th>エイリアス</th><th>参照するプリミティブ</th><th>メモ</th></tr></thead><tbody>${aliasRows}</tbody></table></div></section>
  <section><h2>用途別（セマンティック）</h2><p class="muted">コントラスト比は、その色が実際に重なる相手との比。✓ / ✗ は tokens.json の min（文字 4.5、UI 部品 3）に対する判定。</p>${semanticTables}</section>
  <section><h2>タイポグラフィ</h2><p class="muted">水色の帯がテキストボックス（行の高さ）。字間は Figma では %、コードでは em。</p><div class="types">${typeRows}</div></section>
</div>
</body>
</html>
`;

// ---- CSS（Tailwind v4） ----
// 用途別の各行の css（変数名、または配列）を :root に hex で出し、@theme inline で --color-* に割り当てる。
// テキストスタイル・余白・角丸は @theme に出す。css.reset で Tailwind 標準の段階を無効化できる
const rem = (px) => `${+(px / 16).toFixed(4)}rem`;
const cssName = (name) => name.replace(/\//g, '-');
const buildCss = () => {
  const cfg = T.css;
  const vars = [];
  const seen = new Map();
  for (const r of rows) {
    for (const v of [r.css ?? []].flat()) {
      if (seen.has(v)) {
        errors.push(`CSS 変数 ${v} が ${seen.get(v)} と ${r.token} で重複している`);
        continue;
      }
      seen.set(v, r.token);
      vars.push([v, hex(r.ref), r.token]);
    }
  }
  const lines = [
    `/* 自動生成ファイル。手で編集しない。${relative(dirname(resolve(dirname(tokensPath), cfg.out)), resolve(tokensPath))} を直して生成し直す（${cfg.command ?? 'node build.mjs'}） */`,
    '',
    ':root {',
    ...vars.map(([v, h, token]) => `  ${v}: ${h}; /* ${token} */`),
    '}',
    '',
    '@theme inline {',
    ...vars.map(([v]) => `  --color-${v.slice(2)}: var(${v});`),
    ...Object.entries(cfg.fonts ?? {}).map(([name, value]) => `  --font-${name}: ${value};`),
    '}',
    '',
    '@theme {',
  ];
  if (cfg.reset?.text) lines.push('  --text-*: initial;');
  for (const [name, s] of Object.entries(TY.styles)) {
    const n = cssName(name);
    lines.push(
      `  --text-${n}: ${rem(TY.fontSize[s.size])};`,
      `  --text-${n}--line-height: ${s.lineHeight};`,
      `  --text-${n}--font-weight: ${TY.fontWeight[s.weight]};`,
      `  --text-${n}--letter-spacing: ${(s.letterSpacing ?? 0) / 100}em;`,
    );
  }
  for (const [name, px] of Object.entries(T.spacing ?? {})) lines.push(`  --spacing-${name}: ${rem(px)};`);
  if (cfg.reset?.radius) lines.push('  --radius-*: initial;');
  for (const [name, px] of Object.entries(T.radius ?? {})) lines.push(`  --radius-${name}: ${rem(px)};`);
  lines.push('}');
  // OpenType 機能は --text-* のサブプロパティで持てないので、テキストスタイルのクラスに直接当てる
  const ot = Object.entries(TY.styles).filter(([, s]) => (s.openTypeFeatures ?? []).length);
  const groups = new Map();
  for (const [name, s] of ot) {
    const key = featureSettings(s);
    groups.set(key, [...(groups.get(key) ?? []), `.text-${cssName(name)}`]);
  }
  if (groups.size) {
    lines.push('', '@layer utilities {');
    for (const [value, selectors] of groups) lines.push(`  ${selectors.join(',\n  ')} {`, `    font-feature-settings: ${value};`, '  }');
    lines.push('}');
  }
  return `${lines.join('\n')}\n`;
};

// 実行したディレクトリの prettier で整形する（lint-staged の整形と同じ結果にするため）
const format = async (text, filepath) => {
  try {
    const prettier = createRequire(join(process.cwd(), 'noop.js'))('prettier');
    const options = (await prettier.resolveConfig(filepath)) ?? {};
    return await prettier.format(text, { ...options, filepath });
  } catch {
    return text;
  }
};

const outputs = [
  [join(outDir, 'figma-tokens.json'), `${JSON.stringify(dtcg, null, 2)}\n`],
  [join(outDir, 'preview.html'), html],
];
if (T.css?.out) outputs.push([resolve(dirname(tokensPath), T.css.out), buildCss()]);
for (const o of outputs) if (!o[0].endsWith('.html')) o[1] = await format(o[1], o[0]);

if (check) {
  const stale = outputs.filter(([file, text]) => !existsSync(file) || readFileSync(file, 'utf8') !== text).map(([file]) => relative(process.cwd(), file));
  errors.forEach((e) => console.error(`エラー: ${e}`));
  if (stale.length) console.error(`生成物が tokens.json と合っていない: ${stale.join(', ')}。生成し直す（${T.css?.command ?? 'node build.mjs'}）`);
  process.exit(errors.length || stale.length ? 1 : 0);
}

for (const [file, text] of outputs) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

const count = (o) => Object.values(o).reduce((n, v) => n + ('$type' in v ? 1 : count(v)), 0);
console.log(
  `${COL.typography} ${count(Typography)} / ${COL.primitive} ${count(Primitives)} / ${COL.alias} ${count(Alias)} / ${COL.semantic} ${count(Semantic)} / テキストスタイル ${count(typography)}`,
);
console.log(`コントラスト: 判定 ${contrast.filter((c) => c.ok != null).length} 件、不足 ${contrast.filter((c) => c.ok === false).length} 件`);
if (manualFeatures.length) console.log(`Figma で手作業の設定が要る OpenType 機能（Type details → Details）: ${manualFeatures.join(' / ')}`);
warnings.forEach((w) => console.log(`注意: ${w}`));
errors.forEach((e) => console.error(`エラー: ${e}`));
console.log(`出力: ${outputs.map(([file]) => relative(process.cwd(), file)).join(', ')}`);
process.exit(errors.length ? 1 : 0);
