# 画像・アセット

根拠の詳細は `static-site-setup` skill の `references/assets.md`。

## 配置

| 種類                            | 置き場所                            | 扱い                                            |
| ------------------------------- | ----------------------------------- | ----------------------------------------------- |
| 写真・ラスタ画像（JPG / PNG）   | `src/assets/images/<セクション名>/` | Astro が AVIF / WebP に変換し、寸法属性を付ける |
| SVG・ファイル名を固定したいもの | `public/images/<セクション名>/`     | そのまま出力。寸法属性は手で書く                |
| favicon・OGP 画像               | `public/`                           | そのまま出力                                    |

`public/` のファイルは `import.meta.env.BASE_URL` を付けて参照する（`BASE` を設定したときに絶対パス直書きは 404 になる）。

```astro
<img src={`${import.meta.env.BASE_URL}images/hero/hero-icon-arrow.svg`} width="16" height="16" alt="" />
```

## 書き出し

- 実表示サイズの2倍で書き出す。SP/PC で共用するなら大きい方の2倍
- デザインツールのレイヤーではなく、配置されている元画像を取り出す
- 写真は JPG、図形・文字は PNG、アイコンは SVG。WebP / AVIF への変換はビルドに任せる

## 命名

`{セクション名}-{用途}-{バリエーション}.{拡張子}`。半角小文字・ケバブケース。

```
hero-bg.jpg
hero-bg-sp.jpg      # SP/PC で別画像のときだけ -sp / -pc を付ける
problem-icon-01.svg # 同じ用途が複数あれば 2桁ゼロ埋め
```

## `<Picture>` の書き方

```astro
---
import { Picture } from 'astro:assets';
import heroBg from '@/assets/images/hero/hero-bg.jpg';
---

<Picture src={heroBg} formats={['avif', 'webp']} layout="full-width" sizes="100vw" alt="" priority />
```

- `formats={['avif', 'webp']}` で `<source>` が2つ、フォールバックの `<img>` が元の形式で出力される
- `layout`（`constrained` / `full-width` / `fixed`）を指定すると `srcset` が自動生成される
- **`sizes` は明示する。** `layout` から自動生成された `sizes` は `<img>` にしか付かず、`<source>` には付かない。width 記述子の `srcset` に `sizes` が無いのは HTML の仕様違反で、markuplint がエラーにする（`html-standard/srcset-sizes-constraint`）。明示した `sizes` だけが `<source>` に伝播する
- **`priority` は LCP 候補の1枚だけに付ける。** `loading="eager"` / `decoding="sync"` / `fetchpriority="high"` がまとめて付く。それ以外の画像は既定の `loading="lazy"` のまま
- 出力ファイル名にはハッシュが付く（`hero-bg.DhrIoV9I_Z1qyX1h.avif`）。CMS への個別アップロードなどでファイル名を固定したい案件では、`public/` に置いて手で最適化する

## フォント

既定はシステムフォント（`variables.scss` の `--font-sans`）。Web フォントを使う場合:

- 見出しなど LCP に影響するものは同期読み込み、本文は非同期読み込み
- 外部配信なら `preconnect` を先に置く
- ローカルフォントへのフォールバックスタックを必ず残す
