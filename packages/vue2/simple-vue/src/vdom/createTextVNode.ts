import { VNode } from './VNode'

export function createTextVNode(val: string) {
  const node = new VNode()

  node.text = String(val)

  return node
}
