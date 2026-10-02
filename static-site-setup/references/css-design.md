# CSS設計

## 命名規則

FLOCSS などの既存の枠組みをベースにすると、接頭辞から役割が読める。

| 接頭辞 | 役割 |
|---|---|
| `l-` | レイアウト |
| `c-` | 汎用コンポーネント |
| `p-` | ページ固有 |
| `u-` | ユーティリティ |
| `js-` | JSのフック専用（スタイルを当てない） |
| `is-` | 状態 |

### コンポーネント名とクラス名を対応させる

**Block名をコンポーネントのファイル名と一致させる**と、DevTools から実装箇所を辿れる。`Hero.astro` なら `.p-Hero`。この場合 Block は UpperCamelCase になる。

要素・修飾子は lowerCamel にすると視覚的に区別しやすい（`.p-Hero__ttl--wide`）。

規則を決めたら **Stylelint の `selector-class-pattern` で強制する**（`lint-format.md` 参照）。

### スコープ機構があっても接頭辞は残す

コンポーネントスコープが効く環境でも、接頭辞を捨てない方がよい。DevTools でどのセクションの要素か判別でき、外部CSSとの偶発的な衝突も避けられる。実質コストがない。

## 層構成

グローバルとコンポーネントの二層が扱いやすい。

| 層 | 内容 | スコープ |
|---|---|---|
| グローバル | リセット、カスタムプロパティ、基本スタイル、ユーティリティ | なし |
| コンポーネント | セクション固有のスタイル | あり |

ディレクトリ例:

```
styles/
├── global.scss          # @use で集約。レイアウトから import する
├── reset.scss
├── variables.scss       # カスタムプロパティ
├── base.scss            # html / body / a / img など
├── utilities.scss
└── develop/             # 出力を持たない道具
    ├── _index.scss      # @forward で集約
    ├── breakpoint.scss
    └── utils.scss
```

### `@use` と `@forward` を使い分ける

| ファイル | 使う | 理由 |
|---|---|---|
| エントリ（`global.scss`） | `@use` | CSSを出力するのが目的。他から読まれる想定がない |
| 道具の集約（`develop/_index.scss`） | `@forward` | mixin・function を再公開するのが目的 |

出力結果は同じになることが多いが、意図が明確になる。`@forward` だけのファイルは「それ自体は何も出力せず、読み込んだ側に中身を公開する」もの。

### mixin / function の共有

ビルドツールの機能で全SCSSに自動注入すると、各ファイルの `@use` が不要になる。

```js
// Vite系の場合
css: { preprocessorOptions: { scss: { additionalData: `@use "<path>/develop" as *;` } } }
```

**コンポーネント内の `<style>` は独立してコンパイルされる**ため、注入しないと mixin が使えない。`Undefined mixin` で落ちる。

**tsconfig の `paths` エイリアスは Sass の `@use` には効かない。** `additionalData: '@use "@/styles/develop" as *;'` と書くと `Can't find stylesheet to import.` で落ちる。TS の import ではエイリアスが効くので、同じ書き方が通ると思い込みやすい。Sass の `loadPaths` に探索先を渡す。

```js
import { fileURLToPath } from 'node:url';
// scss: {
//   loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
//   additionalData: `@use "develop" as *;\n`,
// }
```

絶対パスを `additionalData` の文字列に埋め込む方法でも macOS では動くが、Windows のパスは `\` が Sass の文字列エスケープとして解釈されて壊れる。

```bash
printf 'a { b: "C:\\Users\\taro\\src\\styles\\develop"; }\n' | npx sass --stdin
# b: "C:UserstarosrcstylesÞvelop";   ← \ が消え、\de は16進エスケープとして Þ になる
```

## スコープ機構の制約を把握する

フレームワークのスコープ付きスタイルには共通の制約がある。**採用前に実際に試す。**

**親から子コンポーネント内の要素は狙えない。** 親と子には別々のスコープIDが振られるため、親の `<style>` に書いたセレクタは子の要素にマッチしない。CSSは生成されるのに効かないという、気づきにくい失敗になる。

```css
.p-Hero__ttl[data-scope-child]{color:blue}      /* 子が書いた。効く */
.p-Hero__ttl[data-scope-parent]{font-size:99px} /* 親が書いた。空振り */
```

**slot で渡した要素は、記述した側（親）のスコープに属する。** 子コンポーネント内に配置されても子のスタイルは効かない。

**外部から挿入される要素（サーバー側インクルード、CMSのテンプレート）にはスコープ属性が付かない。** そこへの上書きはグローバル側に書く。

### スコープの詳細度への影響を確認する

スコープの実装方法によって詳細度が変わる。設定で切り替えられる場合、**詳細度を下げる設定は外部CSSとの競合で不利になることがある。**

| 実装 | 出力 | 詳細度 |
|---|---|---|
| 属性 | `.foo[data-scope-x]` | (0,2,0) |
| `:where()` | `.foo:where(.scope-x)` | (0,1,0) |

外部CSSが同居する環境では、詳細度が高い方が安全。実際にビルドして出力を確認する。

## 詳細度の設計

**外部CSSが同居する環境では、詳細度の順序が設計の要になる。**

3層が重なる典型:

| 層 | 例 | 詳細度 |
|---|---|---|
| 外部CSS（先に読まれる） | `h1,h2,h3` | (0,0,1) |
| 自前のグローバル | ? | ? |
| コンポーネント | `.p-Hero__ttl[data-scope-x]` | (0,2,0) |

**自前のグローバルは、外部CSSに勝ち、コンポーネントに負ける必要がある。**

`#id` でスコープすると `(1,0,1)` になり、**コンポーネントのスタイルを踏み潰す**。これが最も踏みやすい罠。

