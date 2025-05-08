import config from '../config'
import Watcher, { WatcherOptions } from '../observer/watcher'
import { mark, measure } from '../util/perf'
import VNode, { createEmptyVNode } from '../vdom/vnode'
import { updateComponentListeners } from './events'
import { resolveSlots } from './render-helpers/resolve-slots'
import { toggleObserving } from '../observer/index'
import { pushTarget, popTarget } from '../observer/dep'
import type { Component } from 'types/component'
import type { MountedComponentVNode } from 'types/vnode'

import {
  warn,
  noop,
  remove,
  validateProp,
  invokeWithErrorHandling
} from '../util/index'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'
import { getCurrentScope } from 'v3/reactivity/effectScope'
import { syncSetupProxy } from 'v3/apiSetup'

/**
 * 跟踪当前正在更新或创建的组件实例。它相当于 Vue 内部的"当前上下文"指针
 */
export let activeInstance: any = null
/**
 * **状态标志**，表示当前是否正在更新子组件。
 */
export let isUpdatingChildComponent: boolean = false

/**
 * 设置当前活动实例的组件对象
 * @param vm 要设置为当前活动实例的组件对象。
 * @returns
 */
export function setActiveInstance(vm: Component) {
  const prevActiveInstance = activeInstance
  activeInstance = vm
  return () => {
    activeInstance = prevActiveInstance
  }
}

/**
 * 初始化组件实例，建立了组件之间的关系，为后续的组件通信、生命周期钩子执行等功能奠定了基础
 * @param vm 要初始化生命周期属性的 Vue 组件实例。
 */
export function initLifecycle(vm: Component) {
  const options = vm.$options

  // 1. 寻找第一个非抽象父组件
  let parent = options.parent
  if (parent && !options.abstract) {
    while (parent.$options.abstract && parent.$parent) {
      parent = parent.$parent
    }
    parent.$children.push(vm)
  }

  // 2. 建立组件关系
  vm.$parent = parent
  vm.$root = parent ? parent.$root : vm

  // 3. 初始化子组件和引用集合
  vm.$children = []
  vm.$refs = {}

  // 4. 初始化 provide/inject 系统
  vm._provided = parent ? parent._provided : Object.create(null)

  // 5. 初始化内部状态标志
  vm._watcher = null
  vm._inactive = null
  vm._directInactive = false
  vm._isMounted = false
  vm._isDestroyed = false
  vm._isBeingDestroyed = false
}

/**
 * 向 Vue 原型上添加三个核心方法，这些方法处理组件的更新、强制刷新和销毁过程。
 * @param Vue Vue 构造函数，用于向其原型上添加方法。
 */
export function lifecycleMixin(Vue: typeof Component) {
  Vue.prototype._update = function (vnode: VNode, hydrating?: boolean) {
    const vm: Component = this
    const prevEl = vm.$el
    const prevVnode = vm._vnode
    const restoreActiveInstance = setActiveInstance(vm)
    vm._vnode = vnode
    // Vue.prototype.__patch__ is injected in entry points
    // based on the rendering backend used.
    // 应用 vnode 到真实 DOM
    if (!prevVnode) {
      // 初次渲染
      vm.$el = vm.__patch__(vm.$el, vnode, hydrating, false /* removeOnly */)
    } else {
      // 更新渲染
      vm.$el = vm.__patch__(prevVnode, vnode)
    }
    restoreActiveInstance()
    // 更新 DOM 元素上的 __vue__ 引用
    if (prevEl) {
      prevEl.__vue__ = null
    }
    if (vm.$el) {
      vm.$el.__vue__ = vm
    }
    // 处理 HOC (高阶组件) 的特殊情况
    let wrapper: Component | undefined = vm
    while (
      wrapper &&
      wrapper.$vnode &&
      wrapper.$parent &&
      wrapper.$vnode === wrapper.$parent._vnode
    ) {
      wrapper.$parent.$el = wrapper.$el
      wrapper = wrapper.$parent
    }
    // updated hook is called by the scheduler to ensure that children are
    // updated in a parent's updated hook.
  }

  /**
   * 强制组件重新渲染
   */
  Vue.prototype.$forceUpdate = function () {
    const vm: Component = this
    if (vm._watcher) {
      vm._watcher.update()
    }
  }

  /**
   * 销毁组件实例
   */
  Vue.prototype.$destroy = function () {
    const vm: Component = this
    // 防止重复销毁
    if (vm._isBeingDestroyed) {
      return
    }
    // 调用生命周期钩子
    callHook(vm, 'beforeDestroy')
    vm._isBeingDestroyed = true
    // 从父组件中移除自身
    const parent = vm.$parent
    if (parent && !parent._isBeingDestroyed && !vm.$options.abstract) {
      remove(parent.$children, vm)
    }
    // teardown scope. this includes both the render watcher and other
    // watchers created
    // 清理所有 watcher
    vm._scope.stop()
    // remove reference from data ob
    // frozen object may not have observer.
    // 减少数据观察者计数
    if (vm._data.__ob__) {
      vm._data.__ob__.vmCount--
    }
    // 标记为已销毁
    vm._isDestroyed = true
    // invoke destroy hooks on current rendered tree
    // 销毁 DOM 树
    vm.__patch__(vm._vnode, null)
    // fire destroyed hook
    // 调用销毁后钩子
    callHook(vm, 'destroyed')
    // turn off all instance listeners.
    // 关闭所有事件监听
    vm.$off()
    // remove __vue__ reference
    // 清除 DOM 引用
    if (vm.$el) {
      vm.$el.__vue__ = null
    }
    // release circular reference (#6759)
    // 清除循环引用
    if (vm.$vnode) {
      vm.$vnode.parent = null
    }
  }
}

