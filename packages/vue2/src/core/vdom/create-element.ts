import config from '../config'
import VNode, { createEmptyVNode } from './vnode'
import { createComponent } from './create-component'
import { traverse } from '../observer/traverse'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPrimitive,
  resolveAsset,
  isFunction
} from '../util/index'

import { normalizeChildren, simpleNormalizeChildren } from './helpers/index'
import type { Component } from 'types/component'
import type { VNodeData } from 'types/vnode'

/** 用于编译生成的渲染函数 */
const SIMPLE_NORMALIZE = 1
/** 用于用户编写的渲染函数 */
const ALWAYS_NORMALIZE = 2

// wrapper function for providing a more flexible interface
// without getting yelled at by flow
/**
 * 创建虚拟节点
 * @param context 组件实例，提供创建节点的上下文环境。
 * @param tag 节点标签名或组件定义（字符串、组件选项对象或构造函数）。
 * @param data 与节点相关的数据对象，如 props、attrs、class、style 等。
 * @param children 子节点内容，可能是文本、VNode 数组或嵌套数组。
 * @param normalizationType 子节点规范化类型，决定如何处理嵌套子节点数组。
 * @param alwaysNormalize 是否总是使用完全规范化模式，通常由用户手动调用时为 true。
 * @returns
 */
export function createElement(
  context: Component,
  tag: any,
  data: any,
  children: any,
  normalizationType: any,
  alwaysNormalize: boolean
): VNode | Array<VNode> {
  if (Array.isArray(data) || isPrimitive(data)) {
    normalizationType = children
    children = data
    data = undefined
  }
  if (isTrue(alwaysNormalize)) {
    normalizationType = ALWAYS_NORMALIZE
  }
  return _createElement(context, tag, data, children, normalizationType)
}

/**
 * 创建虚拟节点 (VNode)。它处理从简单的 HTML 元素到复杂的组件，以及它们的各种属性和子节点。
 * @param context 组件实例，提供创建节点的上下文环境。
 * @param tag 节点的标签名或组件定义。可以是 HTML 标签字符串('div')，也可以是组件构造函数或选项对象。
 * @param data 节点的数据对象，包含属性、样式、事件监听器等信息。
 * @param children 子节点内容，可以是文本、VNode 数组或其他格式。
 * @param normalizationType 子节点规范化的类型，决定如何处理子节点数组结构。
 * @returns
 */
export function _createElement(
  context: Component,
  tag?: string | Component | Function | Object,
  data?: VNodeData,
  children?: any,
  normalizationType?: number
): VNode | Array<VNode> {
  if (isDef(data) && isDef((data as any).__ob__)) {
    // - 检测 data 是否为响应式对象（有 `__ob__` 属性）
    // - 避免使用响应式对象作为 VNode 数据，可能导致渲染性能和意外更新问题
    __DEV__ &&
      warn(
        `Avoid using observed data object as vnode data: ${JSON.stringify(
          data
        )}\n` + 'Always create fresh vnode data objects in each render!',
        context
      )
    return createEmptyVNode()
  }
  // object syntax in v-bind
  // 处理动态组件 `:is` 语法
  if (isDef(data) && isDef(data.is)) {
    tag = data.is
  }
  if (!tag) {
    // in case of component :is set to falsy value
    return createEmptyVNode()
  }
  // warn against non-primitive key
  if (__DEV__ && isDef(data) && isDef(data.key) && !isPrimitive(data.key)) {
    warn(
      'Avoid using non-primitive value as key, ' +
        'use string/number value instead.',
      context
    )
  }
  // support single function children as default scoped slot
  if (Array.isArray(children) && isFunction(children[0])) {
    data = data || {}
    data.scopedSlots = { default: children[0] }
    children.length = 0
  }
  if (normalizationType === ALWAYS_NORMALIZE) {
    children = normalizeChildren(children)
  } else if (normalizationType === SIMPLE_NORMALIZE) {
    children = simpleNormalizeChildren(children)
  }
  let vnode, ns
  if (typeof tag === 'string') {
    let Ctor
    ns = (context.$vnode && context.$vnode.ns) || config.getTagNamespace(tag)
    if (config.isReservedTag(tag)) {
      // platform built-in elements
      if (
        __DEV__ &&
        isDef(data) &&
        isDef(data.nativeOn) &&
        data.tag !== 'component'
      ) {
        warn(
          `The .native modifier for v-on is only valid on components but it was used on <${tag}>.`,
          context
        )
      }
      vnode = new VNode(
        config.parsePlatformTagName(tag),
        data,
        children,
        undefined,
        undefined,
        context
      )
    } else if (
      (!data || !data.pre) &&
      isDef((Ctor = resolveAsset(context.$options, 'components', tag)))
    ) {
      // component
      vnode = createComponent(Ctor, data, context, children, tag)
    } else {
      // unknown or unlisted namespaced elements
      // check at runtime because it may get assigned a namespace when its
      // parent normalizes children
      vnode = new VNode(tag, data, children, undefined, undefined, context)
    }
  } else {
    // direct component options / constructor
    vnode = createComponent(tag as any, data, context, children)
  }
  if (Array.isArray(vnode)) {
    return vnode
  } else if (isDef(vnode)) {
    if (isDef(ns)) applyNS(vnode, ns)
    if (isDef(data)) registerDeepBindings(data)
    return vnode
  } else {
    return createEmptyVNode()
  }
}

/**
 * 负责为虚拟节点树设置正确的 XML 命名空间（namespace），这在处理 SVG、MathML 等特殊元素时非常重要。没有正确的命名空间，浏览器将无法正确渲染这些元素。
 * @param vnode 需要应用命名空间的虚拟节点
 * @param ns 要应用的 XML 命名空间（如 SVG 的 `"http://www.w3.org/2000/svg"`）
 * @param force 指示是否强制应用命名空间，即使子元素已有命名空间
 */
function applyNS(vnode, ns, force?: boolean) {
  vnode.ns = ns
  if (vnode.tag === 'foreignObject') {
    // `foreignObject` 是 SVG 中的特殊元素，它允许在 SVG 内部嵌入 HTML 内容。
    // - 将 `ns` 设为 `undefined`，恢复为默认 HTML 命名空间
    // - 设置 `force = true`，确保这个更改会被强制应用到子元素
    // use default namespace inside foreignObject
    ns = undefined
    force = true
  }
  if (isDef(vnode.children)) {
    for (let i = 0, l = vnode.children.length; i < l; i++) {
      const child = vnode.children[i]
      if (
        isDef(child.tag) &&
        (isUndef(child.ns) || (isTrue(force) && child.tag !== 'svg'))
      ) {
        applyNS(child, ns, force)
      }
    }
  }
}

// ref #5318
// necessary to ensure parent re-render when deep bindings like :style and
// :class are used on slot nodes
/**
 * 确保深层绑定的响应式数据能正确触发更新
 * @param data VNode 的数据对象，包含节点的属性、事件监听器等信息，其中可能包含 `style` 和 `class` 属性
 */
function registerDeepBindings(data) {
  // 样式处理
  if (isObject(data.style)) {
    traverse(data.style)
  }
  // 类处理
  if (isObject(data.class)) {
    traverse(data.class)
  }
}