`:where()` で囲むと詳細度が0になるため、`:where(#id) h1` は `h1` と同じ `(0,0,1)` になる。外部CSSと同点で後勝ち、コンポーネントには負ける — 狙い通りの順序になる。

```scss
:where(#page-id) {
  h1, h2, h3 { line-height: inherit; }
}
```

### `@layer` が逆効果になるケース

カスケードレイヤーは優先順位を明示できる有用な機能だが、**レイヤーに属さないスタイルは全レイヤーより優先される**という性質がある。

外部CSS（レイヤー外）を打ち消したい場合、自前のCSSをレイヤーに入れると**打ち消せなくなる**。一般的な推奨とは逆の判断が要る。

自前のCSSだけで完結する環境（外部CSSが無い）なら、レイヤーで整理する方が見通しがよい。**環境によって答えが変わる項目**として意識する。

#### レイヤーで整理する場合の構成例

```scss
// layers.scss（global.scss で最初に @use する）
@layer reset, base, utilities;

// reset.scss — 外部の reset もレイヤーに入れられる
@use 'sass:meta';
@layer reset {
  @include meta.load-css('kiso.css/kiso');
}
```

- Sass では `@use` より前に他の規則を書けないので、順序の宣言は専用ファイルにして最初に `@use` する
- **フレームワークの scoped style はレイヤーに属さない**ので、全レイヤーより優先される。逆に言えば **utilities は scoped style に負ける**。コンポーネント側で同じプロパティを書いているとユーティリティが効かない
- ビルド後の CSS からは `@layer reset, base, utilities;` の宣言文が消える。minifier がブロックを宣言順に並べ替えたうえで削除するため、順序は保たれる（宣言順を入れ替えるとブロックの並びも入れ替わることで確認できる）

### `:where()` と `@scope` の使い分け

どちらもスコープルートの詳細度を加算しない。結果は同じになる。

`@scope` が有利なのは:
- **入れ子になったスコープで近接性が重要な場合**（テーマクラスなど）
- **`to (...)` でサブツリーを除外したい場合**

どちらも不要なら `:where()` で足りる。サポート範囲も広い。

プリプロセッサは `@scope` を透過するので、記述自体は問題なく通る。

## reset の選定

### 既存CSSがある環境では、汎用リセットが二重適用になる

**まず既存のCSSが何をしているか読む。** サイト共通のリセットが既に適用されていれば、汎用リセットライブラリを重ねる意味がない。詳細度の競合を増やすだけになる。

```bash
grep -n "box-sizing\|margin: 0\|list-style" <既存CSS>
```

確認する項目:

- `margin` / `padding` のゼロ化
- `box-sizing: border-box`
- `ul` のマーカー除去
- `img` の `max-width` / `vertical-align`

これらが済んでいるなら、**必要なのはリセットではなく「打ち消し」**。既存CSSが値を持たせているもののうち、デザインの妨げになるものだけを無効化する。

よくある打ち消し対象:

| 既存CSSの指定 | 問題 |
|---|---|
| `h1..h5 { line-height: 1em }` | 見出しが詰まる |
| `a, button { transition: all 0.2s }` | 全プロパティに意図しないアニメーション |
| `img { vertical-align: bottom }` | デザインによって干渉 |

打ち消しには具体値ではなく `inherit` / `initial` / `revert` / `unset` などのキーワードを使う。意図が明確になり、既存CSS側の値が変わっても追従が不要になる。

### 既存CSSが無い環境

destyle / modern-normalize / ress / kiso.css などから選ぶ。デザインカンプ通りに作る案件では、ブラウザデフォルトを消す方向（reset寄り）が扱いやすい。

**kiso.css** は日本語の組版（`text-autospace`、`line-break: strict`、`text-spacing-trim`）に配慮しており、ほぼ全ての規則が `:where()` で詳細度0になっている。`line-height: 1.5`、リンク色のリセット、画像の `max-inline-size: 100%`、フォーム要素のリセットまで含むので、base 側で同じことを書かない。中身は `@layer` を持たないので、自分でレイヤーに入れられる（上記）。

`*` に対するグローバルリセットは、下位のカスケードレイヤーや Web Components から上書きできなくなるという指摘がある。要素型を指定する方が安全。

## ブレークポイント

### 単位

`em` で定義すると、ユーザーがブラウザのフォントサイズを変更した際に追従する。アクセシビリティ上の利点がある。

```scss
$breakpoints: (
  sm: 48em,  // 768px
  md: 64em,  // 1024px
  lg: 80em,  // 1280px
);
```

