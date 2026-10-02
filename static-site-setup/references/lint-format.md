# Lint / Format

## 全体の考え方

ツールごとに**責務を分ける**と設定が単純になる。

| ツール | 責務 |
|---|---|
| 型チェッカー（`tsc` / フレームワークのcheck） | 型の妥当性 |
| ESLint | JS/TSのロジック上の問題 |
| Stylelint | CSS/SCSSの記述とクラス命名 |
| Prettier | 整形 |
| markuplint | マークアップの妥当性とアクセシビリティ |

責務が重なると、片方を無効化する設定が増えて全体が読みづらくなる。

## ESLint

### 設定形式

ESLint 9 以降は flat config（`eslint.config.js`）のみ。eslintrc は使えない。ESM で書くため `package.json` に `"type": "module"` が要る。

本体が提供するヘルパを使う:

```js
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/', '<生成物ディレクトリ>/', '<参考資料ディレクトリ>/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  // フレームワーク用プラグインの flat config
  {
    rules: {
      'no-undef': 'off',
    },
  },
]);
```

`defineConfig` はネストした配列（プラグインが返す設定群）を自動で平坦化する。

### 厳格度の選択

`typescript-eslint` は複数の段階を用意している。有効ルール数を数えれば規模感がつかめる。

```bash
node --input-type=module -e '
import tseslint from "typescript-eslint";
const count = (name) => {
  const arr = tseslint.configs[name];
  const r = {};
  for (const c of (Array.isArray(arr) ? arr : [arr])) Object.assign(r, c.rules ?? {});
  return Object.entries(r).filter(([,v]) => v !== "off" && v !== 0).length;
};
for (const n of ["recommended","recommendedTypeChecked","strict","strictTypeChecked"]) console.log(n, count(n));
'
```

**型情報を使う設定（TypeChecked系）には副作用がある。** 採用前に実際に走らせて確認する。

- フレームワーク用パーサが `projectService` に非対応だと、ファイルごとに警告が出る
- **設定ファイル自身が誤検出される** — `eslint.config.js` は tsconfig の型情報を持たないため型が `error` 扱いになり、`no-unsafe-assignment` などが誤爆する。除外設定の追加が要る

TypeChecked の主戦力は Promise 系ルール（`no-floating-promises` など）。**非同期処理をほとんど書かないLPでは活きる場面が乏しい。** 必要になった時点で設定数行を足せば移行できるので、最初は素の recommended で始めてよい。

### `no-undef` は off にする

TSプロジェクトでは定石。素の `no-undef` はフレームワークが提供するグローバル型を誤検知するうえ、個別に除外する手段がない。**型の妥当性は型チェッカーの責務**として切り分ける。

`@eslint/js` の recommended は `no-undef: "error"` を含むため、後段で明示的に上書きする（`typescript-eslint` の recommended は `.ts` に対してのみ off にしており、`.js` / `.mjs` には効かない）。

副次的に、`globals` パッケージが不要になる。flat config には eslintrc の `env` が無く、グローバル変数を `languageOptions.globals` で渡す必要があるが、`no-undef` を切れば渡す相手がいなくなる。

### `eslint-config-prettier` は必要とは限らない

「Prettierと併用するなら入れるもの」と思われがちだが、**無効化する対象が存在しないなら不要。**

確かめ方:

```bash
node --input-type=module -e '
import prettierCfg from "eslint-config-prettier";
import { builtinRules } from "eslint/use-at-your-own-risk";
import js from "@eslint/js";
const off = Object.keys(prettierCfg.rules ?? {});
const core = off.filter(r => !r.includes("/"));
console.log("無効化対象:", off.length, "/ うちコアルール:", core.length);
console.log("現行ESLintに実在:", core.filter(r => builtinRules.has(r)).length);
const fmtRe = /semi|indent|quotes|spacing|comma-|paren|brace|newline/;
console.log("js recommended の整形系:", Object.keys(js.configs.recommended.rules ?? {}).filter(r => fmtRe.test(r)));
'
```

