# 環境・運用

根拠の詳細は `static-site-setup` skill の `references/dependencies.md` / `references/git-editor.md` / `references/lint-format.md`。

## Node

- バージョンは `.node-version` と `.nvmrc` の両方に同じ値を書く
  - **nvm は `.nvmrc` しか読まない**（0.40.4 で確認。`.node-version` は無視される）
  - fnm / GitHub Actions の `setup-node` は `.node-version` を読む
  - Volta は `.node-version` を読まない（`package.json` の `volta` フィールドを使う）
  - mise は既定で `.node-version` を読まないので、使う場合は `idiomatic_version_file_enable_tools = ["node"]` を設定する
- `package.json` の `engines` で `^24.16.0`（24 系の 24.16 以上）を宣言している。`eslint-plugin-astro` / `astro-eslint-parser` が `^22.22.3 || ^24.16.0 || >=26.3.0`（25 系を除外）、markuplint が `>=24` を要求するため
- 実際に使われている Node は `which node && node -v` で確認する

## npm と install scripts

npm 11 では、依存パッケージの install scripts（`preinstall` / `install` / `postinstall`）は**既定でブロックされる**。`package.json` の `allowScripts` に記載が無いものは無言でスキップされ、インストールの最後に警告が出る。

このテンプレートでは次の3つを明示的に拒否（`false`）している。いずれもスクリプトが無くても動作することを確認済み。

| パッケージ        | スクリプトの中身                                                  | 拒否してよい理由                                                                        |
| ----------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `esbuild`         | プラットフォーム別バイナリの確認・JS シムの差し替え               | バイナリは optionalDependencies（`@esbuild/darwin-arm64` 等）で入る                     |
| `@parcel/watcher` | `npm_config_build_from_source=true` のときだけ `node-gyp rebuild` | 通常は何もしない。バイナリは optionalDependencies で入る                                |
| `fsevents`        | macOS 用ファイル監視のネイティブモジュールのビルド                | ビルド済みの `fsevents.node` が同梱されている。vite の optional 依存で macOS でのみ入る |

確認した内容: `astro build` が通る、`astro dev` で SCSS の変更がページ再読み込み無しで反映される（HMR）。

依存を追加して新しい警告が出たら、`npm install-scripts ls` で一覧を見て、中身を読んでから `approve` / `deny` を決める。`approve` は既定で `pkg@1.2.3` のように版を固定して書き込むので、更新のたびに再確認になる。

## Git フック

husky + lint-staged + commitlint。

- **pre-commit**: ステージしたファイルに `eslint --fix` / `stylelint --fix` → `prettier --write` の順で掛ける（lint の修正後に整形しないと、次のコミットで Prettier の差分が出る）
- **commit-msg**: Conventional Commits。日本語向けに `subject-case` / `subject-full-stop` を無効化し、`header-max-length` を 100 に緩めている
- markuplint はビルドが必要なので pre-commit には載せない。`npm run verify` で確認する

### GUI の Git クライアントでフックが落ちる

Git フックは `.zshrc` などを読まないため、VS Code の Source Control や Fork からコミットすると nvm / mise の node に PATH が通らず `npx: command not found` で失敗する。husky 9 はフック実行前に `~/.config/husky/init.sh` を読むので、そこで PATH を補う（各自のマシンで設定する）。

```sh
# nvm の場合
NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -f "$NVM_DIR/alias/default" ]; then
	nvm_default=$(cat "$NVM_DIR/alias/default")
	nvm_bin=$(ls -d "$NVM_DIR/versions/node/v$nvm_default"* 2>/dev/null | sort -V | tail -1)/bin
	[ -d "$nvm_bin" ] && export PATH="$nvm_bin:$PATH"
fi
```

```sh
# mise の場合
export PATH="$HOME/.local/share/mise/shims:$PATH"
```

## CI

`.github/workflows/verify.yml`。全ブランチの push で `npm ci` → `npm run verify` を実行する。Node は `.node-version` から読む。

axe（`npm run test:a11y`）はサーバー起動とブラウザが必要なので CI には入れていない。

## 開発サーバー

Astro 7 の `astro dev` はバックグラウンドで常駐する。

```bash
npx astro dev status   # 状態
npx astro dev logs     # ログ
npx astro dev stop     # 停止
```