### モバイルファーストと実装順を揃える

SP → PC の順で実装するなら、CSSも `min-width` ベース（モバイルファースト）にすると記述順と一致する。SPの値を先に書き、`@include min-screen(md)` で上書きする形になる。

デスクトップファースト（`max-width`）だと、先に書いたPCの値が基本になり、実装順と逆になる。

実装は「プロジェクト共通の定義」を参照。

Stylelint の `media-feature-range-notation` が既定のままなら、`min-width` / `max-width` ではなく**範囲記法**（`width >= 64em`）で書く必要がある。mixin 一箇所で吸収されるので影響は小さい。

## プロジェクト共通の定義

**どの案件でも最初に用意する。** 逆に、これ以外は必要になるまで作らない。使われない mixin が溜まるより、都度足すほうがよい。

```scss
// function.scss
@use 'sass:math';

@function rem($size) {
  @return math.div($size, 16) * 1rem;
}
```

```scss
// mixin.scss
@mixin hover() {
  @media (any-hover: hover) {
    &:hover {
      @content;
    }
  }
}
```

```scss
// breakpoint.scss
@use 'sass:map';

$breakpoints: (
  // 案件ごとに定義する
);

@function get-breakpoint($name) {
  @if not map.has-key($breakpoints, $name) {
    @error 'ブレークポイント "#{$name}" は未定義です。定義済み: #{map.keys($breakpoints)}';
  }

  $min: map.get($breakpoints, $name);

  @if $min != 0 {
    @return $min;
  }

  @return null;
}

@mixin min-screen($name) {
  $min: get-breakpoint($name);

  @if $min {
    @media (width >= $min) {
      @content;
    }
  } @else {
    @content;
  }
}
```

### なぜこの形か

**`rem()` は基準を 16 に固定する** — rem はルート要素の `font-size` 基準なので、親要素で `font-size` を変えていても結果は変わらない。基準を引数で変えられるようにしても、使い道はルートの `font-size` を変えた場合だけで、それはブラウザのフォントサイズ設定を上書きするのでやらない。以前は第2引数 `$base` を持たせていたが、「親の font-size に合わせる」という誤った理由で使われうるので外した。親を基準にしたいなら `em` を使う。

**`hover()` は `any-hover` を使う** — `hover: hover` は主ポインタのみを見るため、タッチ操作が主でマウスも接続されている端末（タッチ対応ノートPCなど）でホバー効果が効かなくなる。`any-hover` はいずれかのポインタがホバー可能なら真になる。

`:hover` を直接書くと、タッチデバイスでタップ後にホバー状態が固着する。**mixin でラップすることを規約にする。**

**`get-breakpoint()` は未定義の名前を `@error` で止める** — `map.get()` は存在しないキーに `null` を返すため、ガードが無いと `min-screen(mdd)` のような typo が下の `@else` に落ち、**メディアクエリ無しで全画面幅に出力される**。エラーにならず見た目だけが崩れるので気づきにくい。

**`get-breakpoint()` が `0` を `null` として返す** — モバイルファーストの起点（`sm: 0` のようなエントリ）を、他と同じ `@include min-screen()` の書き方で扱えるようにする分岐。値が `0` ならメディアクエリで包まずそのまま出力する。書き分けが不要になる。

### 入れないもの

| 候補 | 理由 |
|---|---|
| カンプ幅基準の `vw` 変換（`vw-sp()` など） | 下記参照 |
| `clearfix` / `center` | flex / grid で足りる |
| `aspect-ratio` mixin | CSSプロパティで足りる |
| `line-clamp` | 使う箇所が出てから |

## サイズ指定

**カンプの px を `rem` に変換して使う。** カンプ幅を100%とした `vw` に全ての値を変換する手法（`vw-sp(300)` → `40vw`）は採らない。

一見、カンプの見た目が全画面幅で再現できて便利に見えるが、問題が多い。

- **`font-size` に使うと、ユーザーのブラウザのフォントサイズ設定に追従しない**（アクセシビリティ上の問題）
- 画面幅に完全比例するため、大画面で不必要に巨大化し、小さい画面では読めない大きさになる
- カンプ幅が変わると全ての値を計算し直すことになる
- 生成される値が `3.7333333333vw` のようになり、DevTools で追いにくい

幅の可変は `%` / `flex` / `grid` / `max-width` で吸収する。連続的に変えたい箇所だけ `clamp()` を個別に検討する。

## 変数の使い分け

| | 用途 |
|---|---|
| プリプロセッサ変数 | ビルド時に解決。mixin/function の引数、計算に使うもの |
| CSSカスタムプロパティ | 実行時に参照。色・フォントなど、DevToolsで確認・変更したいもの |

カスタムプロパティの命名は Stylelint の `custom-property-pattern` に従う（既定は kebab-case）。

### 既存の変数定義をコピーしない

過去案件から変数定義を持ち込むと、**未使用の変数やバグが紛れ込む。** 実際にあった例:

- `--width: $width;` — プリプロセッサ変数のインターポレーション（`#{}`）忘れ。値が文字列のまま出力される
- 別案件由来の未使用変数がそのまま残っている

使うものだけを新規に定義する。