ESLint 8.53 以降、整形系ルールは deprecated になり recommended 系から外れている。**recommended だけを使う構成なら衝突は起きない。** ただし deprecated なルールは削除されずに残っているので、後から手動で整形ルールを足す場合は必要になる。

「入れておけば安全」で判断せず、無効化対象を数えてから決める。

## Stylelint

**flat config にはなっていない。** ESLint とは別路線で、従来通りのオブジェクト形式（`extends` / `rules` / `overrides` / `ignoreFiles`）。

```js
/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-recess-order'],
  ignoreFiles: ['dist/**', 'node_modules/**'],
  rules: {},
};
```

### クラス命名規則を強制する

`selector-class-pattern` を正規表現で上書きすると、**命名規約そのものをlintで担保できる。** 規約をドキュメントに書くだけでは守られないが、これなら機械的に防げる。

標準プリセットの既定は kebab-case（`^([a-z][a-z0-9]*)(-[a-z0-9]+)*$`）なので、BEMやキャメルケースを使うなら必ず衝突する。

```js
'selector-class-pattern': [
  '<正規表現>',
  { message: '<規約を説明するメッセージ>' },
],
```

**書いたら必ずテストする。** 通るべきパターンと弾かれるべきパターンを並べたSCSSを作り、実際に走らせる。

```scss
/* 通るべき */
.l-Header { color: #000; }
.c-Button__label { color: #000; }
/* 弾かれるべき */
.noPrefix { color: #000; }
.c-button { color: #000; }
```

### コンポーネント内のスタイルを検査する

`.astro` / `.vue` など、HTMLに近い形式のファイル内の `<style>` を検査するには専用のシンタックスが要る。`stylelint-config-html` が拡張子ごとに `customSyntax: "postcss-html"` を割り当てる（`postcss-html` が peer）。

コンポーネント内にスタイルを書かない設計なら不要。

### その他のプリセット由来ルールで衝突しやすいもの

- `custom-property-pattern` — カスタムプロパティの命名（既定は kebab-case）
- `scss/dollar-variable-pattern` — SCSS変数の命名
- `media-feature-range-notation` — 既定の `"context"` は `width <= 750px` 形式を要求し、`max-width` を弾く

既存コードから移植する場合は特に当たる。命名を新しく決め直すか、ルールを緩めるかを意識的に選ぶ。

## Prettier

### 適用範囲を決める

全部に効かせる必要はない。選択肢:

- ソース全体（CLIとエディタの両方）
- エディタのみ（CLIでは走らせない）
- **ビルド出力のみ**（納品するHTMLを整形する目的）

`.prettierrc` はエディタの拡張機能からも読まれるため、**CLIで対象を絞ってもエディタ経由でソースに効く。** この二重性を理解した上で範囲を決める。

### プラグインが要る形式に注意

フレームワーク固有のファイル形式（`.astro` など）は、プラグインが無いとCLIで整形できない。

```
[error] Couldn't resolve parser "astro".
```

エディタの言語拡張は内部にプラグインを持っていることが多く、**エディタでは動くのにCLIでは落ちる**という食い違いが起きる。CLIの対象からその拡張子を外すか、プラグインを入れるかを決める。

なお `prettier --write .` のように glob で回した場合、パーサが見つからない拡張子は**スキップされて続行する**（明示的にファイル指定した場合のみエラー）。この「黙って飛ばす」挙動が厄介で、`--check` が
`All matched files use Prettier code style!` と出しても、**その拡張子は一度も見られていない**。

```
$ prettier sample.astro            # ファイル指定 → エラーで気づける
[error] No parser could be inferred for file ".../sample.astro".

$ prettier --check .               # ディレクトリ指定 → 無言でスキップ、成功扱い
Checking formatting...
All matched files use Prettier code style!
```

