# astro-template

静的サイト・LP 向けの Astro 開発環境テンプレート。`static-site-setup` skill の判断を具体化したもの。

## このテンプレートから始める

```bash
# private リポジトリの間はローカルからコピーする（保守用に install した node_modules などは除く）
rsync -a --exclude /node_modules --exclude /dist --exclude /.astro ~/workspace/dev-env/astro-template/ ~/workspace/<案件名>/
# public 化した後は
# npm create astro@latest -- --template tetsu19n1101087/dev-env/astro-template
```

コピー後のチェックリスト:

- [ ] `package.json` の `name` を案件名にする
- [ ] `astro.config.mjs` の `SITE` / `BASE` を設定する（未確定なら `AGENTS.md` の「現在の状況」に書く）
- [ ] `src/site.ts` のサイト名・説明文を設定する
- [ ] `public/favicon.svg` / `public/apple-touch-icon.png` / `public/ogp.png` を差し替える
- [ ] `src/components/Hero.astro` と `src/assets/images/hero/` を案件の実装に置き換える
- [ ] `src/styles/develop/breakpoint.scss` のブレークポイントをデザインに合わせる
- [ ] `AGENTS.md` の「現在の状況」と、この README を案件用に書き換える（下の「テンプレートの保守」は削除）
- [ ] `git init` → `npm install`（husky が Git フックを有効化する。`git init` より前に install した場合は `npx husky` を実行）
- [ ] `npm run verify` が通ることを確認する

GUI の Git クライアントからコミットするとフックで `npx: command not found` になる場合は `docs/setup.md` を参照。

## テンプレートの保守

### 普段の更新（依存の更新・設定の調整）

このディレクトリで直接作業してよい。

```bash
cd ~/workspace/dev-env/astro-template
npm install
npm run verify
```

- `.git` がこのディレクトリに無いため、husky は `.git can't be found` を出して何もしない。dev-env リポジトリの Git 設定は変わらない
- `node_modules/` / `dist/` / `.astro/` は `.gitignore` で除外済み
- 依存を更新するときは `static-site-setup` skill の `references/dependencies.md` の手順（`npm install --dry-run`、peer の確認）で検証してからバージョンを上げる。TypeScript を上げるときは `docs/decisions.md` の「バージョンの固定」も見直す
- `npm install-scripts ls` で未確認の install scripts が増えていないか確認する

### 展開手順の通し確認（Git フックを含む）

フックはこのディレクトリでは動かないので、一時コピーで利用者と同じ流れを通す。

```bash
tmp=$(mktemp -d) && rsync -a --exclude /node_modules --exclude /dist --exclude /.astro ./ "$tmp/app/" && cd "$tmp/app"
git init -q && npm install                # core.hooksPath が .husky/_ になる
git add -A && git commit -m "chore: 初回コミット"   # 成功する

printf '.badName { color: red; }\n' >> src/styles/base.scss
git commit -am "test: 違反"               # lint-staged（stylelint の selector-class-pattern）で失敗する
git checkout HEAD -- src/styles/base.scss

git commit --allow-empty -m "bad message" # commitlint（type-empty / subject-empty）で失敗する
git commit --allow-empty -m "docs: 日本語の件名で句点を付けても通る。"  # 成功する
```

違反の確認は初回コミットの後に行う。初回コミット前に失敗させると、`git checkout --` がインデックス（違反を含む）から復元してしまう。確認後に一時ディレクトリを削除する。
