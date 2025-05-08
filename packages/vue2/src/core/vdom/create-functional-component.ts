import VNode, { cloneVNode } from './vnode'
import { createElement } from './create-element'
import { resolveInject } from '../instance/inject'
import { normalizeChildren } from '../vdom/helpers/normalize-children'
import { resolveSlots } from '../instance/render-helpers/resolve-slots'
import { normalizeScopedSlots } from '../vdom/helpers/normalize-scoped-slots'
import { installRenderHelpers } from '../instance/render-helpers/index'

import {
  isDef,
  isTrue,
  hasOwn,
  camelize,
  validateProp
} from '../util/index'
import type { Component } from 'types/component'
import type { VNodeData } from 'types/vnode'

/**
 * 创建函数式组件的渲染上下文。由于函数式组件没有实例(`this`)，这个上下文对象代替了普通组件中的实例，提供了访问 props、slots 等数据的入口。
 * @param data
 * @param props
 * @param children
 * @param parent
 * @param Ctor
 */
export function FunctionalRenderContext(
  data: VNodeData,
  props: Object,
  children: Array<VNode> | undefined,
  parent: Component,
  Ctor: typeof Component
) {
  const options = Ctor.options
  // ensure the createElement function in functional components
  // gets a unique context - this is necessary for correct named slot check
  let contextVm
  // - 创建一个特殊的上下文虚拟实例，用于createElement函数
  // - 确保嵌套函数式组件能正确追踪到实际的父组件实例
  if (hasOwn(parent, '_uid')) {
    contextVm = Object.create(parent)
    contextVm._original = parent
  } else {
    // the context vm passed in is a functional context as well.
    // in this case we want to make sure we are able to get a hold to the
    // real context instance.
    contextVm = parent
    // @ts-ignore
    parent = parent._original
  }
  const isCompiled = isTrue(options._compiled)
  const needNormalization = !isCompiled

  // - 暴露函数式组件需要的各种数据，模拟普通组件实例的核心属性
  // - 提供属性、事件监听器和依赖注入等数据访问
  this.data = data
  this.props = props
  this.children = children
  this.parent = parent
  this.listeners = data.on || Object.freeze({})
  this.injections = resolveInject(options.inject, parent)
  // - 提供访问普通插槽和作用域插槽的方法
  // - 惰性解析插槽，只在需要时计算插槽内容
  this.slots = () => {
    if (!this.$slots) {
      normalizeScopedSlots(
        parent,
        data.scopedSlots,
        (this.$slots = resolveSlots(children, parent))
      )
    }
    return this.$slots
  }

  Object.defineProperty(this, 'scopedSlots', {
    enumerable: true,
    get() {
      return normalizeScopedSlots(parent, data.scopedSlots, this.slots())
    }
  } as any)

  // - 对于预编译的模板，提供额外的支持
  // - 预解析插槽，优化编译模板的性能
  // support for compiled functional template
  if (isCompiled) {
    // exposing $options for renderStatic()
    this.$options = options
    // pre-resolve slots for renderSlot()
    this.$slots = this.slots()
    this.$scopedSlots = normalizeScopedSlots(
      parent,
      data.scopedSlots,
      this.$slots
    )
  }

  if (options._scopeId) {
    // - 定义创建VNode的函数 `_c`，这是渲染过程的核心
    // - 为作用域样式提供特殊处理，确保样式隔离正常工作
    this._c = (a, b, c, d) => {
      const vnode = createElement(contextVm, a, b, c, d, needNormalization)
      if (vnode && !Array.isArray(vnode)) {
        vnode.fnScopeId = options._scopeId
        vnode.fnContext = parent
      }
      return vnode
    }
  } else {
    this._c = (a, b, c, d) =>
      createElement(contextVm, a, b, c, d, needNormalization)
  }
}

installRenderHelpers(FunctionalRenderContext.prototype)

/**
 * 创建函数式组件虚拟节点的专用函数
 * @param Ctor
 * @param propsData
 * @param data
 * @param contextVm
 * @param children
 * @returns
 */
export function createFunctionalComponent(
  Ctor: typeof Component,
  propsData: Object | undefined,
  data: VNodeData,
  contextVm: Component,
  children?: Array<VNode>
): VNode | Array<VNode> | void {
  const options = Ctor.options
  const props = {}
  const propOptions = options.props
  if (isDef(propOptions)) {
    // 有明确定义的 props
    for (const key in propOptions) {
      props[key] = validateProp(key, propOptions, propsData || Object.freeze({}))
    }
  } else {
    // 没有明确定义 props，合并属性
    if (isDef(data.attrs)) mergeProps(props, data.attrs)
    if (isDef(data.props)) mergeProps(props, data.props)
  }

  const renderContext = new FunctionalRenderContext(
    data,
    props,
    children,
    contextVm,
    Ctor
  )

  const vnode = options.render.call(null, renderContext._c, renderContext)

  if (vnode instanceof VNode) {
    return cloneAndMarkFunctionalResult(
      vnode,
      data,
      renderContext.parent,
      options,
      renderContext
    )
  } else if (Array.isArray(vnode)) {
    const vnodes = normalizeChildren(vnode) || []
    const res = new Array(vnodes.length)
    for (let i = 0; i < vnodes.length; i++) {
      res[i] = cloneAndMarkFunctionalResult(
        vnodes[i],
        data,
        renderContext.parent,
        options,
        renderContext
      )
    }
    return res
  }
}

/**
 * 克隆函数式组件生成的虚拟节点(VNode)，并为其添加必要的上下文信息和标记
 * @param vnode 函数式组件渲染函数生成的原始虚拟节点
 * @param data 传递给函数式组件的数据对象
 * @param contextVm 父组件实例，即创建函数式组件的上下文
 * @param options 函数式组件的选项对象
 * @param renderContext 函数式渲染上下文对象
 * @returns
 */
function cloneAndMarkFunctionalResult(
  vnode,
  data,
  contextVm,
  options,
  renderContext
) {
  // #7817 clone node before setting fnContext, otherwise if the node is reused
  // (e.g. it was from a cached normal slot) the fnContext causes named slots
  // that should not be matched to match.
  // - 创建原始VNode的深拷贝，避免修改可能被缓存共享的节点
  // - 注释中提到这解决了#7817问题，防止缓存插槽节点被错误匹配
  const clone = cloneVNode(vnode)
  clone.fnContext = contextVm
  clone.fnOptions = options
  if (__DEV__) {
    ;(clone.devtoolsMeta = clone.devtoolsMeta || ({} as any)).renderContext =
      renderContext
  }
  if (data.slot) {
    ;(clone.data || (clone.data = {})).slot = data.slot
  }
  return clone
}

/**
 * 将源对象的属性合并到目标对象中，同时将属性名转换为驼峰格式
 * @param to 目标对象，接收合并后的属性
 * @param from 源对象，提供要合并的属性
 */
function mergeProps(to, from) {
  for (const key in from) {
    to[camelize(key)] = from[key]
  }
}
