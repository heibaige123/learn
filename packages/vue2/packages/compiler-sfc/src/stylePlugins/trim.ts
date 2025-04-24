import { PluginCreator } from 'postcss'

/**
 * 一个 PostCSS 插件，用于修剪规则和 at-rule 的前后空白。
 *
 * @remarks
 * 该插件会遍历所有的规则和 at-rule，并将其 `raws.before` 和 `raws.after` 属性设置为换行符。
 *
 * @returns 一个包含 `postcssPlugin` 名称和 `Once` 方法的对象。
 *
 * @example
 * ```typescript
 * import postcss from 'postcss';
 * import trimPlugin from './trim';
 *
 * const result = await postcss([trimPlugin]).process(css, { from: undefined });
 * console.log(result.css);
 * ```
 */
const trimPlugin: PluginCreator<{}> = () => {
  return {
    postcssPlugin: 'vue-sfc-trim',
    Once(root) {
      root.walk(({ type, raws }) => {
        if (type === 'rule' || type === 'atrule') {
          if (raws.before) raws.before = '\n'
          if ('after' in raws && raws.after) raws.after = '\n'
        }
      })
    }
  }
}

trimPlugin.postcss = true
export default trimPlugin
