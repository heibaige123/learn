import VNode from '../vnode'

/**
 * 检查传入的虚拟节点是否是一个异步组件的占位符节点。
 * @param node 一个虚拟节点对象（`VNode`）。
 * @returns
 */
export function isAsyncPlaceholder(node: VNode): boolean {
  // @ts-expect-error not really boolean type
  return node.isComment && node.asyncFactory
}
