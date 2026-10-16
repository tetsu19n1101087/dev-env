# DESIGN.md・対応表・issue への反映

## DESIGN.md の構成

AI エージェントと人の両方が読むデザインシステムの文書。front matter（YAML）に機械可読なトークン、本文に使い方と理由を書く（entre-web の DESIGN.md が実例）。

```
---
colors:        # 主な用途別の色を hex で（primary, on-primary, background, ...）
typography:    # テキストスタイル（fontFamily, fontSize, fontWeight, lineHeight, letterSpacing は em）
rounded:
spacing:
components:    # button-primary などが colors / typography を参照
---
## Overview         トーン、実装の前提、トークンの出どころ（Figma が正、日付）
### 実装との差分     目標と現行コードのずれ（コードの置き換えは別タスク）
## Colors           3層の説明、主な色、ホバーの方針、対応表、コントラスト比、識別色、エラー表示
## Typography       フォント、サイズ、太さ、行の高さ、字間、テキストスタイル一覧、@theme の例
## Layout / 余白
## Elevation & Depth
## Shapes
## Components
## Do's and Don'ts
```

書き方の注意:

- 値は tokens.json（Figma に読み込んだもの）と同じにする。build.mjs の出力や一覧ページから写し、手で計算しない
- コントラスト比は build.mjs の計算結果を写す
- 「実装との差分」は、コードの現状を調べてから書く（フォント、使っている文字サイズ、太さ、余白、角丸、色、ボタンのサイズなど）
- 決定が変わったら、関連する節をまとめて直す（例: ボタンを半円にしたら Shapes、Components、front matter の rounded を同時に）

## Figma → CSS 変数の対応表

shadcn/ui の CSS 変数名はそのまま使い、値に用途別を入れる。DESIGN.md の Colors 節に表で置く。entre-web の例:

| CSS 変数 | Figma のバリアブル |
| --- | --- |
| `--background` | `bg/default` |
| `--foreground` | `text/default` |
| `--card` `--popover` | `bg/surface/default` |
| `--primary` / `--primary-foreground` | `bg/primary/default` / `text/primary/on-primary` |
| `--secondary` / `--secondary-foreground` | `bg/secondary/default` / `text/secondary/on-secondary` |
| `--muted` / `--muted-foreground` | `bg/default` / `text/muted` |
| `--accent` / `--accent-foreground` | `bg/surface/hover` / `text/default`（shadcn は ghost / outline のホバーに accent を使う） |
| `--destructive` | `bg/destructive/default` |
| `--border` / `--input` / `--ring` | `border/default` / `border/input` / `border/focus` |
| 追加（`--skeleton` など） | shadcn にない用途別 |

shadcn の `accent` をブランドのアクセント色として使っていると、ghost ボタンのホバーが派手な色になる。accent は「ホバーの面」として扱うのが安全。

## issue への反映

デザインシステムの作業を issue で追う場合（entre-web は GitHub issue #42）:

- 「コード」と「Figma」に節を分け、チェックリストにする
- 決定が変わったら本文の項目も直す（スタイル数、値、名前）。古い値のまま残すと、実装時に誤る
- 完了の判断: Figma 側は「読み込み済み」、コード側は「置き換え済み」でチェックする。読み込みをユーザーがしたか分からない場合は確認する
- 本文の編集は `gh issue edit <番号> --body-file <ファイル>` で行い、ファイルは一時フォルダに置く
