import { makeMap, isBuiltInTag, cached, no } from 'shared/util'
import { ASTElement, CompilerOptions, ASTNode } from 'types/compiler'

/** 静态键的判断函数 */
let isStaticKey

/** 判断是否为平台保留标签的函数 */
let isPlatformReservedTag

/** 缓存生成静态键的函数 */
const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
/**
 * 优化抽象语法树 (AST) 的方法。
 *
 * @param root 抽象语法树的根节点。
 * @param options 编译器选项，用于指定静态键和平台保留标签等。
 */
export function optimize(
  root: ASTElement | null | undefined,
  options: CompilerOptions
) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  markStatic(root)
  // second pass: mark static roots.
  markStaticRoots(root, false)
}

/**
 * 生成静态键的函数
 * @param keys 额外的静态键
 * @returns 判断是否为静态键的函数
 */
function genStaticKeys(keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap' +
      (keys ? ',' + keys : '')
  )
}

/**
 * 标记节点是否为静态节点。
 * @param node - 要检查的 AST 节点。
 *
 * 静态节点的判断逻辑：
 * - 如果节点类型为 1（元素节点），则需要进一步判断：
 *   - 如果节点不是平台保留标签、不是插槽标签，且没有内联模板属性，则直接返回。
 *   - 遍历子节点并递归调用 `markStatic`，如果子节点中有非静态节点，则当前节点也标记为非静态。
 *   - 如果存在条件渲染块（`ifConditions`），则递归检查每个条件块的静态性。
 *
 * 注意：
 * - 不将组件插槽内容标记为静态，以避免以下问题：
 *   1. 组件无法修改插槽节点。
 *   2. 静态插槽内容在热重载时失效。
 */
function markStatic(node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

/**
 * 标记节点是否为静态根节点。
 * @param node - 当前处理的 AST 节点。
 * @param isInFor - 当前节点是否在 v-for 循环中。
 */
function markStaticRoots(node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    /**
     * 如果节点是静态的或者使用了 v-once 指令，则标记其是否在 v-for 中。
     */
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    /**
     * 判断节点是否可以作为静态根节点：
     * - 节点必须是静态的。
     * - 节点必须有子节点，且子节点不能仅仅是一个静态文本节点。
     */
    if (
      node.static &&
      node.children.length &&
      !(node.children.length === 1 && node.children[0].type === 3)
    ) {
      /**
       * 标记为静态根节点。
       */
      node.staticRoot = true
      return
    } else {
      /**
       * 如果不满足条件，则标记为非静态根节点。
       */
      node.staticRoot = false
    }
    /**
     * 遍历子节点，递归调用 markStaticRoots。
     */
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    /**
     * 如果节点有条件分支 (v-if / v-else-if / v-else)，
     * 则递归处理每个条件块。
     */
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

/**
 * 判断一个 AST 节点是否是静态节点。
 *
 * 静态节点的定义：
 * - 类型为文本节点（type === 3）。
 * - 或者满足以下条件：
 *   - 包含 `pre` 属性。
 *   - 没有动态绑定（hasBindings 为 false）。
 *   - 不包含 `v-if`、`v-for` 或 `v-else` 指令。
 *   - 不是内置标签（通过 `isBuiltInTag` 判断）。
 *   - 是平台保留标签（通过 `isPlatformReservedTag` 判断）。
 *   - 不是 `template` 的直接子节点。
 *   - 所有键都为静态键（通过 `isStaticKey` 判断）。
 *
 * @param node AST 节点对象
 * @returns 如果是静态节点返回 `true`，否则返回 `false`
 */
function isStatic(node: ASTNode): boolean {
  if (node.type === 2) {
    // expression
    return false
  }
  if (node.type === 3) {
    // text
    return true
  }
  return !!(
    node.pre ||
    (!node.hasBindings && // no dynamic bindings
      !node.if &&
      !node.for && // not v-if or v-for or v-else
      !isBuiltInTag(node.tag) && // not a built-in
      isPlatformReservedTag(node.tag) && // not a component
      !isDirectChildOfTemplateFor(node) &&
      Object.keys(node).every(isStaticKey))
  )
}

/**
 * 判断一个节点是否是带有 `v-for` 指令的 `<template>` 标签的直接子节点。
 *
 * @param node - 要检查的 AST 节点。
 * @returns 如果节点是带有 `v-for` 指令的 `<template>` 标签的直接子节点，则返回 `true`，否则返回 `false`。
 */
function isDirectChildOfTemplateFor(node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
