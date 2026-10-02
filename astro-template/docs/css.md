# CSS 設計

根拠の詳細は `static-site-setup` skill の `references/css-design.md`。

## 命名規則

FLOCSS の接頭辞 + BEM 形式。Stylelint の `selector-class-pattern` で強制している。

| 接頭辞 | 役割                                                        | 例                   |
| ------ | ----------------------------------------------------------- | -------------------- |
| `l-`   | レイアウト                                                  | `.l-Header`          |
| `c-`   | 汎用コンポーネント                                          | `.c-Button__label`   |
| `p-`   | ページ・セクション固有                                      | `.p-Hero__ttl--wide` |
| `u-`   | ユーティリティ                                              | `.u-visuallyHidden`  |
| `is-`  | 状態                                                        | `.is-active`         |
| `js-`  | JS のフック専用。**スタイルを当てない**（Stylelint が弾く） | `.js-toggle`         |

- Block は UpperCamel で、**コンポーネントのファイル名と一致させる**（`Hero.astro` → `.p-Hero`）。DevTools から実装箇所を辿れる
- Element / Modifier は lowerCamel（`__navBtn`、`--isNext`）
- scoped style が効く環境でも接頭辞は付ける。DevTools でどのセクションの要素か判別でき、外部 CSS との衝突も避けられる

## 層構成とカスケードレイヤー

- `global.scss` — エントリ。Layout から読み込む。`layers.scss`（順序の宣言）→ `reset.scss` → `variables.scss` → `base.scss` → `utilities.scss` の順に `@use` する
- `develop/` — 出力を持たない道具（function / mixin）。全 SCSS に自動注入される

優先順位（弱い → 強い）:

1. `@layer reset`（kiso.css）
2. `@layer base`
3. `@layer utilities`
4. **レイヤー外**: コンポーネントの scoped style（`<style>`）

- **utilities は scoped style に負ける。** レイヤーに属さないスタイルは全レイヤーより優先されるため。コンポーネント側で同じプロパティを書いているとユーティリティは効かない
- この構成は外部 CSS が無い単独サイトが前提。**既存サイトに組み込む案件では、外部 CSS（レイヤー外）に自前の reset / base が勝てなくなる**ので、レイヤーを外して `:where(#page-id)` で囲う方式に切り替える（skill の `references/existing-site-integration.md`）
- ビルド後の CSS では `@layer reset, base, utilities;` の宣言文が消え、ブロックがその順に並べ替えられる。順序は保たれているので問題ない

## reset（kiso.css）

日本語の組版（`text-autospace`、`line-break: strict` など）と、`:where()` による低い詳細度が特徴。`line-height: 1.5`、リンクの色リセット、画像の `max-inline-size: 100%`、フォーム要素のリセットまで済んでいるので、`base.scss` では重複して書かない。

`reset.scss` で `meta.load-css()` を使って `@layer reset` の中に読み込んでいる。

## ブレークポイント

値は `src/styles/develop/breakpoint.scss` で定義している（em 単位・モバイルファースト）。デザインに合わせてそこだけを書き換える。

```scss
.p-Foo {
  padding: rem(16);

  @include min-screen(md) {
    padding: rem(32);
  }
}
```

SP の値を先に書き、`min-screen()` で PC の値を上書きする。値を `0` にしたエントリはメディアクエリで包まずに出力される。未定義の名前を渡すとビルドがエラーで止まる（typo が全画面幅に出力されるのを防ぐ）。

## mixin / function

**最初に用意するのはこれだけ。** 使われない mixin を溜めず、必要になったら足す。

- `rem($px)` — px を rem に変換する（基準は 16 固定。rem はルート基準なので、親要素の font-size には影響されない）
- `@include hover { ... }` — `@media (any-hover: hover)` で包んだ `:hover`
- `@include min-screen($name) { ... }` — ブレークポイント以上

`develop/` は `astro.config.mjs` の `additionalData` で全 SCSS（コンポーネント内の `<style>` を含む）に注入されるので、各ファイルで `@use` しなくてよい。

> tsconfig の `paths`（`@/*`）は Sass の `@use` の解決には効かない。`additionalData` に `@/styles/develop` と書くと `Can't find stylesheet to import.` で落ちる。`astro.config.mjs` では `loadPaths` に `src/styles` を渡し、`@use "develop"` で解決させている（絶対パスを文字列に埋め込む方式は、Windows の `\` が Sass のエスケープとして解釈されて壊れる）。

## サイズ・変数

- サイズはカンプの px を `rem()` で変換する。`vw` 変換はしない（フォントサイズ設定に追従しない、大画面で巨大化する）。連続的に変えたい箇所だけ `clamp()` を使う
- 色・フォントなど、DevTools で確認・変更したい値はカスタムプロパティ（`variables.scss`）。計算に使う値は SCSS 変数
- **過去案件から変数定義をコピーしない。** 使うものだけを新しく定義する

## scoped style の制約

- 親コンポーネントの `<style>` から子コンポーネント内の要素は狙えない（別のスコープ ID が付く）
- slot で渡した要素は、記述した側（親）のスコープに属する
- 出力は `.p-Hero[data-astro-cid-xxx]`（詳細度 0,2,0）
