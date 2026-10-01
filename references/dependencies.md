# 依存パッケージとバージョン選定

## まず現状を把握する

```bash
node -v && npm -v
```

Node のバージョンは、後で入れるパッケージの `engines` 要件と突き合わせる。バージョンマネージャ（nvm / mise / fnm / Volta）が複数入っていると、シェルによって参照される Node が違うことがある。`which -a node` で確認する。

## バージョンを決める

### 最新版が常に正解ではない

**メジャーバージョンが上がった直後は、周辺ツールが追随していないことがある。** 特に型システムやパーサに関わるものは影響が広い。

確かめ方:

```bash
# 候補パッケージの最新版を一覧
for p in <パッケージ名...>; do printf "%-24s %s\n" "$p" "$(npm view $p version 2>/dev/null)"; done

# メジャーごとの最新を見る
npm view <pkg> versions --json | node -e 'const v=JSON.parse(require("fs").readFileSync(0,"utf8"));[5,6,7].forEach(m=>console.log(m+".x:", v.filter(x=>x.startsWith(m+".")&&!x.includes("-")).pop()||"(なし)"))'

# リリース日（枯れ具合の判断材料）
npm view <pkg> time --json | node -e 'const t=JSON.parse(require("fs").readFileSync(0,"utf8"));["6.0.3","7.0.2"].forEach(v=>t[v]&&console.log(v, t[v].slice(0,10)))'
```

**実例:** TypeScript の最新メジャーを選ぼうとしたが、`typescript-eslint` の peer が `>=4.8.4 <6.1.0`、`@astrojs/check` が `^5.0.0 || ^6.0.0` で、どちらも新メジャーに未対応だった。ESLint 構成が丸ごと成立しなくなるため、両方の要件を満たす上限バージョンに落とした。

エコシステムの中心にいるツール（TypeScript、ESLint、フレームワーク本体）ほど、周辺の対応を先に確認する。

### peer dependency の衝突を先に潰す

**候補が固まったら、書く前にインストールできるか試す。**

```bash
mkdir -p /tmp/deps-check && cd /tmp/deps-check
cat > package.json <<'EOF'
{ "name": "deps-check", "private": true, "type": "module",
  "devDependencies": { "...": "..." } }
EOF
npm install --dry-run
```

`ERESOLVE` が出たら、そのメッセージに衝突元と要求バージョンが書かれている。

**衝突しても諦める前に `peerDependenciesMeta` を見る。** optional 指定されている peer は、入れなければ衝突しない。

```bash
npm view <pkg> peerDependencies peerDependenciesMeta
```

**実例:** `eslint-plugin-astro` が `eslint-plugin-jsx-a11y >= 6.10.2` を peer に持つ一方、その jsx-a11y は ESLint 9 までしか対応していなかった。`peerDependenciesMeta` を見ると optional 指定だったため、入れないことで解決した。プラグイン作者が「あると嬉しいが必須ではない」と考えている依存は、こうして外せる。

### engines を確認する

```bash
npm view <pkg> engines
```

Node の要件が現環境を上回っていると `EBADENGINE` 警告が出る。動くことも多いが、警告を放置すると本当の問題を見落とす。要件に合わせて Node を上げ、`.node-version` で固定する。

## Node のバージョン固定

```
24.20.0
```

`.node-version` は nvm / mise / fnm / Volta が共通で読む。特定のツールに依存しない分、チームで環境が揃っていなくても機能する。

`package.json` の `engines` は宣言のみで自動切り替えはしないが、警告は出る。併用してよい。

**バージョン管理ツールが `.node-version` を読むとは限らない。** mise は既定で読まず、
グローバル設定のバージョンに落ちる。`.node-version` を単一の真実にするなら明示的に有効化する。

```toml
# mise.toml
[settings]
idiomatic_version_file_enable_tools = ["node"]
```

バージョンの実体は `.node-version` 側に置いたままなので二重管理にならない。
`package.json` の `engines` でも下限を宣言しておく。

**実際にどれが使われているか必ず確認する。** 複数のツールが入っていると、意図しない方が
PATH で勝っていることがある。

```bash
which node && node -v
```



## dependencies と devDependencies

静的サイトは実行時にランタイム依存を持たないため、**フレームワーク本体以外はすべて devDependencies** に置ける。フレームワークを dependencies に置くかは、そのツールの慣例（`npm create <framework>` が生成する形）に合わせる。

判断に迷ったら「ビルド成果物に含まれるか」で分ける。含まれないなら devDependencies。

## 検証環境の後始末

`/tmp` に作った検証用ディレクトリは、判断が終わったら消してよい。ただし**検証で分かったこと（衝突の内容、選んだ理由）はドキュメントに残す。** 同じ調査を繰り返さないため。

## 脆弱性の指摘にどう対応するか

`npm audit` の指摘は、**まず直接依存か入れ子依存かを切り分ける**。入れ子依存なら自分では
バージョンを選べないため、対応方法が変わる。

```bash
npm audit
npm ls <パッケージ名>          # 誰が要求しているか
npm audit --omit=dev           # 納品物に影響するものだけ
```

### `npm audit fix --force` を鵜呑みにしない

npm の自動修正は「件数」でも「深刻度」でもなく、**semver で解決できるか**で動く。
メジャーの変更も辞さないため、**深刻度が上がる提案を平気で出す**。

実例。

```
現状      markuplint@4.18.3  →  low 4 / moderate 6（計10件）
--force   markuplint@4.11.5  →  high 4 を含む 9件      ← ダウングレード提案
```

4.11.5 が古い `minimatch` / `glob` を引き込むため、moderate を消すために high が増える。
**実行前に必ず提案内容（どのパッケージがどう変わるか）を読む。**

### `overrides` で揃える

入れ子依存だけが取り残されている場合、**他の依存が既に使っている版に揃える**のが安全。
バージョンを上げるのではなく、**ズレを直す**という見方をする。

```bash
npm ls postcss-selector-parser
# ├─┬ eslint-plugin-astro  └── postcss-selector-parser@7.1.6   ← 既にこの版
# └─┬ markuplint           └── postcss-selector-parser@7.1.1   ← ここだけ古い
```

```json
{
  "overrides": {
    "postcss-selector-parser": "^7.1.6",
    "uuid": "^13.0.2"
  }
}
```

揃えると `deduped` になり**インストールが1つに統合される**副次効果もある。
パッチ更新（13.0.0 → 13.0.2）ならメジャー据え置きで破壊的変更のリスクが無い。

**`overrides` は依存の解決を強制的に書き換えるので、壊れていないかの確認が要る。**
そのパッケージを実際に使う機能（今回ならセレクタ解析）が動くことを確かめる。

### devDependencies でも直しておく

`npm audit --omit=dev` が0件なら納品物には影響しない。それでも放置すると
**audit の出力が常に赤くなり、本当に危険なものが出たときに気づけなくなる**。
ノイズを消して信号を見えるようにする、という位置づけで対応する。