`.prettierrc` の `overrides` に `parser: "astro"` を書いてあってもプラグイン本体が無ければ同じ。
**設定に parser 指定があること = 動いていること、ではない。**

### 効いているか実際に確かめる

適用範囲を決めたら、**その拡張子が本当に処理されたか**をファイル名で確認する。

```bash
npx prettier --check . 2>&1 | grep -c '\.astro'   # 0 なら一度も見ていない
npx prettier --write . --loglevel debug           # 処理したファイルが列挙される
```

実例として、次の3つが重なって「Prettier を入れたのに一度もソースに掛かっていなかった」状態があった。

- `.prettierrc` に `parser: "astro"` があるのにプラグイン未インストール
- `build` が `dist/**/*.html` にしか掛けておらず、`format` スクリプトが無い
- `lint-staged` に prettier が入っていない（eslint と stylelint の `--fix` だけ）

エディタでは Astro 拡張が内部プラグインで整形していたため、**人間の目には動いているように見えていた**。

### ignore で除外したものを、別の用途で整形したいとき

`format` / `format:check` はソース全体を対象にするので `.prettierignore` でビルド出力を除外する。
一方で **ビルド後のHTMLは整形したい**（納品物の可読性）という要求が同時にあることが多い。

このとき `build` 側の prettier は `.prettierignore` を無効化しないと**何も整形しない**。

