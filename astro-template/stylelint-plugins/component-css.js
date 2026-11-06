// コンポーネント CSS のルール（docs/css.md「コンポーネント CSS のルール」）を強制するローカルプラグイン。
// scoped style を使わず is:global + @layer components で書くため、クラス名の衝突と漏れをここで防ぐ。
//
// .astro の <style> ごとに次を検査する（.scss ファイルは対象外）:
// - src/pages/ には <style> を書かない
// - <style> には is:global を付ける
// - 中身はトップレベルの @layer components {} ひとつで囲む
// - クラスは自分の Block（ファイル名と一致）とその Element / Modifier、is- だけ
// - レイヤー直下のルールは自分の Block から始める
// - タグの子孫セレクタ（.p-Hero a）を書かない。子コンポーネントの中まで効いてしまうため
import path from 'node:path';
import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

const ruleName = 'local/component-css';

const messages = ruleMessages(ruleName, {
  styleInPage: () => 'src/pages/ には <style> を書かない。スタイルはコンポーネントに書く（docs/css.md）',
  notGlobal: () => '<style> に is:global を付ける。scoped にすると data-astro-cid が納品 HTML に出る（docs/css.md）',
  notLayered: () => '<style> の中身は @layer components { ... } ひとつで囲む（docs/css.md）',
  notStartWithBlock: (selector, blocks) =>
    `"${selector}" は自分の Block（${blocks}）から始める。Block 名はファイル名と一致させる（docs/css.md）`,
  foreignClass: (cls, blocks) =>
    `".${cls}" は他の Block のクラス。自分の Block（${blocks}）か is- のクラスだけを書く。子の配置は Mix で調整する（docs/css.md）`,
  typeSelector: (selector) =>
    `"${selector}" はタグセレクタを含む。子コンポーネントの中まで効くので、クラスを付けて狙う（docs/css.md）`,
});

const meta = {
  url: 'docs/css.md',
};

/** ファイル名（site-header / SiteHeader）を UpperCamel にする */
const toUpperCamel = (name) =>
  name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');

/** ファイルの場所から、書いてよい Block 名を決める。null は <style> 自体を禁止 */
const allowedBlocks = (file) => {
  const normalized = file.split(path.sep).join('/');
  const name = toUpperCamel(path.basename(file, '.astro'));
  if (normalized.includes('/src/pages/')) return null;
  if (normalized.includes('/src/layouts/')) return [`l-${name}`];
  return [`p-${name}`, `c-${name}`];
};

/** <style ...> タグの属性文字列。postcss-html は直前の HTML を raws.codeBefore に持つ */
const styleAttributes = (root) => /<style\b([^>]*)>\s*$/i.exec(root.raws.codeBefore ?? '')?.[1] ?? '';

const hasDirective = (attributes, name) => new RegExp(`(?:^|\\s)${name}(?:[\\s=/]|$)`).test(attributes);

const belongsTo = (cls, block) => cls === block || cls.startsWith(`${block}__`) || cls.startsWith(`${block}--`);

/**
 * セレクタからクラス名と、タグセレクタの有無を取り出す。
 * postcss-selector-parser は stylelint の推移的依存なので使わず、必要な範囲だけを字句で見る。
 */
const scanSelector = (selector) => {
  let rest = selector
    .replace(/#\{[^}]*\}/g, ' ') // SCSS の補間
    .replace(/(["'])(?:\\.|(?!\1).)*\1/g, ' ') // 文字列
    .replace(/\[[^\]]*\]/g, ' ') // 属性セレクタ
    .replace(/::?(?:nth-[\w-]+|lang|dir|state)\([^)]*\)/g, ' '); // 引数がセレクタでない擬似クラス

  const classes = [];
  rest = rest.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, cls) => {
    classes.push(cls);
    return ' ';
  });

  rest = rest
    .replace(/&[\w-]*/g, ' ') // 親参照と、&__ttl のような接尾辞
    .replace(/%[\w-]+/g, ' ') // プレースホルダ
    .replace(/#[\w-]+/g, ' ') // ID
    .replace(/::?[\w-]+/g, ' '); // 擬似クラス・擬似要素の名前（:not( の中身は残す）

  const hasType = /(?:^|[\s>+~(,])(?:[a-zA-Z][\w-]*|\*)/.test(rest);
  return { classes, hasType };
};

const isInKeyframes = (rule) => {
  for (let node = rule.parent; node; node = node.parent) {
    if (node.type === 'atrule' && /keyframes$/i.test(node.name)) return true;
  }
  return false;
};

/** ルールの祖先にルールがあるか（ネストされたセレクタか） */
const hasRuleAncestor = (rule) => {
  for (let node = rule.parent; node; node = node.parent) {
    if (node.type === 'rule') return true;
  }
  return false;
};

/** @type {import('stylelint').Rule} */
const rule = (primary) => (root, result) => {
  if (!validateOptions(result, ruleName, { actual: primary })) return;

  const file = root.source?.input?.file;
  if (!file || !file.endsWith('.astro')) return;
  // style="" 属性はスコープと無関係なので見ない
  if (root.source.inline) return;

  // is:inline は Astro が処理もスコープ化もせずそのまま出力する（Layout のレイヤー順序の宣言など）
  const attributes = styleAttributes(root);
  if (hasDirective(attributes, 'is:inline')) return;

  const blocks = allowedBlocks(file);
  if (blocks === null) {
    report({ ruleName, result, node: root, message: messages.styleInPage() });
    return;
  }

  if (!hasDirective(attributes, 'is:global')) {
    report({ ruleName, result, node: root, message: messages.notGlobal() });
  }

  const contents = root.nodes.filter((node) => node.type !== 'comment');
  const layered =
    contents.length === 1 &&
    contents[0].type === 'atrule' &&
    contents[0].name === 'layer' &&
    contents[0].params.trim() === 'components';
  if (contents.length > 0 && !layered) {
    report({ ruleName, result, node: contents[0], message: messages.notLayered() });
  }

  // 1ファイルの中では p- / c- を混ぜない。最初に出てきた Block に揃える
  let block = null;
  const blockLabel = () => block ?? blocks.join(' / ');

  root.walkRules((ruleNode) => {
    if (isInKeyframes(ruleNode)) return;
    const nested = hasRuleAncestor(ruleNode);

    for (const selector of ruleNode.selectors) {
      const trimmed = selector.trim();
      const { classes, hasType } = scanSelector(trimmed);

      if (!nested) {
        const first = /^\.(-?[_a-zA-Z][\w-]*)/.exec(trimmed)?.[1];
        const matched = first && (block ? [block] : blocks).find((b) => belongsTo(first, b));
        if (!matched) {
          report({
            ruleName,
            result,
            node: ruleNode,
            message: messages.notStartWithBlock(trimmed, blockLabel()),
            word: trimmed,
          });
          continue;
        }
        block ??= matched;
      }

      for (const cls of classes) {
        if (cls.startsWith('is-')) continue;
        const own = (block ? [block] : blocks).find((b) => belongsTo(cls, b));
        if (!own) {
          report({
            ruleName,
            result,
            node: ruleNode,
            message: messages.foreignClass(cls, blockLabel()),
            word: `.${cls}`,
          });
        } else {
          block ??= own;
        }
      }

      if (hasType) {
        report({ ruleName, result, node: ruleNode, message: messages.typeSelector(trimmed), word: trimmed });
      }
    }
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
