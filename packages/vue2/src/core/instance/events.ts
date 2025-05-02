import type { Component } from 'types/component'
import {
  tip,
  toArray,
  isArray,
  hyphenate,
  formatComponentName,
  invokeWithErrorHandling
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

/**
 * Vue 实例初始化阶段用于**初始化自定义事件系统**的函数。
 * @param vm
 */
export function initEvents(vm: Component) {
  // 初始化实例的事件存储对象（`_events`）。
  vm._events = Object.create(null)
  // 初始化实例的 hook 事件标记（`_hasHookEvent`）
  vm._hasHookEvent = false
  // init parent attached events
  // 如果有父组件通过 `v-on` 绑定了事件监听器（`_parentListeners`），则注册这些监听器。
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: any

/**
 * 注册事件监听器
 * @param event 事件名（字符串）
 * @param fn 事件处理函数
 */
function add(event, fn) {
  target.$on(event, fn)
}

/**
 * 移除事件监听器
 * @param event 事件名（字符串）
 * @param fn 事件处理函数
 */
function remove(event, fn) {
  target.$off(event, fn)
}

/**
 * 创建只执行一次的事件监听器, 即 `$once` 的实现原理
 * @param event 事件名
 * @param fn 原始事件处理函数
 * @returns 返回一个包装后的函数，第一次执行后会自动注销自己。
 */
function createOnceHandler(event, fn) {
  const _target = target
  return function onceHandler() {
    const res = fn.apply(null, arguments)
    if (res !== null) {
      _target.$off(event, onceHandler)
    }
  }
}

/**
 * - 批量更新组件的自定义事件监听器, 主要用于父组件通过 `v-on` 绑定子组件自定义事件时的处理。
 * - 这是事件系统和虚拟 DOM diff 的桥梁。
 * @param vm 当前组件实例
 * @param listeners 新的事件监听器对象（如 `{ foo: handler1, bar: handler2 }`）
 * @param oldListeners 旧的事件监听器对象（可选）
 */
export function updateComponentListeners(
  vm: Component,
  listeners: Object,
  oldListeners?: Object | null
) {
  target = vm
  updateListeners(
    listeners,
    oldListeners || {},
    add,
    remove,
    createOnceHandler,
    vm
  )
  target = undefined
}

/**
 * - Vue 内部用于**给 Vue.prototype 添加自定义事件相关方法**的混入函数
 * - 为每个 Vue 实例提供了完整的事件订阅/发布能力
 * @param Vue
 */
export function eventsMixin(Vue: typeof Component) {
  const hookRE = /^hook:/

  /**
   * 注册事件监听器。
   */
  Vue.prototype.$on = function (
    event: string | Array<string>,
    fn: Function
  ): Component {
    const vm: Component = this
    if (isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$on(event[i], fn)
      }
    } else {
      ;(vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  /**
   * 注册只执行一次的事件监听器。
   */
  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    function on() {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  /**
   * 移除事件监听
   */
  Vue.prototype.$off = function (
    event?: string | Array<string>,
    fn?: Function
  ): Component {
    const vm: Component = this
    // all
    if (!arguments.length) {
      vm._events = Object.create(null)
      return vm
    }
    // array of events
    if (isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        vm.$off(event[i], fn)
      }
      return vm
    }
    // specific event
    const cbs = vm._events[event!]
    if (!cbs) {
      return vm
    }
    if (!fn) {
      vm._events[event!] = null
      return vm
    }
    // specific handler
    let cb
    let i = cbs.length
    while (i--) {
      cb = cbs[i]
      if (cb === fn || cb.fn === fn) {
        cbs.splice(i, 1)
        break
      }
    }
    return vm
  }

  /**
   * 触发事件
   */
  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this
    if (__DEV__) {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
            `${formatComponentName(
              vm
            )} but the handler is registered for "${event}". ` +
            `Note that HTML attributes are case-insensitive and you cannot use ` +
            `v-on to listen to camelCase events when using in-DOM templates. ` +
            `You should probably use "${hyphenate(
              event
            )}" instead of "${event}".`
        )
      }
    }
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      const info = `event handler for "${event}"`
      for (let i = 0, l = cbs.length; i < l; i++) {
        invokeWithErrorHandling(cbs[i], vm, args, vm, info)
      }
    }
    return vm
  }
}
