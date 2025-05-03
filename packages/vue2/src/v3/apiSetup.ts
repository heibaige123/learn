import { Component } from 'types/component'
import { PropOptions } from 'types/options'
import { popTarget, pushTarget } from '../core/observer/dep'
import { def, invokeWithErrorHandling, isReserved, warn } from '../core/util'
import VNode from '../core/vdom/vnode'
import {
  bind,
  emptyObject,
  isArray,
  isFunction,
  isObject
} from '../shared/util'
import { currentInstance, setCurrentInstance } from './currentInstance'
import { shallowReactive } from './reactivity/reactive'
import { proxyWithRefUnwrap } from './reactivity/ref'

/**
 * @internal
 */
export interface SetupContext {
  attrs: Record<string, any>
  listeners: Record<string, Function | Function[]>
  slots: Record<string, () => VNode[]>
  emit: (event: string, ...args: any[]) => any
  expose: (exposed: Record<string, any>) => void
}

export function initSetup(vm: Component) {
  const options = vm.$options
  const setup = options.setup
  if (setup) {
    const ctx = (vm._setupContext = createSetupContext(vm))

    setCurrentInstance(vm)
    pushTarget()
    const setupResult = invokeWithErrorHandling(
      setup,
      null,
      [vm._props || shallowReactive({}), ctx],
      vm,
      `setup`
    )
    popTarget()
    setCurrentInstance()

    if (isFunction(setupResult)) {
      // render function
      // @ts-ignore
      options.render = setupResult
    } else if (isObject(setupResult)) {
      // bindings
      if (__DEV__ && setupResult instanceof VNode) {
        warn(
          `setup() should not return VNodes directly - ` +
            `return a render function instead.`
        )
      }
      vm._setupState = setupResult
      // __sfc indicates compiled bindings from <script setup>
      if (!setupResult.__sfc) {
        for (const key in setupResult) {
          if (!isReserved(key)) {
            proxyWithRefUnwrap(vm, setupResult, key)
          } else if (__DEV__) {
            warn(`Avoid using variables that start with _ or $ in setup().`)
          }
        }
      } else {
        // exposed for compiled render fn
        const proxy = (vm._setupProxy = {})
        for (const key in setupResult) {
          if (key !== '__sfc') {
            proxyWithRefUnwrap(proxy, setupResult, key)
          }
        }
      }
    } else if (__DEV__ && setupResult !== undefined) {
      warn(
        `setup() should return an object. Received: ${
          setupResult === null ? 'null' : typeof setupResult
        }`
      )
    }
  }
}

function createSetupContext(vm: Component): SetupContext {
  let exposeCalled = false
  return {
    get attrs() {
      if (!vm._attrsProxy) {
        const proxy = (vm._attrsProxy = {})
        def(proxy, '_v_attr_proxy', true)
        syncSetupProxy(proxy, vm.$attrs, emptyObject, vm, '$attrs')
      }
      return vm._attrsProxy
    },
    get listeners() {
      if (!vm._listenersProxy) {
        const proxy = (vm._listenersProxy = {})
        syncSetupProxy(proxy, vm.$listeners, emptyObject, vm, '$listeners')
      }
      return vm._listenersProxy
    },
    get slots() {
      return initSlotsProxy(vm)
    },
    emit: bind(vm.$emit, vm) as any,
    expose(exposed?: Record<string, any>) {
      if (__DEV__) {
        if (exposeCalled) {
          warn(`expose() should be called only once per setup().`, vm)
        }
        exposeCalled = true
      }
      if (exposed) {
        Object.keys(exposed).forEach(key =>
          proxyWithRefUnwrap(vm, exposed, key)
        )
      }
    }
  }
}

/**
 * 用于**同步两个对象之间的属性**，保持代理对象与源对象的属性一致：
 1. **添加新属性**：如果源对象中有新的键，在代理对象上创建相应的代理属性。
 2. **检测值变化**：如果已有属性的值发生变化，标记为有变化。
 3. **移除旧属性**：如果代理对象中有源对象不存在的键，从代理对象中删除它们。
 4. **返回变化状态**：表明本次同步是否造成了任何实际变化。
 * @param to 目标代理对象，需要被同步更新的对象。
 * @param from 源对象，包含最新数据的对象。
 * @param prev 上一次的源对象，用于比较值是否发生变化。
 * @param instance Vue 组件实例，用于创建代理属性。
 * @param type 代理类型标识符，例如 '$attrs'、'$listeners' 等。
 * @returns
 */
