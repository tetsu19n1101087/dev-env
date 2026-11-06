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
- コンポーネント CSS は scoped style を使わずグローバルに出力するので（後述）、**クラス名の一意性は命名規則だけで保たれている。** Block 名をファイル名と一致させるのはそのため

## 層構成とカスケードレイヤー

- `global.scss` — エントリ。Layout から読み込む。`reset.scss` → `variables.scss` → `base.scss` → `utilities.scss` の順に `@use` する
- コンポーネントの `<style is:global>` — `@layer components` に入る
- `develop/` — 出力を持たない道具（function / mixin）。全 SCSS に自動注入される

優先順位（弱い → 強い）:

1. `@layer reset`（kiso.css）
2. `@layer base`
3. `@layer components`（コンポーネントの `<style is:global>`）
4. `@layer utilities`

- **レイヤーの順序は `Layout.astro` の `<head>` にある `<style is:inline>` で宣言している。** SCSS の中では宣言しない。バンドル CSS ではコンポーネントの `@layer components` が先頭に来て、SCSS に書いた宣言文は minifier に消されるため、`<link>` より前で宣言しないと components が最弱のレイヤーになってしまう（実測で確認）
- utilities はコンポーネントより強い。`u-` クラスを付ければ、コンポーネント側の同じプロパティを上書きできる
- この構成は外部 CSS が無い単独サイトが前提。**既存サイトに組み込む案件では、外部 CSS（レイヤー外）に自前の reset / base が勝てなくなる**ので、レイヤーを外して `:where(#page-id)` で囲う方式に切り替える（skill の `references/existing-site-integration.md`）

## コンポーネント CSS のルール

コンポーネントの `<style>` は scoped にせず、`is:global` を付けて `@layer components` で囲む。scoped style だとコンポーネントの中身が変わるたびに `data-astro-cid-xxx` のハッシュが変わり、そのコンポーネントを使う全ページの納品 HTML に差分が出るため（判断の記録は `decisions.md`）。

```astro
<style is:global lang="scss">
  @layer components {
    .p-Hero {
      display: grid;
    }

    .p-Hero__ttl {
      font-size: rem(32);
    }
  }
</style>
```

スコープが無いぶん、衝突と漏れを Stylelint のローカルルール `local/component-css`（`stylelint-plugins/component-css.js`）で防いでいる。`.astro` の `<style>` だけが対象で、`.scss` ファイルと `<style is:inline>` は検査しない。

- `<style>` には `is:global` を付ける
- 中身はトップレベルの `@layer components { ... }` ひとつで囲む
- 書いてよいクラスは、自分の Block（`components/` は `p-` か `c-`＋ファイル名、`layouts/` は `l-`＋ファイル名）とその Element / Modifier、`is-` だけ。1ファイルの中で `p-` と `c-` を混ぜない
- レイヤー直下のセレクタは自分の Block から始める
- **タグの子孫セレクタ（`.p-Hero a`）は書かない。** スコープが無いので、子コンポーネントの中の要素にまで効いてしまう。狙う要素にはクラスを付ける。CMS のリッチテキストのようにクラスを付けられない箇所だけ、理由を書いて無効化する

  ```scss
  /* stylelint-disable-next-line local/component-css -- CMS のリッチテキストはクラスを付けられない */
  .p-News__body p {
    margin-block: 1em;
  }
  ```

- `src/pages/` には `<style>` を書かない。ページはコンポーネントを並べるだけにする（`index.astro` が複数あると Block 名が決められない）
- `@keyframes` の名前もグローバルなので、Block 名を元に付ける（`hero-fade-in` など。kebab-case は既存ルールの `keyframes-name-pattern` が強制する）

### 親から子の配置を調整する（Mix）

親から子コンポーネントの中のクラスは狙えない（Lint が弾く）。余白や幅など、子の配置を親から決めたいときは、親の Element クラスを子に渡す。子は `class` を受け取り、自分の Block と結合する。

```astro
---
// Button.astro
interface Props {
  class?: string;
}
const { class: className } = Astro.props;
---

<a class:list={['c-Button', className]} href="#">
  <slot />
</a>
```

```astro
<!-- Hero.astro -->
<Button class="p-Hero__btn">詳しく見る</Button>

<style is:global lang="scss">
  @layer components {
    // 親が決めるのは配置（margin・幅・grid 上の位置）だけ。見た目は Button 側に書く
    .p-Hero__btn {
      justify-self: center;
    }
  }
</style>
```

`.p-Hero__btn` と `.c-Button` はどちらも詳細度 0,1,0 で同じレイヤーにあるので、同じプロパティを両方に書くと、CSS 内の並び順で勝ち負けが決まる。親側には配置のプロパティだけを書き、子と同じプロパティを書かない。

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
