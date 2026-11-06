# AGENTS.md

Astro による静的サイト・LP。このファイルには最初に読むべきことだけを書く。詳細は `docs/` を参照。

## 絶対に守る制約

- **`:hover` を直接書かない。`@include hover { ... }` を使う。** タッチ端末でホバー状態が固着するのを防ぎ、タッチ＋マウス併用端末でもホバーを効かせるため（`any-hover`）。
- **クラス名は命名規則に従う（Stylelint が強制する）。** `l-` / `c-` / `p-` + UpperCamel の Block（コンポーネントのファイル名と一致）、`u-`、`is-`。`js-` は JS のフック専用でスタイルを当てない。詳細は `docs/css.md`。
- **コンポーネントの `<style>` は `is:global` を付け、`@layer components { ... }` で囲む（Stylelint が強制する）。** scoped style のハッシュが納品 HTML の差分に出るのを防ぐため。スコープが無いので、セレクタは自分の Block から始め、タグの子孫セレクタ（`.p-Hero a`）は書かない。`src/pages/` には `<style>` を書かない。詳細は `docs/css.md`。
- **サイズは px を `rem()` で変換して書く。カンプ幅基準の `vw` 変換はしない。** ブラウザのフォントサイズ設定に追従させるため。
- **`public/` のファイルは `import.meta.env.BASE_URL` を付けて参照する。** サブディレクトリ配置（`BASE` 設定）で絶対パス直書きは 404 になる。
- **LCP 候補の画像だけに `priority` を付ける（1ページ1枚）。** 複数に付けると優先度の効果が薄まる。
- **DOM 操作はクライアント側の `<script>` に書く。** frontmatter はビルド時に Node で実行され、`document` / `window` は存在しない。
- **テンプレート内のコメントは `{/* */}` で書く。** `<!-- -->` は納品 HTML に残る。

## コマンド

| コマンド                          | 内容                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`                     | 開発サーバー（Astro 7 はバックグラウンドで常駐。`npx astro dev stop` で停止） |
| `npm run build`                   | ビルド + 納品 HTML の整形                                                     |
| `npm run check`                   | 型チェック（`astro check`）                                                   |
| `npm run lint`                    | ESLint + Stylelint                                                            |
| `npm run format` / `format:check` | Prettier                                                                      |
| `npm run lint:markup`             | ビルド後の HTML を markuplint で検査                                          |
| `npm run verify`                  | 納品前の通し検査（build → check → lint → format:check → lint:markup）         |
| `npm run test:a11y`               | 実ブラウザで axe を実行（要 `npm run build`）                                 |

## ドキュメント

| ファイル                  | 内容                                            |
| ------------------------- | ----------------------------------------------- |
| `docs/setup.md`           | Node・npm・install scripts・Git フック・CI      |
| `docs/css.md`             | 命名規則・レイヤー構成・ブレークポイント・mixin |
| `docs/lint.md`            | 各ツールの責務と設定の理由                      |
| `docs/assets.md`          | 画像の書き出し・配置・命名、フォント            |
| `docs/browser-support.md` | ブラウザサポートポリシー                        |
| `docs/decisions.md`       | 判断の記録（選ばなかった選択肢とその理由）      |

## 現在の状況

- 公開 URL（`SITE`）・公開パス（`BASE`）: 未確定（`astro.config.mjs` 先頭の定数）
- サイト名・説明文: 未設定（`src/site.ts`）
- `src/components/Hero.astro` はサンプル。案件の実装に置き換える
