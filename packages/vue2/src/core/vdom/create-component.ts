import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import { warn, isDef, isUndef, isTrue, isObject } from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

import type {
  MountedComponentVNode,
  VNodeData,
  VNodeWithData
} from 'types/vnode'
import type { Component } from 'types/component'
import type { ComponentOptions, InternalComponentOptions } from 'types/options'

/**
 * 从组件选项对象中获取组件的名称
 * @param options 组件的选项对象
 * @returns
 */
export function getComponentName(options: ComponentOptions) {
  return options.name || options.__name || options._componentTag
}

// inline hooks to be invoked on component VNodes during patch
/**
 * Vue 2 中一组关键的内部钩子函数集合，用于管理组件 VNode 的生命周期
 */
const componentVNodeHooks = {
  init(vnode: VNodeWithData, hydrating: boolean): boolean | void {
    // 检查是否是 keep-alive 的已有组件
    if (
      vnode.componentInstance &&
      !vnode.componentInstance._isDestroyed &&
      vnode.data.keepAlive
    ) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    } else {
      // 创建新组件实例并挂载
      const child = (vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance
      ))
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    }
  },

  /**
   * 组件更新时调用，复用已有实例但更新其属性
   * @param oldVnode
   * @param vnode
   */
  prepatch(oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = (vnode.componentInstance = oldVnode.componentInstance)
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  /**
   * 组件插入到 DOM 后调用
   * @param vnode
   */
  insert(vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  /**
   * 组件 VNode 销毁时调用
   * @param vnode
   */
  destroy(vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

/**
 * 存储所有需要合并到组件 VNode 数据中的钩子函数名称
 * - ['init', 'prepatch', 'insert', 'destroy']
 */
const hooksToMerge = Object.keys(componentVNodeHooks)

/**
 * 创建组件的虚拟节点(VNode)
 * @param Ctor 组件构造函数、组件选项对象或异步组件工厂函数
 * @param data 组件的 VNode 数据，包含 props、事件等信息
 * @param context 当前渲染上下文，通常是父组件实例
 * @param children 子节点数组，对于组件会成为默认插槽内容
 * @param tag 组件的标签名称
 * @returns
 */
export function createComponent(
  Ctor: typeof Component | Function | ComponentOptions | void,
  data: VNodeData | undefined,
  context: Component,
  children?: Array<VNode>,
  tag?: string
): VNode | Array<VNode> | void {
  if (isUndef(Ctor)) {
    return
  }

  // 即 Vue 构造函数
  const baseCtor = context.$options._base

  // 将选项对象转换为构造函数
  // plain options object: turn it into a constructor
  if (isObject(Ctor)) {
    Ctor = baseCtor.extend(Ctor as typeof Component)
  }

  // 验证构造函数有效性
  // if at this stage it's not a constructor or an async component factory,
  // reject.
  if (typeof Ctor !== 'function') {
    if (__DEV__) {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // async component
  let asyncFactory
  // - 检测是否为异步组件（没有 cid 属性）
  // @ts-expect-error
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    // 尝试解析异步组件
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor)
    if (Ctor === undefined) {
      // 如果组件尚未加载完成，创建占位节点并返回
      // return a placeholder node for async component, which is rendered
      // as a comment node but preserves all the raw information for the node.
      // the information will be used for async server-rendering and hydration.
      return createAsyncPlaceholder(asyncFactory, data, context, children, tag)
    }
  }

  data = data || {}

  // resolve constructor options in case global mixins are applied after
  // component constructor creation
  resolveConstructorOptions(Ctor as typeof Component)

  // transform component v-model data into props & events
  // 处理 v-model
  if (isDef(data.model)) {
    // @ts-expect-error
    transformModel(Ctor.options, data)
  }

  // extract props
  // 提取 props 数据
  // @ts-expect-error
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // functional component
  // 函数式组件
  // @ts-expect-error
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(
      Ctor as typeof Component,
      propsData,
      data,
      context,
      children
    )
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  // 提取监听器
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  // @ts-expect-error
  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot
    // 只保留 props、listeners 和 slot
    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // install component management hooks onto the placeholder node
  installComponentHooks(data)

  // return a placeholder vnode
  // @ts-expect-error
  const name = getComponentName(Ctor.options) || tag
  const vnode = new VNode(
    // @ts-expect-error
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data,
    undefined,
    undefined,
    undefined,
    context,
    // @ts-expect-error
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  return vnode
}

/**
 * 从组件的虚拟节点(VNode)创建出实际的组件实例
 * @param vnode 组件的虚拟节点，包含创建组件所需的所有信息
 * @param parent 父组件实例
 * @returns
 */
export function createComponentInstanceForVnode(
  // we know it's MountedComponentVNode but flow doesn't
  vnode: any,
  // activeInstance in lifecycle state
  parent?: any
): Component {
  const options: InternalComponentOptions = {
    _isComponent: true,
    _parentVnode: vnode,
    parent
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  return new vnode.componentOptions.Ctor(options)
}

/**
 * 将组件的生命周期钩子安装到 VNode 的 data 对象中
 * @param data VNode 的数据对象，包含各种渲染相关信息
 */
function installComponentHooks(data: VNodeData) {
  const hooks = data.hook || (data.hook = {})
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    const existing = hooks[key]
    const toMerge = componentVNodeHooks[key]
    // @ts-expect-error
    if (existing !== toMerge && !(existing && existing._merged)) {
      hooks[key] = existing ? mergeHook(toMerge, existing) : toMerge
    }
  }
}

/**
 * 函数用于合并两个钩子函数，确保它们都能在同一个钩子点被调用
 * @param f1 第一个钩子函数，通常是 Vue 内部的组件钩子
 * @param f2 第二个钩子函数，通常是用户自定义的钩子或已存在的钩子
 * @returns
 */
function mergeHook(f1: any, f2: any): Function {
  const merged = (a, b) => {
    // flow complains about extra args which is why we use any
    f1(a, b)
    f2(a, b)
  }
  merged._merged = true
  return merged
}

// transform component v-model info (value and callback) into
// prop and event handler respectively.
/**
 * 将组件上的 `v-model` 指令转换为对应的 props 和事件处理器
 * @param options
 * @param data
 */
function transformModel(options, data: any) {
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'
  ;(data.attrs || (data.attrs = {}))[prop] = data.model.value
  const on = data.on || (data.on = {})
  const existing = on[event]
  const callback = data.model.callback
  // - 获取或创建事件处理对象
  // - 检查是否已存在相同事件的处理函数
  // - 获取 `v-model` 定义的回调函数
  if (isDef(existing)) {
    if (
      Array.isArray(existing)
        ? existing.indexOf(callback) === -1
        : existing !== callback
    ) {
      on[event] = [callback].concat(existing)
    }
  } else {
    on[event] = callback
  }
}
