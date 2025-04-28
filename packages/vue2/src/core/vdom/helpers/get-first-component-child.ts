import { isDef, isArray } from 'shared/util'
import VNode from '../vnode'
import { isAsyncPlaceholder } from './is-async-placeholder'

/**
 * 从传入的子节点数组中找到第一个组件类型的子节点，并返回该节点。
 * 如果没有找到符合条件的节点，则返回 `undefined`。
 * @param children 一个可选的虚拟节点数组（`VNode[]`）。
 * @returns
 */
export function getFirstComponentChild(
  children?: Array<VNode>
): VNode | undefined {
  if (isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i]
      // - **`isAsyncPlaceholder(c)`**：
      // - 检查节点是否是一个异步组件的占位符。
      // - 异步组件在加载过程中会生成一个占位符节点。
      if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
        return c
      }
    }
  }
}
