import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';

export default defineConfig([
  // .claude/ は worktree の置き場。含めると tsconfigRootDir が決まらず全ファイルがパースエラーになる。
  globalIgnores(['dist/', '.astro/', 'public/', '.claude/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    rules: {
      // 型の妥当性は astro check（tsc）の責務。素の no-undef はフレームワークのグローバル型を誤検知する。
      'no-undef': 'off',
    },
  },
]);