```json
{
  "build": "astro build && prettier --write \"dist/**/*.html\" --ignore-path /dev/null",
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

`--ignore-path /dev/null` が無いと、`.prettierignore` の `dist/` が効いて**全ファイルを無視し、
出力ゼロ・exit 0 で空振り**する。エラーにならないので、未整形のHTMLをそのまま納品しうる。

**「除外」と「明示的に対象指定」は競合する。** ignore ファイルを書いたら、それを迂回したい
スクリプトが無いか確認する。

### printWidth の決め方

実際のマークアップで比較する。属性が多い要素は printWidth を上げても1行に収まらない（Prettier は1行に収まらないと全属性を展開する）ため、**差が出るのは属性が少ない要素だけ**。

既存の納品物があるなら行長の分布を測ると判断材料になる。

```bash
awk '{print length}' <file>.html | sort -n | awk '{a[NR]=$1} END{print "中央値:", a[int(NR*0.5)], "90%:", a[int(NR*0.90)]}'
```

## マークアップ・アクセシビリティの検査

markuplint はマークアップの妥当性とアクセシビリティを機械的に検査する。alt欠落、見出し順、ARIA誤用、`img` の寸法属性欠落などを検出できる。

### ソースかビルド後か

**ビルド後のHTMLを対象にする方が適している場合が多い。**

- テンプレート構文（フレームワーク独自の要素）を誤検出しない
- **ページ全体を見ないと判定できないルール**（見出しレベル、ランドマーク、`h1` の存在）が正しく働く。コンポーネントに分割されたソースでは断片しか見えず誤判定する
- 実際に納品するものを検査できる

代わりに、ビルドしないと検査できないため実行タイミングが後工程になる。pre-commit には載せられない。

**ソースを検査するためのパーサが本体に追随していないこともある。** `@markuplint/astro-parser@5.0.1` は `astro-eslint-parser@1.4.0` 経由で旧 Go 製コンパイラ（`@astrojs/compiler` 2/3 系）を使っており、Astro 7（`@astrojs/compiler-rs`）とは別物で `.astro` を解析する。peer 依存を宣言していないので npm は何も警告しない。依存ツリーで確かめる。

```bash
npm view @markuplint/astro-parser dependencies
npm view astro-eslint-parser@<その版> dependencies
```

### プリセットの中身を確認する

`recommended` が参照する個別プリセットの中には**空のものがある**。中身を読んでから採用する。

```bash
cat node_modules/@markuplint/config-presets/preset.*.json
```

`img` に `width`/`height` を要求する、`iframe` に `title`/`loading` を要求するといったルールは、CLS/LCP対策を機械的に担保できる。OGPを書く場合は `meta[property]` を許可するプリセットが要る（無いと `invalid-attr` で弾かれる）。

### `head-element-order` は OGP と相性が悪い（markuplint 5）

**症状:** OGP の `<meta property>` すべてと `description` に `要素「meta」は要素「meta」より前にしたほうがよいです` の警告が出る。どう並べ替えても消えない。

**原因:** 既定値は `meta` を **`name` 属性のアルファベット順**に並べる前提。`name` を持たない `meta[property]` は空文字として扱われ、先頭にあるべきと判定される。さらに `recommended` の中では `performance/head-element-order` という**名前付きのルール**として有効になっているので、`head-element-order` を設定しても既定値の方が別に走り続ける。

**対応:** 名前付きの方を無効化し、`meta[property]` を独立したグループにした順序を設定する。

```json
{
  "extends": ["markuplint:recommended"],
  "rules": {
    "performance/head-element-order": false,
    "head-element-order": {
      "value": [
        "meta[charset]", "meta[http-equiv]", "meta[name=\"viewport\"]", "title",
        { "selector": "meta[name]", "order": "alphabetical", "attr": "name" },
        "meta[property]", "link", "style", "script"
      ]
    }
  }
}
```

設定後、わざと順序を崩した HTML で警告が出ることを確かめる（無効化しただけになっていないか）。

既定値はルールの実装（`node_modules/@markuplint/rules/lib/head-element-order/index.js` の `DEFAULT_VALUE`）で確認できる。

### 静的解析だけでは足りない場合

markuplint のような静的解析は**そのHTMLファイル単体**しか見ない。次のものは検出できない。

- 実行時にJSが書き換えたDOM
- 他の仕組み（SSI / PHPインクルード / CMS）で**結合された後**の文書全体
- コントラスト比、実際の可視性、要素の寸法といった**計算しないと出ない値**

該当するなら、実ブラウザで axe を走らせる層を足す。

```bash
npm i -D puppeteer-core axe-core
```

**`puppeteer-core` はブラウザを同梱しない（約9MB）。** システムのChromeを `executablePath` で
指すだけで足りる。Playwright は150MB超のブラウザを落とすので、CI以外では過剰なことが多い。

```js
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
```

押さえるべき点。

- **結合後のページに対して実行する。** 見出しレベルの連続性・ランドマークの重複・aria の参照解決は
  文書全体でないと正しく判定できない。結合前に掛けると出る違反／消える違反が変わる
- **複数の画面幅で実行する。** axe は非表示要素をスキップするため、SP専用の要素は SP幅で走らせないと
  **検査対象にすらならない**。PC幅だけの実装は SP専用要素の違反を構造的に見逃す
- **準拠レベルで扱いを分ける。** 契約要件のレベルはエラー（exit 1）、目標どまりのレベルは警告、
  自分たちで直せない範囲（先方提供の共通パーツなど）も警告にする
- **`verify` には入れない。** サーバー起動が前提になり、通し検査が環境に依存する。独立コマンドにする
- **axe の自動検出は WCAG 問題の3〜4割程度。** 「違反0件」は準拠の証明にならない。
  キーボード操作・フォーカス順序・読み上げ順序は手動確認が要る旨を、実行時の出力にも書いておく
- **`incomplete`（判定できなかったもの）も出力する。** 背景画像の上に置いた文字のコントラストは axe が計算できず、
  `violations` ではなく `incomplete` に入る。`violations` だけを見ていると、LP で最も多い「画像の上の白文字」が
  一度も確認されないまま「違反0件」になる
- **検査スクリプト自体が違反を検出できるか確かめる。** 違反を仕込んだページ（alt の無い `img`、`lang` の無い `html`、
  SP 幅でだけ表示される空の `button`）を置いて、エラーになること・画面幅ごとに結果が変わること・exit 1 になることを見る

### 納品物そのものを検査する

lint が見ないもののうち、**気づかないまま納品すると事故になるもの**だけをスクリプトにする。

- 納品してはいけないファイルの混入（開発用の素材、先方提供の共通パーツなど）
- 納品物の中を指す参照（画像・CSS・JS）の実在。markuplint は参照先の実在までは見ない

**シェルの削除処理は、空振りしても成功する。**

```json
"build": "astro build && rm -rf dist/campaign/ohgonwagyucp202610/shared && ..."
```

この形はパスを文字列で直書きしており、設定側の値と**二重管理**になる。片方だけ変えると
`rm` が対象を見失うが、**`rm -rf` は存在しないパスでもエラーにせず exit 0** で通るため
`&&` が繋がり、ビルドは成功したまま不要物が残る。

```json
"build": "astro build && rm -rf dist/campaign/*/shared && ..."
```

パスから可変部分を消すか、設定から組み立てる。**そのうえで「消えたこと」を検査する。**
削除処理の成否に頼らない。

支給待ちで参照だけ先に置いているものは、**許容リストに明示して毎回警告を出す**。
「未支給だから落ちる」を放置すると検査自体が無視されるようになる。リストが空になるのが正しい状態。

### 開発者向けのコメントが納品物に残る

**症状:** 納品 HTML に「LCP 候補なので priority を付ける」のような実装メモが残っている。

**原因:** Astro のテンプレート部分（frontmatter の外）に書いた `<!-- -->` は、HTML のコメントとしてそのまま出力される。frontmatter 内の `//` や、テンプレート内の `{/* */}`（JSX 式のコメント）は出力されない。

