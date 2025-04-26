import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'
import type { Component } from 'types/component'
import type { InternalComponentOptions } from 'types/options'
import { EffectScope } from 'v3/reactivity/effectScope'

let uid = 0

/**
 * Vue 实例初始化的核心逻辑，
 */
export function initMixin(Vue: typeof Component) {
  /**
   * 1. 分配唯一标识符 `_uid`。
   * 2. 合并用户选项和默认选项。
   * 3. 初始化生命周期、事件、渲染、状态等核心功能。
   * 4. 调用生命周期钩子（如 `beforeCreate` 和 `created`）。
   * 5. 支持性能监控和自动挂载。
   */
  Vue.prototype._init = function (options?: Record<string, any>) {
    const vm: Component = this
    // a uid
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to mark this as a Vue instance without having to do instanceof
    /**
    * - 作用：标记当前实例为 Vue 实例。
      - 用途：
        - 避免通过 `instanceof` 检查来判断是否是 Vue 实例。
        - 内部逻辑可以通过 `_isVue` 快速判断。
    */
    vm._isVue = true
    // avoid instances from being observed
    /**
     * 标记当前实例不需要被 Vue 的响应式系统观察。
     * 避免 Vue 实例本身被响应式系统处理。
     */
    vm.__v_skip = true
    // effect scope
    // 为当前实例创建一个 `EffectScope`，用于管理响应式副作用。
    // `EffectScope` 是 Vue 3 中引入的功能，用于管理响应式副作用的生命周期。
    // 在 Vue 2 中，这部分代码是为了向 Vue 3 的架构靠拢。
    vm._scope = new EffectScope(true /* detached */)
    // #13134 edge case where a child component is manually created during the
    // render of a parent component
    vm._scope.parent = undefined
    vm._scope._vm = true
    // merge options
    // 合并用户传入的选项和默认选项。
    // 如果是内部组件（`options._isComponent` 为 `true`），调用 `initInternalComponent` 进行优化。
    // 否则，调用 `mergeOptions` 合并选项。
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      // 用于优化内部组件的实例化，避免动态选项合并的性能开销。
      initInternalComponent(vm, options as any)
    } else {
      // 合并用户选项和默认选项，生成最终的组件选项。
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor as any),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (__DEV__) {
      // 在开发模式下，使用代理（`Proxy`）捕获非法访问或警告。
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    initLifecycle(vm)
    initEvents(vm)
    initRender(vm)
    callHook(vm, 'beforeCreate', undefined, false /* setContext */)
    initInjections(vm) // resolve injections before data/props
    initState(vm)
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')

    // 在开发模式下，记录性能监控的结束点。
    // 使用 `measure` 计算从 `startTag` 到 `endTag` 的性能数据。
    // `formatComponentName` 格式化组件名称，用于性能日志。
    /* istanbul ignore if */
    if (__DEV__ && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 如果用户传入了 `el` 选项，则自动挂载到指定的 DOM 元素上。
    // 调用 `$mount` 方法，将组件挂载到 DOM 中。
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**
 * 优化内部组件的实例化。
 * @param vm
 * @param options
 */
export function initInternalComponent(
  vm: Component,
  options: InternalComponentOptions
) {
  const opts = (vm.$options = Object.create((vm.constructor as any).options))
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions!
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 解析构造函数的选项，支持继承和扩展。
 *
 * - 如果构造函数有父类（`Ctor.super`），递归解析父类的选项。
 * - 合并父类选项和当前类的扩展选项。
 * @param Ctor
 * @returns
 */
export function resolveConstructorOptions(Ctor: typeof Component) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

/**
 * 用于检测构造函数的选项是否被修改过。如果某些选项在运行时被动态修改
 *（例如通过扩展或继承），这个函数会返回这些被修改的选项，
 * 以便更新构造函数的选项缓存。
 * @param Ctor
 * @returns
 */
function resolveModifiedOptions(
  Ctor: typeof Component
): Record<string, any> | null {
  let modified
  // 当前构造函数的最新选项。
  // 这是运行时可能被动态修改的选项。
  const latest = Ctor.options
  // 构造函数的初始选项（在构造函数创建时缓存）。
  // 这是选项的“密封版本”，用于对比检测是否有修改。
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