/**
 * 将 Vue 组件实例连接到 DOM，并建立响应式更新机制
 * @param vm 要挂载的 Vue 组件实例。
 * @param el 要挂载到的 DOM 元素。
 * @param hydrating 是否是服务端渲染的水合模式。在 SSR 水合过程中为 `true`，客户端渲染为 `false`。
 * @returns
 */
export function mountComponent(
  vm: Component,
  el: Element | null | undefined,
  hydrating?: boolean
): Component {
  // 1. 设置元素引用
  vm.$el = el
  // 2. 检查渲染函数
  if (!vm.$options.render) {
    // @ts-expect-error invalid type
    vm.$options.render = createEmptyVNode
    // 开发环境警告...
    if (__DEV__) {
      /* istanbul ignore if */
      if (
        (vm.$options.template && vm.$options.template.charAt(0) !== '#') ||
        vm.$options.el ||
        el
      ) {
        warn(
          'You are using the runtime-only build of Vue where the template ' +
            'compiler is not available. Either pre-compile the templates into ' +
            'render functions, or use the compiler-included build.',
          vm
        )
      } else {
        warn(
          'Failed to mount component: template or render function not defined.',
          vm
        )
      }
    }
  }
  // 3. 调用 beforeMount 钩子
  callHook(vm, 'beforeMount')

  // 4. 定义更新函数
  let updateComponent
  /* istanbul ignore if */
  if (__DEV__ && config.performance && mark) {
    // 开发环境性能监测...
    updateComponent = () => {
      const name = vm._name
      const id = vm._uid
      const startTag = `vue-perf-start:${id}`
      const endTag = `vue-perf-end:${id}`

      mark(startTag)
      const vnode = vm._render()
      mark(endTag)
      measure(`vue ${name} render`, startTag, endTag)

      mark(startTag)
      vm._update(vnode, hydrating)
      mark(endTag)
      measure(`vue ${name} patch`, startTag, endTag)
    }
  } else {
    updateComponent = () => {
      vm._update(vm._render(), hydrating)
    }
  }

  // 5. 创建渲染 Watcher
  const watcherOptions: WatcherOptions = {
    before() {
      if (vm._isMounted && !vm._isDestroyed) {
        callHook(vm, 'beforeUpdate')
      }
    }
  }

  if (__DEV__) {
    watcherOptions.onTrack = e => callHook(vm, 'renderTracked', [e])
    watcherOptions.onTrigger = e => callHook(vm, 'renderTriggered', [e])
  }

  // we set this to vm._watcher inside the watcher's constructor
  // since the watcher's initial patch may call $forceUpdate (e.g. inside child
  // component's mounted hook), which relies on vm._watcher being already defined
  new Watcher(
    vm,
    updateComponent,
    noop,
    watcherOptions,
    true /* isRenderWatcher */
  )
  hydrating = false

  // flush buffer for flush: "pre" watchers queued in setup()
  // 处理 setup() 中的 pre watchers
  const preWatchers = vm._preWatchers
  if (preWatchers) {
    for (let i = 0; i < preWatchers.length; i++) {
      preWatchers[i].run()
    }
  }

  // manually mounted instance, call mounted on self
  // mounted is called for render-created child components in its inserted hook
  // 处理根组件的 mounted 钩子
  if (vm.$vnode == null) {
    vm._isMounted = true
    callHook(vm, 'mounted')
  }
  return vm
}

