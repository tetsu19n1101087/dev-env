# Lint / Format

根拠の詳細は `static-site-setup` skill の `references/lint-format.md`。

## 責務の分担

| ツール                      | 責務                                   | 対象                              |
| --------------------------- | -------------------------------------- | --------------------------------- |
| `astro check`（TypeScript） | 型の妥当性                             | `.astro` / `.ts`                  |
| ESLint                      | JS/TS のロジック上の問題               | `.js` / `.mjs` / `.ts` / `.astro` |
| Stylelint                   | CSS の記述とクラス命名                 | `.scss` / `.astro` の `<style>`   |
| Prettier                    | 整形                                   | ソース全体 + ビルド後の HTML      |
| markuplint                  | マークアップの妥当性・アクセシビリティ | **ビルド後の HTML**               |
| axe（`scripts/axe.mjs`）    | 実ブラウザでのアクセシビリティ検査     | `astro preview` で配信したページ  |

## TypeScript

`astro/tsconfigs/strict` に `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns` / `noFallthroughCasesInSwitch` を足している。`strictest` の `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` は LP 規模では記述量が増える割に効果が薄いので入れていない。

`include` / `exclude` は上書きしていない。プリセットの `include` に生成型（`.astro/types.d.ts`）が含まれており、上書きすると型が効かなくなるため。

## ESLint

`@eslint/js` + `typescript-eslint` + `eslint-plugin-astro` の recommended。

- `no-undef` は off。型の妥当性は `astro check` の責務で、素の `no-undef` はフレームワークのグローバル型を誤検知する
- 型情報を使う設定（TypeChecked 系）は入れていない。主戦力の Promise 系ルールが LP では活きる場面が少ないため。必要になったら追加する
- `eslint-config-prettier` は入れていない。採用した recommended 3つに整形系のルールが1つも無く、無効化する対象が存在しないため（2026-10 に数えて確認）
- `.claude/` を除外している。worktree を置くと tsconfig の候補が複数になり、全ファイルがパースエラーになる

## Stylelint

`stylelint-config-standard-scss` + `stylelint-config-html/astro` + `stylelint-config-recess-order`。

`selector-class-pattern` で命名規則（`docs/css.md`）を強制している。正規表現を変えたら、通るべき名前と弾かれるべき名前を並べて実際に走らせる。

```bash
printf '%s\n' '.p-Hero__ttl--wide { color: #000; }' '.c-button { color: #000; }' \
  | npx stylelint --stdin-filename src/t.scss
```

ローカルルール `local/component-css`（`stylelint-plugins/component-css.js`）で、コンポーネント CSS のルール（`docs/css.md`）を強制している。`.astro` の `<style>` だけが対象。

- `<style>` の属性は postcss-html が `root.raws.codeBefore`（`<style>` タグまでの HTML）に持っているので、そこから `is:global` / `is:inline` を読む
- セレクタは自前の字句解析で見ている。`postcss-selector-parser` は stylelint の推移的依存で、直接は依存していないため
- ルールを変えたら、違反する `.astro` を `src/components/` と `src/pages/` に一時的に置いて `npx stylelint` を走らせ、検出されることを確かめる

## Prettier

- `printWidth: 120`
- `.astro` は `prettier-plugin-astro` で処理する。プラグインが無いと `prettier --check .` は `.astro` を**無言でスキップして成功扱い**になる。処理されているかは `npx prettier --check . --log-level debug | grep '\.astro'` で確かめる
- `build` は Astro の出力に `prettier --write "dist/**/*.html" --ignore-path /dev/null` を掛ける。`--ignore-path /dev/null` が無いと、Prettier 3 が既定で読む `.gitignore` の `dist/` が効いて何も整形されない（`.prettierignore` に `dist/` を書かなくても同じ）
- `compressHTML: false` にしている。圧縮後の HTML を整形すると空白の扱いが変わるため

## markuplint

ビルド後の HTML を対象にする。ページ全体を見ないと判定できないルール（見出しレベル、ランドマーク）が正しく働き、テンプレート構文の誤検出も無い。`@markuplint/astro-parser` は旧 Astro コンパイラに依存しているので使わない。

`.markuplintrc` の調整:

- preset の `performance/head-element-order` を無効化し、同じルールを独自の順序で設定している。既定値は `meta` を `name` 属性のアルファベット順に並べるため、`name` を持たない OGP の `meta[property]` が先頭に寄せられて警告になる
  - 順序: `meta[charset]` → `meta[http-equiv]` → viewport → `title` → `meta[name]`（アルファベット順）→ `meta[property]` → `link` → `style` → `script`

## axe

`npm run build && npm run test:a11y`。

- WCAG 2.2 A/AA の違反はエラー（exit 1）、AAA と best-practice は警告
- SP（375px）と PC（1280px）で実行する。axe は非表示要素を検査しないので、片方の幅でしか表示されない要素はその幅でしか検査されない
- 「要確認」は axe が自動で判定できなかったもの。**背景画像の上に置いた文字のコントラストは常にここに出る**ので、目視やデザインツールで確認する
- Chrome はシステムにインストールされたものを `channel: 'chrome'` で探す。別の場所にある場合は `CHROME_PATH=/path/to/chrome npm run test:a11y`
- プレビューサーバーは Astro の `preview()` をスクリプト内で空きポート（`port: 0`）に起動する。固定ポートで `astro preview` を別プロセス起動すると、ポートが使用中のとき Vite が黙って別のポートに移り、**元のポートにいた別のサーバーを検査して合格を出す**ことがある
- axe の自動検出は WCAG の問題の一部に限られる。キーボード操作・フォーカス順序・読み上げ順序は手動で確認する
- 公開前の総合チェック（リンク切れ・OGP・Lighthouse など）は `site-quality-check` skill を使う
