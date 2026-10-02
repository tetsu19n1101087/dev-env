# 判断の記録

設定ファイルだけでは「なぜこの値か」が残らないので、選ばなかった選択肢とその理由をここに書く。検証で分かった挙動は、それぞれのトピックの docs（`setup.md` / `css.md` / `lint.md` / `assets.md`）に書いている。案件で判断を変えたら追記する。

## バージョンの固定

- 依存の版は `package.json` に `^` を付けずに固定し、`package-lock.json` も含めている。展開した時点の最新を入れると、周辺ツールが追随していない版を引くことがあるため
- **TypeScript は 6 系に留めている。** 7 系は `@astrojs/check`（`^5 || ^6`）と `typescript-eslint`（`>=4.8.4 <6.1.0`）が未対応で、入れると `npm install` が ERESOLVE で失敗する（2026-10 時点）。両方が 7 に対応したら上げる
- `eslint-plugin-astro` の peer のうち `eslint-plugin-jsx-a11y` は optional なので入れていない。アクセシビリティはビルド後の HTML に対する markuplint と axe で見る

## 選ばなかった選択肢

| 項目                 | 採用                                                  | 選ばなかったもの                  | 理由                                                                                                        |
| -------------------- | ----------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| パッケージマネージャ | npm                                                   | pnpm / yarn                       | 追加インストール不要。skill の検証手順（`--dry-run`、`overrides`）がそのまま使える                          |
| tsconfig             | strict + 個別追加                                     | strictest                         | `noUncheckedIndexedAccess` などは LP 規模で抑制コメントが増える                                             |
| ESLint               | recommended                                           | TypeChecked 系                    | 非同期処理が少ない。型情報ありだと設定ファイル自身が誤検出される                                            |
| reset                | kiso.css                                              | destyle / modern-normalize / ress | 日本語組版への配慮と `:where()` による低い詳細度                                                            |
| 詳細度の整理         | `@layer`                                              | 読み込み順 + `:where()`           | 外部 CSS の無い単独サイトではレイヤーが素直に効く                                                           |
| 画像                 | `<Picture>` AVIF + WebP                               | `<Image>` WebP のみ               | ファイルサイズを優先。ビルド時間は増える                                                                    |
| フォント             | システムフォント                                      | Astro の Fonts API                | 案件ごとに決める                                                                                            |
| sitemap              | 入れない                                              | `@astrojs/sitemap`                | 単独 LP は1ページ。複数ページになったら追加する                                                             |
| HTML の出力形式      | `build.format: 'directory'`                           | `'file'`（`/about.html`）         | `/about/` 形式の URL になる。`scripts/axe.mjs` は `dist/**/index.html` をページとして探す前提               |
| HTML の圧縮          | `compressHTML: false`                                 | Astro 既定（圧縮あり）            | 納品 HTML を Prettier で整形するため                                                                        |
| Prettier の行幅      | `printWidth: 120`                                     | 既定の 80 / 100                   | 好みで決めた（実測はしていない）。既存の納品物があれば行長の分布を測って見直す（skill の `lint-format.md`） |
| Prettier の引用符    | `singleQuote: true`                                   | 既定（ダブルクォート）            | JS / TS で一般的な書き方に合わせた。HTML の属性値はこの設定に関係なくダブルクォートのまま                   |
| `verify` の範囲      | build + check + lint + **format:check** + lint:markup | `format:check` を含めない         | エディタの保存時整形に頼ると、整形されていないソースが CI を通ってしまうため                                |
| axe の実行           | 独立コマンド                                          | `verify` / CI に含める            | ブラウザが必要で、実行環境に依存する                                                                        |
| GTM などの計測タグ   | 入れない                                              | Layout に枠を用意                 | 案件ごとに要否と方式が違う                                                                                  |
