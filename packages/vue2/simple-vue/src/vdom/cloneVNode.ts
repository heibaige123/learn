import { VNode } from './VNode'

export function cloneVNode(vnode: VNode, deep?: boolean) {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    vnode.children,
    vnode.text,
    vnode.elm,
    vnode.context,
    vnode.componentOptions,
    vnode.asyncFactory
  )

  cloned.ns = vnode.ns
  cloned.isStatic = vnode.isStatic
  cloned.key = vnode.key
  cloned.isComment = vnode.isComment
  cloned.isCloned = true

  if (deep && vnode.children) {
    cloned.children = cloneVNode(vnode.children)
  }

  return cloned
}