export function syncSetupProxy(
  to: any,
  from: any,
  prev: any,
  instance: Component,
  type: string
) {
  let changed = false
  // 1. 处理新增或更新的属性
  for (const key in from) {
    if (!(key in to)) {
      // 新属性：添加代理
      changed = true
      defineProxyAttr(to, key, instance, type)
    } else if (from[key] !== prev[key]) {
      // 已有属性但值变化
      changed = true
    }
  }
  // 2. 处理已被删除的属性
  for (const key in to) {
    if (!(key in from)) {
      // 属性已从源对象中移除：删除代理属性
      changed = true
      delete to[key]
    }
  }
  return changed
}

/**
 * 定义一个**只读代理属性**
 * @param proxy 目标对象，将在这个对象上定义新的属性。
 * @param key 要定义的属性名。
 * @param instance Vue 组件实例，包含实际数据的源对象。
 * @param type 指定要代理的实例属性类型，例如 'props'、'attrs'、'listeners' 等。这决定了从哪个实例属性中读取值。
 */
function defineProxyAttr(
  proxy: any,
  key: string,
  instance: Component,
  type: string
) {
  Object.defineProperty(proxy, key, {
    enumerable: true,
    configurable: true,
    get() {
      return instance[type][key]
    }
  })
}

/**
 * 初始化插槽代理对象，只在第一次调用时创建代理对象。
 * @param vm Vue 组件实例，需要初始化插槽代理的组件。
 * @returns
 */
function initSlotsProxy(vm: Component) {
  if (!vm._slotsProxy) {
    // 只在第一次调用时创建代理对象
    syncSetupSlots((vm._slotsProxy = {}), vm.$scopedSlots)
  }
  return vm._slotsProxy
}

/**
 * 同步槽位数据到目标对象
 * @param to 目标对象，通常是槽位代理对象（`vm._slotsProxy`），需要被同步的对象。
 * @param from 源对象，通常是最新的槽位数据（`vm.$scopedSlots`），包含当前最新的插槽内容。
 */
export function syncSetupSlots(to: any, from: any) {
  // 1. 将 from 中的所有属性复制到 to 中
  for (const key in from) {
    to[key] = from[key]
  }
  // 2. 删除 to 中存在但 from 中不存在的属性
  for (const key in to) {
    if (!(key in from)) {
      delete to[key]
    }
  }
}

/**
 * @internal use manual type def because public setup context type relies on
 * legacy VNode types
 */
export function useSlots(): SetupContext['slots'] {
  return getContext().slots
}

/**
 * @internal use manual type def because public setup context type relies on
 * legacy VNode types
 */
export function useAttrs(): SetupContext['attrs'] {
  return getContext().attrs
}

/**
 * Vue 2 only
 * @internal use manual type def because public setup context type relies on
 * legacy VNode types
 */
export function useListeners(): SetupContext['listeners'] {
  return getContext().listeners
}

/**
 * 获取当前 Vue 组件实例的 setup 上下文对象，这个上下文对象包含了组件的 attrs、slots、emit 等属性，供组合式 API 使用。
 * @returns 组合式 API 的上下文对象，包含 `attrs`、`slots`、`emit` 等属性，用于在 `setup` 函数中提供除 props 外的其他组件功能。
 */
function getContext(): SetupContext {
  if (__DEV__ && !currentInstance) {
    warn(`useContext() called without active instance.`)
  }
  const vm = currentInstance!
  return vm._setupContext || (vm._setupContext = createSetupContext(vm))
}

/**
 * Runtime helper for merging default declarations. Imported by compiled code
 * only.
 * @internal
 */
export function mergeDefaults(
  raw: string[] | Record<string, PropOptions>,
  defaults: Record<string, any>
): Record<string, PropOptions> {
  const props = isArray(raw)
    ? raw.reduce(
        (normalized, p) => ((normalized[p] = {}), normalized),
        {} as Record<string, PropOptions>
      )
    : raw
  for (const key in defaults) {
    const opt = props[key]
    if (opt) {
      if (isArray(opt) || isFunction(opt)) {
        props[key] = { type: opt, default: defaults[key] }
      } else {
        opt.default = defaults[key]
      }
    } else if (opt === null) {
      props[key] = { default: defaults[key] }
    } else if (__DEV__) {
      warn(`props default key "${key}" has no corresponding declaration.`)
    }
  }
  return props
}
