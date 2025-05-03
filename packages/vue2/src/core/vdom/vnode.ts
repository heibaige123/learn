import type { Component } from 'types/component'
import type { ComponentOptions } from 'types/options'
import type { VNodeComponentOptions, VNodeData } from 'types/vnode'

/**
 * Vue.js 中的虚拟节点（Virtual DOM Node）的核心类。
 * 虚拟节点是 Vue 的虚拟 DOM 实现的基础，它是对真实 DOM 节点的抽象表示。
 * 通过 `VNode`，Vue 可以高效地对比新旧虚拟 DOM 树，并将差异更新到真实 DOM 中
 * @internal
 */
export default class VNode {
  /**
   * - 表示节点的标签名（如 `div`、`span` 等）。
   * - 如果是组件节点，则为组件的名称。
   */
  tag?: string
  /**
   * 节点的属性数据，包含 `attrs`、`props`、`events` 等信息。
   */
  data: VNodeData | undefined
  /**
   * 子节点数组，表示该节点的子虚拟节点。
   */
  children?: Array<VNode> | null
  /** 子节点数组，表示该节点的子虚拟节点。 */
  text?: string
  /** 对应的真实 DOM 节点引用。 */
  elm: Node | undefined
  /** 节点的命名空间（如 SVG 或 MathML）。 */
  ns?: string
  /** 节点所属的 Vue 组件实例。 */
  context?: Component // rendered in this component's scope
  /** 节点的唯一标识，用于优化虚拟 DOM 的 diff 算法。 */
  key: string | number | undefined
  /** 存储组件的选项信息。 */
  componentOptions?: VNodeComponentOptions
  /** 组件实例 */
  componentInstance?: Component // component instance
  /** 父虚拟节点。 */
  parent: VNode | undefined | null // component placeholder node

  // strictly internal
  /** 是否包含原始 HTML（仅用于服务端渲染）。 */
  raw: boolean // contains raw HTML? (server only)
  /** 是否是静态节点（优化静态节点的渲染）。 */
  isStatic: boolean // hoisted static node
  /** 是否是根插入节点（用于过渡检查）。 */
  isRootInsert: boolean // necessary for enter transition check
  /** 是否是注释节点。 */
  isComment: boolean // empty comment placeholder?
  /** 是否是克隆节点。 */
  isCloned: boolean // is a cloned node?
  /** 是否是 `v-once` 节点（只渲染一次）。 */
  isOnce: boolean // is a v-once node?
  /** 异步组件的工厂函数。 */
  asyncFactory?: Function // async component factory function
  /** 异步组件的元信息。 */
  asyncMeta: Object | void
  /** 是否是异步占位符节点。 */
  isAsyncPlaceholder: boolean
  /** 服务端渲染的上下文。 */
  ssrContext?: Object | void
  /** 函数式组件的上下文。 */
  fnContext: Component | void // real context vm for functional nodes
  /** 函数式组件的选项。 */
  fnOptions?: ComponentOptions | null // for SSR caching
  /** 用于存储开发工具的元信息。 */
  devtoolsMeta?: Object | null // used to store functional render context for devtools
  /** 函数式组件的作用域 ID。 */
  fnScopeId?: string | null // functional scope id support
  /** 是否是组件的根元素（用于服务端渲染指令）。 */
  isComponentRootElement?: boolean | null // for SSR directives

  constructor(
    tag?: string,
    data?: VNodeData,
    children?: Array<VNode> | null,
    text?: string,
    elm?: Node,
    context?: Component,
    componentOptions?: VNodeComponentOptions,
    asyncFactory?: Function
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.ns = undefined
    this.context = context
    this.fnContext = undefined
    this.fnOptions = undefined
    this.fnScopeId = undefined
    this.key = data && data.key
    this.componentOptions = componentOptions
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = false
    this.isStatic = false
    this.isRootInsert = true
    this.isComment = false
    this.isCloned = false
    this.isOnce = false
    this.asyncFactory = asyncFactory
    this.asyncMeta = undefined
    this.isAsyncPlaceholder = false
  }

  // DEPRECATED: alias for componentInstance for backwards compat.
  /* istanbul ignore next */
  get child(): Component | void {
    return this.componentInstance
  }
}

/**
 * - 创建一个空的虚拟节点。
 * - 用于表示注释节点。
 * @param text 注释的文本内容，默认为空字符串。
 * @returns 一个 `VNode` 实例，`isComment` 属性为 `true`。
 */
export const createEmptyVNode = (text: string = '') => {
  const node = new VNode()
  node.text = text
  node.isComment = true
  return node
}

/**
 * 创建一个文本虚拟节点。
 * @param val 文本内容，可以是字符串或数字。
 * @returns 一个 `VNode` 实例，`text` 属性为文本内容。
 */
export function createTextVNode(val: string | number) {
  return new VNode(undefined, undefined, undefined, String(val))
}

// optimized shallow clone
// used for static nodes and slot nodes because they may be reused across
// multiple renders, cloning them avoids errors when DOM manipulations rely
// on their elm reference.
/**
 * - 克隆一个虚拟节点。
 * - 用于静态节点和插槽节点的优化，避免在多次渲染中修改原始节点。
 * @param vnode 要克隆的虚拟节点。
 * @returns 克隆后的虚拟节点，`isCloned` 属性为 `true`。
 */
export function cloneVNode(vnode: VNode): VNode {
  const cloned = new VNode(
    vnode.tag,
    vnode.data,
    // #7975
    // clone children array to avoid mutating original in case of cloning
    // a child.
    vnode.children && vnode.children.slice(),
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
  cloned.fnContext = vnode.fnContext
  cloned.fnOptions = vnode.fnOptions
  cloned.fnScopeId = vnode.fnScopeId
  cloned.asyncMeta = vnode.asyncMeta
  cloned.isCloned = true
  return cloned
}
