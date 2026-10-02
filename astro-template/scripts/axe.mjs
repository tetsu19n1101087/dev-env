// ビルド済みの dist を astro preview で配信し、実ブラウザで axe-core を実行する。
// 使い方: npm run build && npm run test:a11y
//
// - WCAG 2.2 A/AA の違反はエラー（exit 1）、AAA と best-practice は警告にとどめる
// - axe は非表示要素を検査しないため、SP 専用・PC 専用の要素を拾えるよう複数の画面幅で走らせる
// - Chrome はシステムにインストールされたものを使う。別の場所にある場合は CHROME_PATH で指定する
import { globSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { preview } from 'astro';
import puppeteer from 'puppeteer-core';

const VIEWPORTS = [
  { name: 'SP', width: 375, height: 812 },
  { name: 'PC', width: 1280, height: 800 },
];
const ERROR_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const WARN_TAGS = ['wcag2aaa', 'best-practice'];

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

// build.format: 'directory' なので dist/**/index.html がページになる
const pages = globSync('dist/**/index.html').map((file) => file.slice('dist/'.length, -'index.html'.length));
if (pages.length === 0) {
  console.error('dist にページがありません。先に npm run build を実行してください。');
  process.exit(1);
}

function report(label, results) {
  for (const r of results) {
    console.log(`  [${label}] ${r.id} (${r.impact}) ${r.help}`);
    for (const node of r.nodes.slice(0, 5)) console.log(`      ${node.target.join(' ')}`);
    if (r.nodes.length > 5) console.log(`      ...他 ${r.nodes.length - 5} 件`);
  }
}

let errorCount = 0;
let warnCount = 0;
let server;
let browser;

try {
  // port: 0 で空きポートを使う。固定ポートだと、使用中のとき別のサーバーを検査してしまう
  server = await preview({ server: { port: 0 }, logLevel: 'warn' });
  // base を含むトップの URL（例: http://localhost:51234/campaign/example/）
  const root = server.urls.local[0];

  browser = await puppeteer.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' },
  );
  const page = await browser.newPage();

  for (const path of pages) {
    for (const vp of VIEWPORTS) {
      await page.setViewport({ width: vp.width, height: vp.height });
      const url = new URL(path, root).href;
      const response = await page.goto(url, { waitUntil: 'networkidle0' });
      // 同じ URL の2回目は 304（キャッシュ）になるので、ok() ではなく 400 以上を失敗とする
      if (!response || response.status() >= 400) {
        console.log(`${url} [${vp.name}] ページを取得できませんでした（${response?.status() ?? '応答なし'}）`);
        errorCount++;
        continue;
      }

      await page.evaluate(axeSource);
      const result = await page.evaluate(
        (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
        [...ERROR_TAGS, ...WARN_TAGS],
      );

      // ルールは複数のタグを持つ。A/AA のタグを1つでも含めばエラーとして扱う
      const errors = result.violations.filter((v) => v.tags.some((t) => ERROR_TAGS.includes(t)));
      const warnings = result.violations.filter((v) => !errors.includes(v));
      errorCount += errors.length;
      warnCount += warnings.length;

      // incomplete は axe が自動で判定できなかったもの（背景画像上の文字のコントラストなど）
      console.log(
        `/${path} [${vp.name} ${vp.width}px] error: ${errors.length} / warning: ${warnings.length} / 要確認: ${result.incomplete.length}`,
      );
      report('error', errors);
      report('warn', warnings);
      report('要確認', result.incomplete);
    }
  }
} finally {
  await browser?.close();
  await server?.stop();
}

console.log(`\n合計 error: ${errorCount} / warning: ${warnCount}`);
console.log(
  '※ axe の自動検出は WCAG の問題の一部に限られます。キーボード操作・フォーカス順序・読み上げ順序は手動で確認してください。',
);
process.exit(errorCount > 0 ? 1 : 0);
