# TypeScript 設定

## 採用するかどうか

LP規模でJSがイベントリスナ数本程度なら、素のJSで足りることもある。ただし型があると、DOM APIの戻り値が `null` を含むことに気づけるなど、実装中の事故が減る。**エディタの補完が効く**という日常的な利点も大きい。

契約や社内規約で「開発過程でTypeScriptを使用し変換する」と定められている場合は、それに従う。

## 厳格度のプリセット

フレームワークがプリセットを提供している場合、それを `extends` するのが手堅い。中身は必ず読む — 何が有効になっているか把握せずに使うと、後でエラーの意味が分からなくなる。

```bash
cat node_modules/<framework>/tsconfigs/*.json
```

**厳格すぎるプリセットは、規模に対して摩擦が勝つことがある。** 特に以下の2つは、小〜中規模で記述量が目に見えて増える。

| オプション | 何が起きるか |
|---|---|
| `noUncheckedIndexedAccess` | 配列・オブジェクトの添字アクセスが `T \| undefined` になる。`items[0].name` のたびにガードが要る |
| `exactOptionalPropertyTypes` | オプショナルなプロパティに `undefined` を明示的に渡せない。`{ ogImage: undefined }` のような props の渡し方ができなくなる |

一方、以下は摩擦が小さく品質に効くので、必要に応じて個別に足す価値がある。

`noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns` / `noFallthroughCasesInSwitch` / `noImplicitOverride`

**方針:** 中庸なプリセット（`strict` 相当）をベースに、欲しいものを個別追加する。最初から最も厳格なものを選ぶと、抑制コメントが増えて結局効かなくなる。

## パスエイリアス

セクションをコンポーネントに分割すると `../../` が増える。エイリアスを張ると読みやすくなる。

```json
{
  "compilerOptions": {
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`moduleResolution: "Bundler"` なら `baseUrl` は不要。多くのフレームワークは tsconfig の `paths` をバンドラのエイリアスへ自動反映するので、ビルド設定側に重複して書かなくてよい。**反映されるかは実際に import して動くか確かめる。**

## include / exclude

**自分で `exclude` を書くと、プリセット側の `exclude` が上書きされて消える。** プリセットが除外していたもの（ビルド出力など）を併記する必要がある。

```json
{ "exclude": ["dist", "sample"] }
```

参考資料として支給された過去案件のコードなどをリポジトリに置いている場合、除外しないと型チェックの対象に入る。`allowJs` が有効だと `.js` も拾われるため、jQuery 等を含む資料は特に重い。

一方 `include` は**上書きしない方が安全**。フレームワークが生成する型定義ファイル（`.astro/types.d.ts` のようなもの）へのパスが含まれていることがあり、書き忘れると型が効かなくなる。

確認方法:

```bash
npx tsc --showConfig
```

継承後の最終的な設定が展開されて表示される。`include` / `exclude` が意図通りか、プリセットの値が消えていないかをここで確かめる。

## フレームワーク固有の実行環境に注意

コンポーネントのトップレベル（Astro の frontmatter、SSRのサーバー側コード）は**ビルド時にNode上で実行される**。`document` や `window` は存在しない。

```astro
---
// ここで new Accordion() すると ReferenceError: document is not defined
---
<script>
  import { Accordion } from '@/scripts/modules/accordion';
  new Accordion();  // ここはブラウザで動く
</script>
```

型エラーにはならず実行時に落ちるので、気づきにくい。DOM操作を伴うクラスの実体化はクライアント側スクリプトに置く。