/**
 * 确定是否需要强制子组件重新渲染，主要基于插槽内容变化
 * @param vm 需要更新的子组件实例。
 * @param propsData 需要更新的props数据。
 * @param listeners 需要更新的listeners数据。
 * @param parentVnode 父组件的虚拟节点。
 * @param renderChildren 需要更新的子组件的渲染子节点。
 */
export function updateChildComponent(
  vm: Component,
  propsData: Record<string, any> | null | undefined,
  listeners: Record<string, Function | Array<Function>> | undefined,
  parentVnode: MountedComponentVNode,
  renderChildren?: Array<VNode> | null
) {
  if (__DEV__) {
    // 在开发环境下设置标志，用于抑制特定警告（如修改只读属性的警告）
    isUpdatingChildComponent = true
  }

  // determine whether component has slot children
  // we need to do this before overwriting $options._renderChildren.

  // check if there are dynamic scopedSlots (hand-written or compiled but with
  // dynamic slot names). Static scoped slots compiled from template has the
  // "$stable" marker.
  const newScopedSlots = parentVnode.data.scopedSlots
  const oldScopedSlots = vm.$scopedSlots
  /** 检查作用域插槽是否有变化 */
  const hasDynamicScopedSlot = !!(
    // 新插槽不稳定（`!$stable`）
    (
      (newScopedSlots && !newScopedSlots.$stable) ||
      // 旧插槽不稳定
      (oldScopedSlots !== Object.freeze({}) && !oldScopedSlots.$stable) ||
      // 新插槽与旧插槽的键不相等
      (newScopedSlots && vm.$scopedSlots.$key !== newScopedSlots.$key) ||
      // 插槽从有到无或从无到有
      (!newScopedSlots && vm.$scopedSlots.$key)
    )
  )

  // Any static slot children from the parent may have changed during parent's
  // update. Dynamic scoped slots may also have changed. In such cases, a forced
  // update is necessary to ensure correctness.
  /** 确定是否需要强制子组件重新渲染，主要基于插槽内容变化 */
  let needsForceUpdate = !!(
    // 有新的静态插槽
    (
      renderChildren || // has new static slots
      // 有旧的静态插槽
      vm.$options._renderChildren || // has old static slots
      // 有动态作用域插槽变化
      hasDynamicScopedSlot
    )
  )

  const prevVNode = vm.$vnode
  vm.$options._parentVnode = parentVnode
  // 更新组件占位符节点，不触发重渲染
  vm.$vnode = parentVnode // update vm's placeholder node without re-render

  if (vm._vnode) {
    // 更新子树的父引用
    // update child tree's parent
    vm._vnode.parent = parentVnode
  }
  vm.$options._renderChildren = renderChildren

  // update $attrs and $listeners hash
  // these are also reactive so they may trigger child update if the child
  // used them during render
  // 更新 attrs
  const attrs = parentVnode.data.attrs || Object.freeze({})
  if (vm._attrsProxy) {
    // force update if attrs are accessed and has changed since it may be
    // passed to a child component.
    // 如果 attrs 被访问且有变化，强制更新
    if (
      syncSetupProxy(
        vm._attrsProxy,
        attrs,
        (prevVNode.data && prevVNode.data.attrs) || Object.freeze({}),
        vm,
        '$attrs'
      )
    ) {
      needsForceUpdate = true
    }
  }
  vm.$attrs = attrs

  // 更新监听器
  listeners = listeners || Object.freeze({})
  const prevListeners = vm.$options._parentListeners
  if (vm._listenersProxy) {
    syncSetupProxy(
      vm._listenersProxy,
      listeners,
      prevListeners || Object.freeze({}),
      vm,
      '$listeners'
    )
  }
  vm.$listeners = vm.$options._parentListeners = listeners
  updateComponentListeners(vm, listeners, prevListeners)

  // 更新 props
  if (propsData && vm.$options.props) {
    // 临时关闭观察者系统
    toggleObserving(false)
    const props = vm._props
    const propKeys = vm.$options._propKeys || []
    for (let i = 0; i < propKeys.length; i++) {
      const key = propKeys[i]
      const propOptions: any = vm.$options.props // wtf flow?
      props[key] = validateProp(key, propOptions, propsData, vm)
    }
    // 恢复观察者系统
    toggleObserving(true)
    // 保留原始 propsData 的副本
    vm.$options.propsData = propsData
  }

  // resolve slots + force update if has children
  if (needsForceUpdate) {
    vm.$slots = resolveSlots(renderChildren, parentVnode.context)
    vm.$forceUpdate()
  }

  if (__DEV__) {
    isUpdatingChildComponent = false
  }
}

