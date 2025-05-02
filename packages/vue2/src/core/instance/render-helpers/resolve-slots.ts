import type VNode from 'core/vdom/vnode'
import type { Component } from 'types/component'

/**
 * Runtime helper for resolving raw children VNodes into a slot object.
 */
/**
 * 把原始的子节点 VNode 数组，整理成插槽对象
 * - 会把所有传递给子组件的 VNode，根据 `slot` 属性分组，最终生成类似 `{ default: [...], foo: [...] }` 这样的插槽对象
 * @param children
 * @param context
 * @returns

 ```vue
 <my-comp>
   <div>默认内容</div>
   <template slot="foo"><span>foo内容</span></template>
   <!-- 注释节点 -->
   <span slot="bar">bar内容</span>
   <span> </span>
 </my-comp>
 ```

 `resolveSlots` 处理后：

 ```js
 {
   default: [VNode(div, ...)],
   foo: [VNode(span, ...)],
   bar: [VNode(span, ...)]
 }
 ```

 */
export function resolveSlots(
  children: Array<VNode> | null | undefined,
  context: Component | null
): { [key: string]: Array<VNode> } {
  if (!children || !children.length) {
    return {}
  }
  const slots: Record<string, any> = {}
  for (let i = 0, l = children.length; i < l; i++) {
    const child = children[i]
    const data = child.data
    // remove slot attribute if the node is resolved as a Vue slot node
    // 如果有 `data.attrs.slot`，说明是具名插槽，删除该属性（避免后续重复处理）
    if (data && data.attrs && data.attrs.slot) {
      delete data.attrs.slot
    }
    // named slots should only be respected if the vnode was rendered in the
    // same context.
    if (
      (child.context === context || child.fnContext === context) &&
      data &&
      data.slot != null
    ) {
      const name = data.slot
      const slot = slots[name] || (slots[name] = [])
      if (child.tag === 'template') {
        slot.push.apply(slot, child.children || [])
      } else {
        slot.push(child)
      }
    } else {
      // 如果不是具名插槽，加入默认插槽（`slots.default`）
      ;(slots.default || (slots.default = [])).push(child)
    }
  }
  // ignore slots that contains only whitespace
  for (const name in slots) {
    if (slots[name].every(isWhitespace)) {
      // 遍历所有插槽，如果某个插槽里的所有节点都是空白节点（`isWhitespace`），就删除该插槽
      delete slots[name]
    }
  }
  return slots
}

/**
 * 判断一个 VNode 节点是否是“空白节点”。
 *
 * 空白节点包括：
 * - 注释节点（`isComment` 为 true，且不是异步工厂占位符）
 * - 纯空格文本节点（`text === ' '`）
 *
 * @param node
 * @returns
 */
function isWhitespace(node: VNode): boolean {
  return (node.isComment && !node.asyncFactory) || node.text === ' '
}
