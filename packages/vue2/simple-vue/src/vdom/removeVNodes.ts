export function removeVNodes(vnodes, startIndex, endIndex) {
  for (let index = startIndex; index < endIndex; ++index) {
    const element = vnodes[index]

    if (isDef(element)) {
      removeNode(element.elm)
    }
  }
}

const nodeOps = {
  removeChild(node, child) {
    node.removeChild(child)
  }
}

function removeNode(el) {
  const parent = nodeOps.parentNode(el)

  if (isDef(parent)) {
    nodeOps.removeChild(parent, el)
  }
}
