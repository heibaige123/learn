/**
#### 实现细节

1. **缓存静态树**
   - `this._staticTrees` 是一个数组，用于缓存每个静态节点（或静态树）。
   - 通过 `index` 取出对应的缓存。

2. **判断是否可以复用**
   - 如果已经渲染过该静态树（`tree` 存在），并且**当前不在 v-for 内部**，直接返回缓存，避免重复渲染。

3. **重新渲染静态树**
   - 如果没有缓存，或者在 v-for 内（每次都要新渲染），
   - 调用编译生成的静态渲染函数 `this.$options.staticRenderFns[index]`，生成新的 VNode 树。
   - 渲染结果缓存到 `this._staticTrees[index]`。

4. **打静态标记**
   - 调用 `markStatic` 给节点打上静态标记（`isStatic: true`），并设置唯一 key。

5. **返回静态树**

*/

import VNode from 'core/vdom/vnode'
import { isArray } from 'core/util'

/**
 * Runtime helper for rendering static trees.
 */
/**
 * 用于**渲染静态节点（静态树）**的运行时辅助函数
 *
 * - **缓存**模板中被编译器标记为静态的 VNode 子树，
 * - 在后续渲染过程中**直接复用**，避免重复创建，提升性能。
 *
 * @param index 静态节点的索引（对应 staticRenderFns 数组下标）
 * @param isInFor 当前静态节点是否处于 v-for 循环内部
 * @returns
 */
export function renderStatic(
  index: number,
  isInFor: boolean
): VNode | Array<VNode> {
  const cached = this._staticTrees || (this._staticTrees = [])
  let tree = cached[index]
  // if has already-rendered static tree and not inside v-for,
  // we can reuse the same tree.
  // 如果已经渲染过且不在 v-for 内，可以直接复用缓存
  if (tree && !isInFor) {
    return tree
  }
  // otherwise, render a fresh tree.
  tree = cached[index] = this.$options.staticRenderFns[index].call(
    this._renderProxy,
    this._c,
    this // for render fns generated for functional component templates
  )
  markStatic(tree, `__static__${index}`, false)
  return tree
}

/**
 * Runtime helper for v-once.
 * Effectively it means marking the node as static with a unique key.
 */
/**
 * 给 VNode 或 VNode 数组打上“只渲染一次”的静态标记*
 * @param tree 要标记的 VNode 或 VNode 数组（即 v-once 作用的节点）
 * @param index 静态节点的索引（保证 key 唯一）
 * @param key 可选的额外 key（用于区分同一索引下的不同节点）
 * @returns
 */
export function markOnce(
  tree: VNode | Array<VNode>,
  index: number,
  key: string
) {
  markStatic(tree, `__once__${index}${key ? `_${key}` : ``}`, true)
  return tree
}

/**
 * 批量给 VNode 或 VNode 数组打上静态标记**的辅助函数
 * @param tree 可以是单个 VNode，也可以是 VNode 数组（即一棵静态子树）
 * @param key 唯一标识字符串（如 `__static__0`、`__once__1_foo` 等）
 * @param isOnce 是否是 v-once 节点
 */
function markStatic(tree: VNode | Array<VNode>, key: string, isOnce: boolean) {
  if (isArray(tree)) {
    for (let i = 0; i < tree.length; i++) {
      // 字符串节点是文本，不需要打静态标记
      if (tree[i] && typeof tree[i] !== 'string') {
        markStaticNode(tree[i], `${key}_${i}`, isOnce)
      }
    }
  } else {
    markStaticNode(tree, key, isOnce)
  }
}

/**
 * 给 VNode 节点打上“静态”或“v-once”标记和唯一key，让 Vue 在后续渲染和 diff 时能高效跳过这些节点，提升性能。
 * @param node 要标记的 VNode 节点对象
 * @param key 唯一标识字符串（如 `__static__0`、`__once__1_foo` 等）
 * @param isOnce 是否是 v-once 节点
 */
function markStaticNode(node, key, isOnce) {
  // 标记该节点为静态节点。 这样在 patch 阶段，Vue 就会跳过它的 diff 和更新。
  node.isStatic = true
  // 给节点设置唯一 key，保证在复用时不会混淆。
  node.key = key
  // 如果是 v-once 节点，这里会标记为 true，这样 Vue 就知道这个节点只渲染一次，后续不会再更新。
  node.isOnce = isOnce
}
