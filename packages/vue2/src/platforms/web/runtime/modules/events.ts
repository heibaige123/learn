import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { isIE, isFF, supportsPassive, isUsingMicroTask } from 'core/util/index'
import {
  RANGE_TOKEN,
  CHECKBOX_RADIO_TOKEN
} from 'web/compiler/directives/model'
import { currentFlushTimestamp } from 'core/observer/scheduler'
import { emptyNode } from 'core/vdom/patch'
import type { VNodeWithData } from 'types/vnode'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
/**
 * normalizeEvents函数 - 规范化只能在运行时确定的v-model事件标记
 * @param {Object} on - 事件监听器对象
 */
function normalizeEvents(on) {
  /* istanbul ignore if */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    const event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
  // This was originally intended to fix #4521 but no longer necessary
  // after 2.5. Keeping it for backwards compat with generated code from < 2.4
  /* istanbul ignore if */
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}

let target: any

/**
 * createOnceHandler函数 - 创建只执行一次的事件处理函数
 * @param {string} event - 事件名称
 * @param {Function} handler - 原始处理函数
 * @param {boolean} capture - 是否在捕获阶段执行
 * @returns {Function} - 包装后的一次性处理函数
 */
function createOnceHandler(event, handler, capture) {
  const _target = target // save current target element in closure
  return function onceHandler() {
    const res = handler.apply(null, arguments)
    if (res !== null) {
      remove(event, onceHandler, capture, _target)
    }
  }
}

// #9446: Firefox <= 53 (in particular, ESR 52) has incorrect Event.timeStamp
// implementation and does not fire microtasks in between event propagation, so
// safe to exclude.
const useMicrotaskFix = isUsingMicroTask && !(isFF && Number(isFF[1]) <= 53)

/**
 * add函数 - 添加DOM事件监听器，包含微任务修复
 * @param {string} name - 事件名称
 * @param {Function} handler - 事件处理函数
 * @param {boolean} capture - 是否捕获阶段
 * @param {boolean} passive - 是否被动模式
 */
function add(
  name: string,
  handler: Function,
  capture: boolean,
  passive: boolean
) {
  // async edge case #6566: inner click event triggers patch, event handler
  // attached to outer element during patch, and triggered again. This
  // happens because browsers fire microtask ticks between event propagation.
  // the solution is simple: we save the timestamp when a handler is attached,
  // and the handler would only fire if the event passed to it was fired
  // AFTER it was attached.
  if (useMicrotaskFix) {
    const attachedTimestamp = currentFlushTimestamp
    const original = handler
    //@ts-expect-error
    handler = original._wrapper = function (e) {
      if (
        // no bubbling, should always fire.
        // this is just a safety net in case event.timeStamp is unreliable in
        // certain weird environments...
        e.target === e.currentTarget ||
        // event is fired after handler attachment
        e.timeStamp >= attachedTimestamp ||
        // bail for environments that have buggy event.timeStamp implementations
        // #9462 iOS 9 bug: event.timeStamp is 0 after history.pushState
        // #9681 QtWebEngine event.timeStamp is negative value
        e.timeStamp <= 0 ||
        // #9448 bail if event is fired in another document in a multi-page
        // electron/nw.js app, since event.timeStamp will be using a different
        // starting reference
        e.target.ownerDocument !== document
      ) {
        return original.apply(this, arguments)
      }
    }
  }
  target.addEventListener(
    name,
    handler,
    supportsPassive ? { capture, passive } : capture
  )
}

/**
 * remove函数 - 移除DOM事件监听器
 * @param {string} name - 事件名称
 * @param {Function} handler - 事件处理函数
 * @param {boolean} capture - 是否捕获阶段
 * @param {HTMLElement} _target - 可选的目标元素
 */
function remove(
  name: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  ;(_target || target).removeEventListener(
    name,
    //@ts-expect-error
    handler._wrapper || handler,
    capture
  )
}

/**
 * updateDOMListeners函数 - 更新DOM元素的事件监听器
 * @param {VNodeWithData} oldVnode - 旧的虚拟节点
 * @param {VNodeWithData} vnode - 新的虚拟节点
 */
function updateDOMListeners(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}
  // vnode is empty when removing all listeners,
  // and use old vnode dom element
  target = vnode.elm || oldVnode.elm
  normalizeEvents(on)
  updateListeners(on, oldOn, add, remove, createOnceHandler, vnode.context)
  target = undefined
}

export default {
  create: updateDOMListeners,
  update: updateDOMListeners,
  // @ts-expect-error emptyNode has actually data
  destroy: (vnode: VNodeWithData) => updateDOMListeners(vnode, emptyNode)
}
