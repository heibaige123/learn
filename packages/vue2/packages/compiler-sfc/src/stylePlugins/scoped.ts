import { PluginCreator, Rule, AtRule } from 'postcss'
import selectorParser from 'postcss-selector-parser'

/**
 * 用于匹配 CSS 中的 `animation-name` 属性名称的正则表达式。
 * 支持匹配带有前缀的 `animation-name`，例如 `-webkit-animation-name`。
 */
const animationNameRE = /^(-\w+-)?animation-name$/
/**
 * 用于匹配 CSS 动画属性名称的正则表达式。
 * 支持匹配标准的 `animation` 属性以及带有前缀的动画属性（例如 `-webkit-animation`）。
 */
const animationRE = /^(-\w+-)?animation$/

/**
 * PostCSS 插件，用于处理 Vue SFC 的 scoped 样式。
 * @param id - 作用域 ID，默认为空字符串。
 */
const scopedPlugin: PluginCreator<string> = (id = '') => {
  /**
   * 用于存储 keyframes 的映射表。
   * 键为原始 keyframe 名称，值为带有作用域 ID 的 keyframe 名称。
   */
  const keyframes = Object.create(null)

  /**
   * 从作用域 ID 中移除 `data-v-` 前缀，得到简短的 ID。
   */
  const shortId = id.replace(/^data-v-/, '')

  return {
    /**
     * 插件名称。
     */
    postcssPlugin: 'vue-sfc-scoped',

    /**
     * 处理每个 CSS 规则。
     * @param rule - 当前的 CSS 规则。
     */
    Rule(rule) {
      processRule(id, rule)
    },

    /**
     * 处理每个 CSS @规则。
     * @param node - 当前的 @规则节点。
     */
    AtRule(node) {
      if (
        /-?keyframes$/.test(node.name) &&
        !node.params.endsWith(`-${shortId}`)
      ) {
        // 注册 keyframes
        keyframes[node.params] = node.params = node.params + '-' + shortId
      }
    },

    /**
     * 在所有节点处理完成后执行。
     * @param root - 当前的 CSS 根节点。
     */
    OnceExit(root) {
      if (Object.keys(keyframes).length) {
        // 如果在 <style> 中发现 keyframes，则查找并重写动画名称
        // 在声明中。
        // 注意：这仅适用于 keyframes 和动画规则在同一个
        // <style> 元素中的情况。
        // 单独的 animation-name 声明
        root.walkDecls(decl => {
          if (animationNameRE.test(decl.prop)) {
            decl.value = decl.value
              .split(',')
              .map(v => keyframes[v.trim()] || v.trim())
              .join(',')
          }
          // 简写形式
          if (animationRE.test(decl.prop)) {
            decl.value = decl.value
              .split(',')
              .map(v => {
                const vals = v.trim().split(/\s+/)
                const i = vals.findIndex(val => keyframes[val])
                if (i !== -1) {
                  vals.splice(i, 1, keyframes[vals[i]])
                  return vals.join(' ')
                } else {
                  return v
                }
              })
              .join(',')
          }
        })
      }
    }
  }
}

/**
 * 一个用于存储已处理规则的弱引用集合。
 * 通过 WeakSet 来避免内存泄漏，因为它不会阻止其包含的对象被垃圾回收。
 */
const processedRules = new WeakSet<Rule>()

function processRule(id: string, rule: Rule) {
  if (
    processedRules.has(rule) ||
    (rule.parent &&
      rule.parent.type === 'atrule' &&
      /-?keyframes$/.test((rule.parent as AtRule).name))
  ) {
    return
  }
  processedRules.add(rule)
  rule.selector = selectorParser(selectorRoot => {
    selectorRoot.each(selector => {
      rewriteSelector(id, selector, selectorRoot)
    })
  }).processSync(rule.selector)
}

function rewriteSelector(
  id: string,
  selector: selectorParser.Selector,
  selectorRoot: selectorParser.Root
) {
  let node: selectorParser.Node | null = null
  let shouldInject = true
  // find the last child node to insert attribute selector
  selector.each(n => {
    // DEPRECATED ">>>" and "/deep/" combinator
    if (
      n.type === 'combinator' &&
      (n.value === '>>>' || n.value === '/deep/')
    ) {
      n.value = ' '
      n.spaces.before = n.spaces.after = ''
      // warn(
      //   `the >>> and /deep/ combinators have been deprecated. ` +
      //     `Use :deep() instead.`
      // )
      return false
    }

    if (n.type === 'pseudo') {
      const { value } = n
      // deep: inject [id] attribute at the node before the ::v-deep
      // combinator.
      if (value === ':deep' || value === '::v-deep') {
        if (n.nodes.length) {
          // .foo ::v-deep(.bar) -> .foo[xxxxxxx] .bar
          // replace the current node with ::v-deep's inner selector
          let last: selectorParser.Selector['nodes'][0] = n
          n.nodes[0].each(ss => {
            selector.insertAfter(last, ss)
            last = ss
          })
          // insert a space combinator before if it doesn't already have one
          const prev = selector.at(selector.index(n) - 1)
          if (!prev || !isSpaceCombinator(prev)) {
            selector.insertAfter(
              n,
              selectorParser.combinator({
                value: ' '
              })
            )
          }
          selector.removeChild(n)
        } else {
          // DEPRECATED usage in v3
          // .foo ::v-deep .bar -> .foo[xxxxxxx] .bar
          // warn(
          //   `::v-deep usage as a combinator has ` +
          //     `been deprecated. Use :deep(<inner-selector>) instead.`
          // )
          const prev = selector.at(selector.index(n) - 1)
          if (prev && isSpaceCombinator(prev)) {
            selector.removeChild(prev)
          }
          selector.removeChild(n)
        }
        return false
      }

      // !!! Vue 2 does not have :slotted support
      // ::v-slotted(.foo) -> .foo[xxxxxxx-s]
      // if (value === ':slotted' || value === '::v-slotted') {
      //   rewriteSelector(id, n.nodes[0], selectorRoot, true /* slotted */)
      //   let last: selectorParser.Selector['nodes'][0] = n
      //   n.nodes[0].each(ss => {
      //     selector.insertAfter(last, ss)
      //     last = ss
      //   })
      //   // selector.insertAfter(n, n.nodes[0])
      //   selector.removeChild(n)
      //   // since slotted attribute already scopes the selector there's no
      //   // need for the non-slot attribute.
      //   shouldInject = false
      //   return false
      // }

      // global: replace with inner selector and do not inject [id].
      // ::v-global(.foo) -> .foo
      if (value === ':global' || value === '::v-global') {
        selectorRoot.insertAfter(selector, n.nodes[0])
        selectorRoot.removeChild(selector)
        return false
      }
    }

    if (n.type !== 'pseudo' && n.type !== 'combinator') {
      node = n
    }
  })

  if (node) {
    ;(node as selectorParser.Node).spaces.after = ''
  } else {
    // For deep selectors & standalone pseudo selectors,
    // the attribute selectors are prepended rather than appended.
    // So all leading spaces must be eliminated to avoid problems.
    selector.first.spaces.before = ''
  }

  if (shouldInject) {
    selector.insertAfter(
      // If node is null it means we need to inject [id] at the start
      // insertAfter can handle `null` here
      node as any,
      selectorParser.attribute({
        attribute: id,
        value: id,
        raws: {},
        quoteMark: `"`
      })
    )
  }
}

function isSpaceCombinator(node: selectorParser.Node) {
  return node.type === 'combinator' && /^\s+$/.test(node.value)
}

scopedPlugin.postcss = true
export default scopedPlugin