**確かめ方と対応:**

```bash
grep -c '<!--' dist/**/*.html   # 意図したコメント（SSI など）以外が 0 か
```

開発者向けのメモは `{/* */}` で書く。既存サイトのインクルード（`<!--#include -->`）のように**出力が必要なコメント**とは区別する。

## pre-commit フック

ステージされたファイルだけを対象にすると速い。

```json
{
  "scripts": { "prepare": "husky" },
  "lint-staged": {
    "*.{js,mjs,ts}": "eslint --fix",
    "*.{css,scss}": "stylelint --fix"
  }
}
```

`.husky/pre-commit` に `npx lint-staged` を書く。

**`prepare` は Git リポジトリでないと何もしない。** husky 9 は**カレントディレクトリに `.git` があるか**を最初に確かめ、無ければ `.git can't be found` と出して終わる（exit 0 なので `npm install` は失敗しない）。リポジトリ化前に `npm install` した場合は、`git init` 後に `npx husky` を実行する。

この確認は「カレントに `.git` があるか」なので、**別リポジトリのサブディレクトリ（モノレポやテンプレート置き場）で `npm install` しても、親リポジトリの `core.hooksPath` は書き換わらない。** 代わりにフックも有効にならないので、フックの動作確認は一時コピーで `git init` してから行う。

`--fix` を付けると、修正内容が自動で再ステージされコミットに含まれる。修正できないエラーがあればコミットが中止され、作業ツリーは元の状態に復元される。**両方向とも実際に試して確認する。**

### Prettier と lint の --fix を併用するときの順序

同じファイルに両方を掛けるなら、**lint の `--fix` を先、Prettier を後**にする。配列で書くと順に実行される。

```json
{
  "lint-staged": {
    "*.{js,mjs,ts}": ["eslint --fix --no-warn-ignored", "prettier --write"],
    "*.scss": ["stylelint --fix", "prettier --write"],
    "*.astro": ["eslint --fix --no-warn-ignored", "stylelint --fix", "prettier --write"],
    "*.{json,md}": "prettier --write"
  }
}
```

逆順だと lint の `--fix` が整形を崩し、次のコミットで Prettier が差分を出す。
`eslint-config-prettier` を入れていても、**`--fix` が生成するコードの形まで揃うわけではない**。

### GUIのGitクライアントでフックが落ちる

