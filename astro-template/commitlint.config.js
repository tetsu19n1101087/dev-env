export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 日本語の件名では大文字小文字と句点のルールが意味を持たない
    'subject-case': [0],
    'subject-full-stop': [0],
    // 日本語は1文字あたりの情報量が多く、既定の72では足りない
    'header-max-length': [2, 'always', 100],
  },
};
