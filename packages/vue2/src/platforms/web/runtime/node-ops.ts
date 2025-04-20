import VNode from 'core/vdom/vnode'
import { namespaceMap } from 'web/util/index'

/**
 * 创建一个 HTML 元素
 * @param tagName - 元素的标签名
 * @param vnode - 虚拟节点对象
 * @returns 创建的 HTML 元素
 */
export function createElement(tagName: string, vnode: VNode): Element {
  /**
   * 创建的 HTML 元素
   */
  const elm = document.createElement(tagName)
  if (tagName !== 'select') {
    return elm
  }
  // false 或 null 会移除属性，但 undefined 不会
  if (
    vnode.data &&
    vnode.data.attrs &&
    vnode.data.attrs.multiple !== undefined
  ) {
    /**
     * 如果虚拟节点的属性中定义了 multiple，则为元素设置 multiple 属性
     */
    elm.setAttribute('multiple', 'multiple')
  }
  return elm
}

/**
 * 创建一个带有命名空间的元素。
 *
 * @param namespace - 命名空间的字符串标识符。
 * @param tagName - 要创建的元素的标签名。
 * @returns 创建的带有命名空间的元素。
 */
export function createElementNS(namespace: string, tagName: string): Element {
  return document.createElementNS(namespaceMap[namespace], tagName)
}

/**
 * 创建一个文本节点
 * @param text - 要创建的文本内容
 * @returns 一个新的文本节点
 */
export function createTextNode(text: string): Text {
  return document.createTextNode(text)
}

/**
 * 创建一个注释节点。
 *
 * @param text - 注释的内容。
 * @returns 一个新的注释节点。
 */
export function createComment(text: string): Comment {
  return document.createComment(text)
}

/**
 * 将节点插入到指定节点之前
 * @param parentNode 父节点，表示要在其子节点中插入新节点的节点。
 * @param newNode 新节点，表示要插入到父节点中的节点。
 * @param referenceNode 参考节点，表示新节点将插入到该节点之前。如果为 null，则新节点将插入到父节点的子节点末尾。
 */
export function insertBefore(
  parentNode: Node,
  newNode: Node,
  referenceNode: Node
) {
  parentNode.insertBefore(newNode, referenceNode)
}

/**
 * 从指定的父节点中移除子节点。
 *
 * @param node 父节点，表示从中移除子节点的 DOM 节点。
 * @param child 子节点，表示需要被移除的 DOM 节点。
 */
export function removeChild(node: Node, child: Node) {
  node.removeChild(child)
}

/**
 * 将子节点追加到指定节点的子节点列表的末尾。
 *
 * @param node - 父节点，子节点将被追加到该节点上。
 * @param child - 要追加的子节点。
 */
export function appendChild(node: Node, child: Node) {
  node.appendChild(child)
}
/**
 * 获取指定节点的父节点。
 *
 * @param node - 当前节点。
 * @returns 父节点，如果没有则返回 null。
 */
export function parentNode(node: Node) {
  /**
   * 当前节点
   */
  return node.parentNode
}

/**
 * 获取指定节点的下一个兄弟节点。
 *
 * @param node - 当前节点。
 * @returns 下一个兄弟节点，如果没有则返回 null。
 */
export function nextSibling(node: Node) {
  return node.nextSibling
}

/**
 * 获取元素的标签名
 *
 * @param node - 要获取标签名的元素
 * @returns 元素的标签名
 */
export function tagName(node: Element): string {
  /**
   * 要获取标签名的元素
   */
  return node.tagName
}

/**
 * 设置节点的文本内容
 *
 * @param node - 要设置文本内容的节点
 * @param text - 要设置的文本内容
 */
export function setTextContent(node: Node, text: string) {
  /**
   * 要设置文本内容的节点
   */
  node.textContent = text
}

/**
 * 为指定的 DOM 元素设置样式作用域。
 *
 * @param node - 需要设置样式作用域的 DOM 元素。
 * @param scopeId - 样式作用域的标识符。
 */
export function setStyleScope(node: Element, scopeId: string) {
  node.setAttribute(scopeId, '')
}
