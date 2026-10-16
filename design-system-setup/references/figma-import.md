# Figma への読み込み

## 基本: Token Import プラグイン（~/workspace/figma-token-export）

自作の開発用プラグイン。`build.mjs` が出力する `dist/figma-tokens.json` はこのプラグイン向けの DTCG 形式。

### 初回の準備

1. Figma デスクトップ版でファイルを開く
2. 「Plugins」→「Development」→「Import plugin from manifest…」で `~/workspace/figma-token-export/import/manifest.json` を選ぶ

### 読み込みの手順（ユーザーの作業）

1. 「Plugins」→「Development」→「Token Import (DTCG)」を起動
2. `dist/figma-tokens.json` を選び、「解析」を押す
3. 差分（作成／更新／リネーム／変更なし／スキップ）を確認する。想定と違う件数なら適用しない
4. 「適用」を押す。Figma の「元に戻す」で取り消せる

依頼するときは、何件が「作成」「更新」になるはずかを伝える（例: 「label/lg が作成、label/md が更新になるはず」）。ユーザーが差分を見て判断できる。

### JSON の形とプラグインの挙動

- トップレベルのキーがコレクション名（`Typography`、`PrimitiveColor`、`AliasColor`、`SemanticColor`）。`styles.typography` がテキストスタイル
- 照合は「コレクション名＋バリアブル名」、スタイルは名前。一致すれば上書き、なければ作成
- **JSON にないバリアブル・スタイルは削除しない。** 名前を変えた・消したトークンは Figma に残るので、ユーザーに手動削除を頼む。コレクション名を変えた場合は、古いコレクションごと残る
- 参照（`{AliasColor.primary.600}` など）はバリアブルの参照として束縛される
- scopes: 素の DTCG では、既存のバリアブルを更新するときに scopes を変えない。`$extensions["com.figma"].resolvedType` を付けると、更新時も scopes が反映される（build.mjs は色のトークンに付けている）
- テキストスタイル:
  - `fontSize` `fontWeight` `fontFamily` は Typography のバリアブルを参照すると束縛される
  - `lineHeight` を数値で渡すと PERCENT（1.57 → 157%）
  - 字間は `$extensions["com.figma"].letterSpacing` に `{ "unit": "PERCENT", "value": 10 }` を書く。`$value.letterSpacing` に参照を書くと px のバリアブルとして束縛されるので使わない
  - フォントが Figma で使えないとスキップされる（解析で一覧に出る）

### 公開設定

ライブラリとして公開するなら、プリミティブを `hiddenFromPublishing` にする選択肢がある。scopes を空にしてあれば候補には出ないので、entre-web では設定しなかった。

## 代わり: Figma MCP（use_figma）【未検証】

プラグインを入れられない環境では、公式 Figma MCP の `use_figma` で Plugin API を実行し、バリアブルとテキストスタイルを作る方法がある。使う前に `figma:figma-use` スキルを読み込む（必須）。

- 方針: `dist/figma-tokens.json` を読み、コレクション → プリミティブ → エイリアス（`createVariableAlias`）→ 用途別の順に作成・更新する。scopes、テキストスタイルの行の高さ（PERCENT）・字間（PERCENT）も同じ値を設定する
- entre-web では試していない。手順を確立したら、このファイルを更新する

## Figma の内容を読むとき

- デスクトップ版の MCP（figma-desktop）は、Dev Mode の席や権限がないとファイルを読めなかった（entre-web で確認）
- 読めない場合は、Token Export プラグイン（`export/`）で書き出した JSON をもらうのが確実