/**
 * 判断一个组件是否位于一个不活跃的组件树中。
 * 在 Vue 的组件激活/停用系统中，如果父组件不活跃，那么其所有子组件也被视为不活跃，无论它们自身的 `_inactive` 标志如何。
 * @param vm 要检查的 Vue 组件实例。
 * @returns 如果组件位于不活跃的组件树中，则返回 `true`，否则返回 `false`。
 */
function isInInactiveTree(vm) {
  while (vm && (vm = vm.$parent)) {
    if (vm._inactive) return true
  }
  return false
}

/**
 * 激活一个子组件。
 * 如果直接激活，会跳过不活跃的父组件。
 * @param vm 要激活的 Vue 组件实例。
 * @param direct 是否是直接激活。如果为 `true`，表示这个组件是被直接指定激活的，而不是因为父组件激活而被连带激活的。
 * @returns 如果组件成功激活，则返回 `true`，否则返回 `false`。
 */
export function activateChildComponent(vm: Component, direct?: boolean) {
  // 1. 处理直接激活的情况
  if (direct) {
    vm._directInactive = false
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // 2. 处理非直接激活但组件被直接停用的情况
  else if (vm._directInactive) {
    return
  }

  // 3. 执行激活流程
  if (vm._inactive || vm._inactive === null) {
    vm._inactive = false
    // 递归激活所有子组件
    for (let i = 0; i < vm.$children.length; i++) {
      activateChildComponent(vm.$children[i])
    }
    // 调用 activated 生命周期钩子
    callHook(vm, 'activated')
  }
}

/**
 * 管理组件活跃状态而不必销毁和重建组件，从而提升性能和用户体验
 * @param vm 要停用的 Vue 组件实例。
 * @param direct 是否是直接停用。如果为 `true`，表示这个组件是被直接指定停用的，而不是因为父组件停用而被连带停用的。
 * @returns
 */
export function deactivateChildComponent(vm: Component, direct?: boolean) {
  // 1. 处理直接停用标记
  if (direct) {
    vm._directInactive = true
    if (isInInactiveTree(vm)) {
      return
    }
  }
  // 2. 只有组件未停用时才执行停用流程
  if (!vm._inactive) {
    // 标记组件为不活跃
    vm._inactive = true
    // 递归停用所有子组件
    for (let i = 0; i < vm.$children.length; i++) {
      deactivateChildComponent(vm.$children[i])
    }
    // 调用 deactivated 生命周期钩子
    callHook(vm, 'deactivated')
  }
}

/**
 *
 * @param vm 要调用生命周期钩子的组件实例。
 * @param hook 要调用的钩子名称，如 'created'、'mounted'、'updated' 等。
 * @param args 可选的参数数组，将传递给钩子函数。大多数生命周期钩子不需要参数，但一些特殊钩子（如 'errorCaptured'）可能需要。
 * @param setContext 是否设置组合式 API 的当前实例上下文。这是 Vue 2.7+ 为兼容 Vue 3 Composition API 而添加的参数。
 */
export function callHook(
  vm: Component,
  hook: string,
  args?: any[],
  setContext = true
) {
  // #7573 disable dep collection when invoking lifecycle hooks
  // 1. 禁用依赖收集
  pushTarget()

  // 2. 保存当前组合式 API 上下文
  const prevInst = currentInstance
  const prevScope = getCurrentScope()

  // 3. 设置新的上下文（如果需要）
  setContext && setCurrentInstance(vm)

  // 4. 获取并执行钩子函数
  const handlers = vm.$options[hook]
  const info = `${hook} hook`
  if (handlers) {
    for (let i = 0, j = handlers.length; i < j; i++) {
      invokeWithErrorHandling(handlers[i], vm, args || null, vm, info)
    }
  }

  // 5. 触发钩子事件（如果已启用）
  if (vm._hasHookEvent) {
    vm.$emit('hook:' + hook)
  }

  // 6. 恢复之前的上下文
  if (setContext) {
    setCurrentInstance(prevInst)
    prevScope && prevScope.on()
  }

  // 7. 恢复依赖收集
  popTarget()
}
