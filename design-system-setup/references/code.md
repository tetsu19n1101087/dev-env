# コードに入れる（CSS の生成、Tailwind v4）

## 方針

- 値の正は tokens.json。CSS は `build.mjs` で生成し、手で書かない
- 生成した CSS（entre-web では `app/tokens.css`）はコミットし、`globals.css` から `@import` する。アプリのビルドは生成済みの CSS だけを読み、tokens/ やスキルに依存しない
- `globals.css` には手書きの部分だけを残す（`@import "tailwindcss"`、`@layer base`、フォント変数の割り当て、外部部品用の CSS など）

## tokens.json の設定

```json
"css": {
  "out": "../app/tokens.css",
  "command": "yarn tokens",
  "reset": { "text": false, "radius": false },
  "fonts": { "en": "var(--font-inter), sans-serif" }
},
"spacing": { "space-4": 4, "space-8": 8, "...": 0 },
"radius": { "md": 8 }
```

- `out`: tokens.json からの相対パス。ないと CSS を作らない
- `reset`: true にすると `--text-*: initial` / `--radius-*: initial` を出し、Tailwind 標準の `text-sm` や `rounded-lg` を使えなくする。**既存画面の置き換えが終わってから true にする**（先に無効化すると画面が崩れる）
- `fonts`: `@theme inline` に `--font-<名前>` を出す。next/font の CSS 変数を参照する
- 用途別の各行に `"css": "--primary"`（または配列）を書くと、`:root` に hex で出し、`@theme inline` で `--color-*` に割り当てる。shadcn/ui を使う案件は shadcn の変数名を残す。`css` のない行（icon/* など）は出さない。同じ変数を2行に書くとエラー

生成される CSS の中身:

- `:root` … 用途別の色（hex。コメントに Figma のトークン名）
- `@theme inline` … `--color-*` の割り当て、フォント
- `@theme` … テキストスタイル（`--text-heading-lg` と `--line-height` `--font-weight` `--letter-spacing`）、余白（`--spacing-space-16` → `p-space-16`）、角丸
- `@layer utilities` … OpenType 機能（palt など）。`--text-*` のサブプロパティでは持てないので、テキストスタイルのクラスに直接当てる

## コミット時のチェック

```json
"lint-staged": {
  "{tokens/**,app/tokens.css}": "node tokens/build.mjs tokens/tokens.json --check"
}
```

`--check` は書き出さずに生成結果と既存ファイルを比べ、違えば終了コード 1。生成し忘れと、生成物の手編集を止められる。build.mjs は実行したディレクトリの prettier で生成物を整形してから比べるので、lint-staged の整形と食い違わない。

## Tailwind v4 で気をつけること

- **余白**: 名前付きの段階（`--spacing-space-16`）を足しても、標準の数字（`p-4`）は消えない。`--spacing` は `w-*` `h-*` `size-*` も兼ねているので無効化しない。「余白は `*-space-*` だけ」を DESIGN.md のルールにする
- **cn()（tailwind-merge）**: Tailwind v4 には tailwind-merge v3 を使う。自作のテキストスタイル（`text-heading-lg`）は、登録しないと文字色と判定され、`cn('text-heading-lg', 'text-primary')` で片方が消える。`extendTailwindMerge({ extend: { theme: { text: [...], spacing: [...] } } })` で登録する
- **フォント**: next/font の `variable` オプションで CSS 変数（`--font-inter`）を `<html>` に付け、`@theme inline { --font-sans: var(--font-inter), var(--font-noto-sans-jp), sans-serif; }` で割り当てる。日本語フォントは文字数が多いので `preload: false`
- **ダークモード**: 扱わないなら `.dark`、`@custom-variant dark`、shadcn 部品の `dark:` クラスを消しておく（新しい色と対にならない古い値が残るため）
- **shadcn の secondary**: 用途別の secondary に別の色（entre-web は青緑）を入れると、`variant="secondary"` のボタンやバッジの見た目が変わる。置き換えのときに用途を確認する

## 進め方

1. 基盤（CSS の生成、globals.css、フォント、cn、不要物の削除）を1つのブランチで入れる。`reset` は false のまま。画面が崩れていないことを確認して取り込む
2. 既存画面のクラスを置き換える（文字・色・余白・角丸）。終わったら `reset` を true にして生成し直す
3. クラスの並び替え（prettier-plugin-tailwindcss）は、置き換えの差分と混ざらないよう最後に別コミットで