**Gitフックは対話シェルの設定（`.zshrc` / `.bashrc`）を読まない。** VS Code の Source Control、
Tower、Fork などからコミットすると、バージョン管理ツール（mise / nvm / nodenv / Volta）で
入れた node に PATH が通らず `npx: command not found`（exit 127）で弾かれる。

husky 9 はフック実行前に **`~/.config/husky/init.sh`** があれば読み込む。ここで PATH を補う。

```sh
# nvm の例。バージョンを上げても壊れないよう alias/default から引く
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -f "$NVM_DIR/alias/default" ]; then
	nvm_default=$(cat "$NVM_DIR/alias/default")
	nvm_bin=$(ls -d "$NVM_DIR/versions/node/v$nvm_default"* 2>/dev/null | sort -V | tail -1)/bin
	[ -d "$nvm_bin" ] && export PATH="$nvm_bin:$PATH"
fi
```

```sh
# mise / nodenv / Volta は shims が固定パスなので1行で足りる
export PATH="$HOME/.local/share/mise/shims:$PATH"
```

**リポジトリ外の個人設定なので各自で行う。** マシンごとにツールもパスも違うため、リポジトリには入れられない。
READMEに手順を書いておく。ターミナルからコミットする人には不要。

**husky 8 → 9 の移行時に踏みやすい。** 8 までは `~/.huskyrc` が同じ役割だったが、9 は読まず
警告を出すだけ。「今まで動いていたGUIコミットが急に落ちる」という形で出て、警告文には
原因が書かれていない。8系のプロジェクトと併用するなら両方置く。

ビルドが必要な検査（markuplint など）は pre-commit に載せられない。日常の `lint` と、納品前の通し検査（`verify`）を分けるとよい。

```json
{
  "lint": "npm run lint:es && npm run lint:style",
  "verify": "npm run build && npm run check && npm run lint && npm run format:check && npm run lint:markup"
}
```

## ignore 対象を揃える

各ツールで別々に指定するため、揃えておくと「どこを見ないか」を一箇所で把握できる。

- ビルド出力
- フレームワークが生成する型定義ディレクトリ
- 参考資料として置いている過去案件のコード
- `node_modules`
- **git worktree を作る場所**（`.claude/worktrees/` など）

### リポジトリ内に worktree を置くなら必ず除外する

`eslint .` や `prettier --write .` のように**リポジトリ全体を対象にする書き方**をすると、
リポジトリ配下に作った git worktree まで巻き込む。worktree は同じリポジトリの別チェックアウトなので、
実害が2つ出る。

- **Prettier が他ブランチの作業ツリーを書き換える。** 先方提供のベンダーファイルまで整形され、
  別セッション・別担当者の作業が壊れる
- **ESLint が worktree 内の `tsconfig.json` を候補に拾い、`tsconfigRootDir` が決まらず全ファイルが
  パースエラーになる**

```
Parsing error: No tsconfigRootDir was set, and multiple candidate TSConfigRootDirs are present:
 - /path/to/repo
 - /path/to/repo/.claude/worktrees/foo
 - /path/to/repo/.claude/worktrees/bar
```

対象を明示列挙していた頃は起きず、`eslint .` に変えた瞬間に出る。**スクリプトの対象を
広げるときは、ignore の見直しをセットで行う。**

```js
// eslint.config.js
globalIgnores(['dist/', '.astro/', 'public/', '.claude/'])
```

ローカルにだけ置いている参考コード（git管理外）が引っかかる場合は、共有設定に書かず
ローカルで除外を足して `git update-index --skip-worktree` で追跡から外す。

**ディレクトリ名と拡張子が紛らわしいケースに注意。** `.astro/**`（生成物ディレクトリ）は `*.astro`（コンポーネントファイル）にマッチしないが、パターンだけ見ると誤解しやすい。実際に検査対象ファイル一覧を出して確認する。

```bash
npx eslint . --format json | node -e 'JSON.parse(require("fs").readFileSync(0,"utf8")).forEach(f=>console.log(f.filePath))'
```
