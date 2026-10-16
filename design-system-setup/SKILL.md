---
name: design-system-setup
description: Web サイト・アプリのデザインシステム（色・文字・余白・角丸・コンポーネントのトークン）を作り、Figma のバリアブルとテキストスタイルに読み込み、DESIGN.md とコードの CSS 変数の対応表まで整える手順を提供する。ブランドカラーから階調（プリミティブ）を生成し、エイリアス → 用途別（bg / text / border）の3層に組み、コントラスト比を検証しながら決める。「デザインシステムを作りたい」「カラートークンを決めたい」「Figma のバリアブルを整理したい」「テキストスタイルを決めたい」「行の高さ・字間をどうする」「セマンティックカラー」「DESIGN.md を書きたい」「shadcn の CSS 変数と Figma を対応させたい」といった相談で使うのはもちろん、ブランドカラーの選定、色のコントラスト確認、Figma の Token Import 用 JSON の作成、tokens.json の編集をしようとしている場面では、明示的に「デザインシステム」と言われなくても必ず参照すること。
---

# デザインシステムの作成（Figma ⇄ DESIGN.md ⇄ コード）

## このスキルの中心にある考え方

**値は1か所（tokens.json）で決め、目で見て確かめてから Figma とドキュメントに流す。**

色や文字の値を Figma・DESIGN.md・コードでそれぞれ手で直すと、すぐに食い違う。しかもデザインの判断は「表で見て良さそう」でも、画面に並べると印象が違うことが多い。だから次の流れを崩さない。

1. 案件リポジトリの `design/tokens.json` を正にする
2. `scripts/build.mjs` で検証（参照の整合性・コントラスト比・行の高さ）し、一覧ページと Figma 用 JSON を生成する
3. 一覧ページを目で見て、ユーザーに確認を取ってから次へ進む
4. Figma に読み込み、DESIGN.md と対応表に反映する

実際にあった例（entre-web。`examples/entre-web/tokens.json` が確定値）:

- Material Theme Builder の書き出しは、`palettes`（階調）と `schemes`（役割の色）が一致しない。Builder の仕様で、scheme 側は別の補正がかかっている。`palettes` だけを使い、役割の割り当ては自分で決めた
- ブランドの青（#1B4965）をそのまま階調にすると、主要ボタンに使う段階がくすんで見えた。色相だけ借りて彩度を 40 に指定し直した（`palette.mjs hue`）
- 用途別の色がプリミティブを直接指していると、ブランド色の差し替えで用途別を全部直すことになる。間にエイリアス（`primary/600` など）を挟んだ
- `bg/muted` を「スケルトンなど」の曖昧な用途で作ったら使いどころが定まらず、`bg/skeleton` に置き換えた。用途を言い切れない色は作らない
- ボタンのラベルを label スタイルに相乗りさせたら、バッジや見出しラベルと要件が衝突した。ボタン専用の `button/*` 系統に分けた
- 字間を px のバリアブルで管理しようとしたが、Figma の字間・行の高さのバリアブルは px でしか紐づかず、文字サイズごとに値が変わる。バリアブルは作らず、スタイルに % を直接書き、コードでは em にした
- 読み込みプラグインは既存のバリアブルやスタイルを削除しない。名前を変えたり消したりしたものは Figma で手動削除が要る

## 進め方

**層ごとに区切り、決めては一覧ページで確認を取る。** 前の決定が後の選択肢を狭めるので、この順で進める。

1. **色** → `references/colors.md`
   - ブランドカラーと条件（白背景で 4.5:1 以上、他の識別色と区別できる など）
   - プリミティブ（階調）→ エイリアス（役割）→ 用途別（bg / text / border）
   - コントラスト比の基準と相手を用途別の各行に書く
2. **文字** → `references/typography.md`
   - フォント、サイズの段階、太さ、行の高さ、字間、テキストスタイルの系統と名前
3. **余白・角丸** → `references/typography.md` の末尾（スケールの決め方は文字と同じ考え方）
4. **コンポーネント**（ボタンのサイズ、バッジ、入力欄など）→ DESIGN.md の Components に書く
5. **Figma に読み込む** → `references/figma-import.md`
6. **DESIGN.md・対応表・issue に反映する** → `references/design-md.md`

各層で、決める前に「今の値」と「実装（コード）との差分」を調べておく。既存コードがある案件では、DESIGN.md の「実装との差分」に積んでおき、コードの置き換えは別タスクにする。

## ファイルの置き場所

案件リポジトリに置く（git で履歴を残し、DESIGN.md と並べて管理する）。

```
<案件>/
├── DESIGN.md
└── design/
    ├── tokens.json          # 正。手で編集するのはこれだけ
    └── dist/                # 生成物（コミットしてよい）
        ├── figma-tokens.json
        └── preview.html
```

tokens.json の形は `examples/entre-web/tokens.json` を雛形にする。各項目の意味は `references/colors.md` と `references/typography.md` にある。

## スクリプト

依存パッケージなしの Node（`palette.mjs` だけ material-color-utilities が要る）。スキルのディレクトリから直接実行する。

```bash
SKILL=~/workspace/dev-env/design-system-setup

# 検証と生成。問題があれば終了コード 1 で、一覧ページの冒頭にも表示される
node $SKILL/scripts/build.mjs design/tokens.json            # → design/dist/

# 階調の生成（結果の JSON を tokens.json の color.primitives に貼る）
node $SKILL/scripts/palette.mjs seed blue '#1B4965'
node $SKILL/scripts/palette.mjs hue blue '#1B4965' 40
node $SKILL/scripts/palette.mjs theme material-theme.json primary tertiary neutral-variant
```

build.mjs の検証内容:

- 用途別がエイリアス以外を参照していないか、エイリアスの参照先プリミティブが存在するか
- 用途別の各行で、`on`（重なる相手）とのコントラスト比が `min` を満たすか
- 用途別から使われないエイリアス（ロゴなど直接使うものは `aliasNotes` にメモすれば注意を出さない）
- テキストスタイルの行の高さ（文字サイズ × 倍率）が4の倍数か

## 確認の取り方

- 一覧ページ（`dist/preview.html`）は、ユーザーが見られる形で渡す。Artifact が使える環境なら公開し、同じ URL を更新し続ける（版が積み上がるので比較しやすい）
- 色や文字の候補を比べるときは、候補ごとに一覧ページの該当部分を並べ、数値（コントラスト比、px）を添えて選んでもらう
- 実際の画面に近い「当てはめた例」（ヘッダー、カード、ボタン、フォーム、フッター）があると判断が速い。案件ごとに一覧ページへ追加してよい（生成物ではなく別ファイルとして持つ）
