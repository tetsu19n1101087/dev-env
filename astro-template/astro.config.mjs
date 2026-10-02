// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

// 公開URLとサブディレクトリ。確定したらここだけ書き換える。
// BASE はドメイン直下なら '/'、サブディレクトリなら '/campaign/example/'。
const SITE = 'https://example.com';
const BASE = '/';

// 前後の / を付け忘れると public/ の参照や OGP 画像の URL が壊れる（'/campaign/x' + 'ogp.png' → '/campaign/xogp.png'）ので揃える。
/** @param {string} path */
const normalizeBase = (path) => {
  const trimmed = path.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
};

export default defineConfig({
  site: SITE,
  base: normalizeBase(BASE),
  // 納品HTMLを Prettier で整形するため、Astro 側の圧縮は切る。
  compressHTML: false,
  build: {
    format: 'directory',
  },
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // mixin / function を全SCSS（コンポーネント内 <style> を含む）に注入する。
          // tsconfig の paths（@/*）は Sass の @use 解決には効かないため、loadPaths で src/styles を探索対象にする。
          loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
          additionalData: `@use "develop" as *;\n`,
        },
      },
    },
  },
});
