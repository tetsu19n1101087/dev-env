import componentCss from './stylelint-plugins/component-css.js';

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard-scss', 'stylelint-config-html/astro', 'stylelint-config-recess-order'],
  plugins: [componentCss],
  rules: {
    // .astro の <style> は is:global + @layer components で書き、Block 名＝ファイル名で衝突を防ぐ（docs/css.md）
    'local/component-css': true,
    // FLOCSS 接頭辞 + Block（UpperCamel、コンポーネントのファイル名と一致）+ __element / --modifier（lowerCamel）
    // 例: .p-Hero / .p-Hero__ttl / .p-Hero__ttl--wide / .u-visuallyHidden / .is-active
    // js- は JS のフック専用でスタイルを当てないため、意図的に弾く
    'selector-class-pattern': [
      '^(?:[lcp]-[A-Z][A-Za-z0-9]*(?:__[a-z][A-Za-z0-9]*)?(?:--[a-z][A-Za-z0-9]*)?|u-[a-z][A-Za-z0-9]*|is-[a-z][A-Za-z0-9]*)$',
      {
        message: (selector) =>
          `"${selector}" は命名規則に違反しています。l-/c-/p-（Block は UpperCamel）、u-、is- のいずれかで始めてください（docs/css.md）`,
      },
    ],
  },
};
