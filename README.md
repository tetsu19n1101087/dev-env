# dev-env

Web 制作（静的サイト・LP）の開発環境をまとめたリポジトリ。

## 内容

- [`astro-template/`](astro-template/) — 静的サイト・LP 向けの Astro 開発環境テンプレート。ESLint / Stylelint / Prettier / markuplint / axe、SCSS（FLOCSS 命名・`@layer`）、husky + commitlint、GitHub Actions での検証までを、検証済みのバージョンでそろえている。使い方は [`astro-template/README.md`](astro-template/README.md) を参照。

## 使い方

```bash
npm create astro@latest -- --template tetsu19n1101087/dev-env/astro-template
```

設定の判断理由と検証結果は [`astro-template/docs/`](astro-template/docs/) にまとめている。
