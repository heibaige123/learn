import { VNode } from './VNode'

export function createEmptyVNode(text) {
  const node = new VNode()

  node.text = text
  node.isComment = true

  return node
}
