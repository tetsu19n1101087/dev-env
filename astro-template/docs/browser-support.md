# ブラウザサポート

**Browser Support:** 検証環境は各ブラウザの最新版のみ。Baseline Newly Available の機能はフォールバックなしで使用してよい。ポリフィルは導入しない。

案件の要件が違う場合（古い iOS Safari を含めるなど）は、この文書を書き換えてから実装する。新しい CSS / JS の機能を使うかどうかを、実装中に毎回判断しなくて済むようにするため。

## 使用している比較的新しい機能

| 機能                                        | 使用箇所             | Baseline                                                     |
| ------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| カスケードレイヤー（`@layer`）              | `src/styles/`        | Widely available                                             |
| メディアクエリの範囲記法（`width >= 64em`） | `min-screen()`       | Widely available                                             |
| `fetchpriority`                             | `<Picture priority>` | Newly available（2024-10）。未対応ブラウザでは無視されるだけ |
| `text-wrap: balance`                        | `Hero.astro`         | Newly available。未対応ブラウザでは通常の折り返し            |
| `text-autospace` / `text-spacing-trim`      | kiso.css             | 対応状況はブラウザにより異なる。未対応では無視されるだけ     |
