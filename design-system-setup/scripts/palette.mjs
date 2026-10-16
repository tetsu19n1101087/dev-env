#!/usr/bin/env node
// プリミティブの色見本（11 段階）を作る。material-color-utilities の HCT 色空間でトーンを刻むので、
// 同じ段階番号なら色相が違っても明るさ（白・黒とのコントラスト）がほぼ揃う。
//
// 準備（一度だけ。案件のリポジトリには入れない）:
//   npm install --prefix ~/.cache/mcu @material/material-color-utilities@0.3.0
//   export NODE_PATH=~/.cache/mcu/node_modules
//
// 使い方:
//   node palette.mjs seed <名前> <#hex>                 シード色の色相と彩度で作る
//   node palette.mjs hue  <名前> <#hex> <chroma>        シード色の色相だけ使い、彩度を指定して作る（くすみ・鮮やかさの調整）
//   node palette.mjs theme <material-theme.json> [palette...]  Material Theme Builder の書き出しから palettes を読む
//
// 出力は tokens.json の color.primitives にそのまま貼れる JSON。あわせて白・黒とのコントラスト比を表示する。
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
let mcu;
try {
  mcu = require('@material/material-color-utilities');
} catch {
  console.error('@material/material-color-utilities が見つからない。ファイル冒頭の「準備」を実行してから NODE_PATH を設定する。');
  process.exit(2);
}
const { Hct, TonalPalette, argbFromHex, hexFromArgb } = mcu;

// Material のトーン（明るさ 0〜100）→ 段階番号。数字が大きいほど暗い
const TONES = [
  [98, '25'], [95, '50'], [90, '100'], [80, '200'], [70, '300'], [60, '400'],
  [50, '500'], [40, '600'], [30, '700'], [20, '800'], [10, '900'],
];

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
const H = (argb) => hexFromArgb(argb).toUpperCase();

const out = {};
const report = (name, values, source) => {
  out[name] = { source, values };
  console.error(`\n${name}（${source}）`);
  values.forEach((h, i) => {
    console.error(`  ${TONES[i][1].padStart(3)} ${h}  白に対して ${ratio(h, '#FFFFFF').toFixed(2)}  黒に対して ${ratio(h, '#000000').toFixed(2)}`);
  });
};

const [, , mode, ...args] = process.argv;
if (mode === 'seed') {
  const [name, seed] = args;
  const p = TonalPalette.fromInt(argbFromHex(seed));
  report(name, TONES.map(([t]) => H(p.tone(t))), `${seed} から生成`);
} else if (mode === 'hue') {
  const [name, seed, chroma] = args;
  const src = Hct.fromInt(argbFromHex(seed));
  const p = TonalPalette.fromHueAndChroma(src.hue, Number(chroma));
  report(name, TONES.map(([t]) => H(p.tone(t))), `${seed} の色相、彩度 ${chroma} で生成`);
} else if (mode === 'theme') {
  const [file, ...names] = args;
  const theme = JSON.parse(readFileSync(file, 'utf8'));
  for (const name of names.length ? names : Object.keys(theme.palettes)) {
    const pal = theme.palettes[name];
    if (!pal) {
      console.error(`palettes に ${name} がない`);
      continue;
    }
    report(name, TONES.map(([t]) => String(pal[String(t)]).toUpperCase()), `material-theme.json の palettes.${name}`);
  }
} else {
  console.error('使い方: node palette.mjs seed|hue|theme ...（ファイル冒頭を参照）');
  process.exit(2);
}
console.log(JSON.stringify(out, null, 2));
