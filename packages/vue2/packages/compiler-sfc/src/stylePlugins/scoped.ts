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

/**
 * processRule函数 - 处理CSS规则，添加作用域标识符
 * @param {string} id - 作用域ID（通常是组件的唯一标识符）
 * @param {Rule} rule - CSS规则对象
 */
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

/**
 * rewriteSelector函数 - 重写CSS选择器以添加作用域
 * @param {string} id - 组件作用域ID
 * @param {selectorParser.Selector} selector - 选择器对象
 * @param {selectorParser.Root} selectorRoot - 选择器根对象

 # 示例

 1. **基本选择器**:
    ```
    .example → .example[data-v-xxxxxx]
    ```

 2. **深度选择器**:
    ```
    .foo :deep(.bar) → .foo[data-v-xxxxxx] .bar
    ```

 3. **全局选择器**:
    ```
    :global(.foo) → .foo
    ```

 4. **废弃语法处理**:
    ```
    .foo >>> .bar → .foo[data-v-xxxxxx] .bar

    .foo /deep/ .bar → .foo[data-v-xxxxxx] .bar
    ```
 */
function rewriteSelector(
  id: string,
  selector: selectorParser.Selector,
  selectorRoot: selectorParser.Root
) {
  /** 跟踪最后一个非伪元素和非组合器节点，用于注入属性选择器 */
  let node: selectorParser.Node | null = null

  /** 控制是否应该注入作用域ID属性选择器 */
  let shouldInject = true
  // find the last child node to insert attribute selector
  selector.each(n => {
    // DEPRECATED ">>>" and "/deep/" combinator
    // 处理已废弃的深度选择器
    if (
      n.type === 'combinator' &&
      (n.value === '>>>' || n.value === '/deep/')
    ) {
      // 将`>>>`和`/deep/`组合器替换为空格组合器
      n.value = ' '
      n.spaces.before = n.spaces.after = ''
      // warn(
      //   `the >>> and /deep/ combinators have been deprecated. ` +
      //     `Use :deep() instead.`
      // )
      return false
    }

    // 处理伪元素和伪类选择器
    if (n.type === 'pseudo') {
      const { value } = n
      // deep: inject [id] attribute at the node before the ::v-deep
      // combinator.
      // 处理`:deep`和`::v-deep`
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

    // 跟踪最后一个有效节点
    if (n.type !== 'pseudo' && n.type !== 'combinator') {
      node = n
    }
  })

  // 处理空格和格式
  if (node) {
    ;(node as selectorParser.Node).spaces.after = ''
  } else {
    // For deep selectors & standalone pseudo selectors,
    // the attribute selectors are prepended rather than appended.
    // So all leading spaces must be eliminated to avoid problems.
    // 对于深度选择器和独立伪选择器
    // 属性选择器是前置而非后置的
    // 因此必须消除所有前导空格以避免问题
    selector.first.spaces.before = ''
  }

  // 注入作用域属性选择器
  if (shouldInject) {
    selector.insertAfter(
      // If node is null it means we need to inject [id] at the start
      // insertAfter can handle `null` here
      // 如果node为null，表示需要在开头注入[id]
      // insertAfter可以处理这里的`null`
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

/**
 * isSpaceCombinator函数 - 检测节点是否为空格组合器
 * @param {selectorParser.Node} node - 选择器解析器节点
 * @returns {boolean} - 如果是空格组合器则返回true
 */
function isSpaceCombinator(node: selectorParser.Node) {
  return node.type === 'combinator' && /^\s+$/.test(node.value)
}

scopedPlugin.postcss = true
export default scopedPlugin
