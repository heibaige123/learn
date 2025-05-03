import { inBrowser, isIE9, warn } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { activeInstance } from 'core/instance/lifecycle'

import {
  once,
  isDef,
  isUndef,
  isObject,
  toNumber,
  isFunction
} from 'shared/util'

import {
  nextFrame,
  resolveTransition,
  whenTransitionEnds,
  addTransitionClass,
  removeTransitionClass
} from 'web/runtime/transition-util'

import type { VNodeWithData } from 'types/vnode'
import VNode from 'core/vdom/vnode'

/**
 * 处理元素“进入”时的过渡动画
 * @param vnode 需要执行过渡动画的虚拟节点（VNode），里面包含了 DOM 元素、过渡配置等信息。
 * @param toggleDisplay 用于在 `v-show` 场景下切换元素的显示/隐藏（比如 `el.style.display = ''`）

 - 添加/移除过渡相关的 class
 - 调用用户自定义的钩子函数
 - 监听动画/过渡结束事件
 - 兼容 appear（初次渲染）和普通 enter（后续插入）两种场景
 */
export function enter(vnode: VNodeWithData, toggleDisplay?: () => void) {
  const el: any = vnode.elm

  // call leave callback now
  // 清理上一次 leave 的回调
  if (isDef(el._leaveCb)) {
    el._leaveCb.cancelled = true
    el._leaveCb()
  }

  // 解析过渡配置
  const data = resolveTransition(vnode.data.transition)
  if (isUndef(data)) {
    return
  }

  // 防止重复 enter
  /* istanbul ignore if */
  if (isDef(el._enterCb) || el.nodeType !== 1) {
    return
  }

  const {
    css,
    type,
    enterClass,
    enterToClass,
    enterActiveClass,
    appearClass,
    appearToClass,
    appearActiveClass,
    beforeEnter,
    enter,
    afterEnter,
    enterCancelled,
    beforeAppear,
    appear,
    afterAppear,
    appearCancelled,
    duration
  } = data

  // activeInstance will always be the <transition> component managing this
  // transition. One edge case to check is when the <transition> is placed
  // as the root node of a child component. In that case we need to check
  // <transition>'s parent for appear check.
  let context = activeInstance
  let transitionNode = activeInstance.$vnode
  while (transitionNode && transitionNode.parent) {
    context = transitionNode.context
    transitionNode = transitionNode.parent
  }

  const isAppear = !context._isMounted || !vnode.isRootInsert

  if (isAppear && !appear && appear !== '') {
    return
  }

  const startClass = isAppear && appearClass ? appearClass : enterClass
  const activeClass =
    isAppear && appearActiveClass ? appearActiveClass : enterActiveClass
  const toClass = isAppear && appearToClass ? appearToClass : enterToClass

  const beforeEnterHook = isAppear ? beforeAppear || beforeEnter : beforeEnter
  const enterHook = isAppear ? (isFunction(appear) ? appear : enter) : enter
  const afterEnterHook = isAppear ? afterAppear || afterEnter : afterEnter
  const enterCancelledHook = isAppear
    ? appearCancelled || enterCancelled
    : enterCancelled

  const explicitEnterDuration: any = toNumber(
    isObject(duration) ? duration.enter : duration
  )

  if (__DEV__ && explicitEnterDuration != null) {
    checkDuration(explicitEnterDuration, 'enter', vnode)
  }

  const expectsCSS = css !== false && !isIE9
  const userWantsControl = getHookArgumentsLength(enterHook)

  const cb = (el._enterCb = once(() => {
    if (expectsCSS) {
      removeTransitionClass(el, toClass)
      removeTransitionClass(el, activeClass)
    }
    // @ts-expect-error
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, startClass)
      }
      enterCancelledHook && enterCancelledHook(el)
    } else {
      afterEnterHook && afterEnterHook(el)
    }
    el._enterCb = null
  }))

  if (!vnode.data.show) {
    // remove pending leave element on enter by injecting an insert hook
    mergeVNodeHook(vnode, 'insert', () => {
      const parent = el.parentNode
      const pendingNode =
        parent && parent._pending && parent._pending[vnode.key!]
      if (
        pendingNode &&
        pendingNode.tag === vnode.tag &&
        pendingNode.elm._leaveCb
      ) {
        pendingNode.elm._leaveCb()
      }
      enterHook && enterHook(el, cb)
    })
  }

  // start enter transition
  beforeEnterHook && beforeEnterHook(el)
  if (expectsCSS) {
    addTransitionClass(el, startClass)
    addTransitionClass(el, activeClass)
    nextFrame(() => {
      removeTransitionClass(el, startClass)
      // @ts-expect-error
      if (!cb.cancelled) {
        addTransitionClass(el, toClass)
        if (!userWantsControl) {
          if (isValidDuration(explicitEnterDuration)) {
            setTimeout(cb, explicitEnterDuration)
          } else {
            whenTransitionEnds(el, type, cb)
          }
        }
      }
    })
  }

  if (vnode.data.show) {
    toggleDisplay && toggleDisplay()
    enterHook && enterHook(el, cb)
  }

  if (!expectsCSS && !userWantsControl) {
    cb()
  }
}

/**
 * Vue 过渡动画系统中**处理元素离开（消失）动画**的核心实现
 * @param vnode 需要执行离开（leave）过渡动画的虚拟节点（VNode），包含了 DOM 元素、过渡配置等信息。
 * @param rm 当动画结束后需要调用的回调函数，通常用于从 DOM 中移除元素。

 - 它会自动管理 class 的添加/移除、钩子的调用、动画结束的监听和 DOM 的最终移除。
 - 支持 CSS 动画、JS 钩子、显式 duration、延迟 leave 等多种高级用法。
 */
export function leave(vnode: VNodeWithData, rm: Function) {
  const el: any = vnode.elm

  // 1. 如果正在执行 enter 动画，先取消并执行 enter 回调
  // call enter callback now
  if (isDef(el._enterCb)) {
    el._enterCb.cancelled = true
    el._enterCb()
  }

  // 2. 解析过渡配置
  const data = resolveTransition(vnode.data.transition)
  if (isUndef(data) || el.nodeType !== 1) {
    return rm()
  }

  // 3. 如果已经有 leave 回调，直接返回，避免重复触发
  /* istanbul ignore if */
  if (isDef(el._leaveCb)) {
    return
  }

  // 4. 解构出所有过渡相关的 class 和钩子
  const {
    css,
    type,
    leaveClass,
    leaveToClass,
    leaveActiveClass,
    beforeLeave,
    leave,
    afterLeave,
    leaveCancelled,
    delayLeave,
    duration
  } = data

  // 5. 判断是否需要 CSS 过渡，以及用户是否手动控制动画结束
  const expectsCSS = css !== false && !isIE9
  const userWantsControl = getHookArgumentsLength(leave)

  // 6. 处理显式 duration
  const explicitLeaveDuration: any = toNumber(
    isObject(duration) ? duration.leave : duration
  )

  // 7. 开发环境下检查 duration 合法性
  if (__DEV__ && isDef(explicitLeaveDuration)) {
    checkDuration(explicitLeaveDuration, 'leave', vnode)
  }

  // 8. 定义动画结束后的回调，只会执行一次
  const cb = (el._leaveCb = once(() => {
    // 清理 pending 记录
    if (el.parentNode && el.parentNode._pending) {
      el.parentNode._pending[vnode.key!] = null
    }
    // 移除 class
    if (expectsCSS) {
      removeTransitionClass(el, leaveToClass)
      removeTransitionClass(el, leaveActiveClass)
    }
    // 判断动画是否被取消
    // @ts-expect-error
    if (cb.cancelled) {
      if (expectsCSS) {
        removeTransitionClass(el, leaveClass)
      }
      leaveCancelled && leaveCancelled(el)
    } else {
      rm() // 真正移除元素
      afterLeave && afterLeave(el)
    }
    el._leaveCb = null
  }))
  // 9. 支持延迟 leave
  if (delayLeave) {
    delayLeave(performLeave)
  } else {
    performLeave()
  }
  // 10. 真正执行离开动画的函数
  function performLeave() {
    // the delayed leave may have already been cancelled
    // @ts-expect-error
    if (cb.cancelled) {
      return
    }
    // 记录 pending，防止同一元素多次 leave
    // record leaving element
    if (!vnode.data.show && el.parentNode) {
      ;(el.parentNode._pending || (el.parentNode._pending = {}))[vnode.key!] =
        vnode
    }
    beforeLeave && beforeLeave(el)
    if (expectsCSS) {
      addTransitionClass(el, leaveClass)
      addTransitionClass(el, leaveActiveClass)
      nextFrame(() => {
        removeTransitionClass(el, leaveClass)
        // @ts-expect-error
        if (!cb.cancelled) {
          addTransitionClass(el, leaveToClass)
          if (!userWantsControl) {
            if (isValidDuration(explicitLeaveDuration)) {
              setTimeout(cb, explicitLeaveDuration)
            } else {
              whenTransitionEnds(el, type, cb)
            }
          }
        }
      })
    }
    leave && leave(el, cb)
    if (!expectsCSS && !userWantsControl) {
      cb()
    }
  }
}

// only used in dev mode
/**
 * 这个函数**只在开发环境下使用**，用于检查 `<transition>` 组件里显式指定的 duration 是否有效
 * @param val 需要检查的过渡时长（duration）
 * @param name 表示当前检查的是哪种过渡时长，比如 `'enter'` 或 `'leave'`，用于提示信息
 * @param vnode 当前的虚拟节点（VNode），用于获取上下文（比如报错时可以定位到具体组件）
 */
function checkDuration(val, name, vnode) {
  if (typeof val !== 'number') {
    warn(
      `<transition> explicit ${name} duration is not a valid number - ` +
        `got ${JSON.stringify(val)}.`,
      vnode.context
    )
  } else if (isNaN(val)) {
    warn(
      `<transition> explicit ${name} duration is NaN - ` +
        'the duration expression might be incorrect.',
      vnode.context
    )
  }
}

/**
 * 用于**判断一个值是否是有效的数字**，常用于校验过渡动画的 duration（时长）参数
 * @param val 需要检查的值，理论上应该是一个数字（通常用于过渡动画的 duration）

 ## 举例

 ```js
 isValidDuration(300)      // true
 isValidDuration('300')    // false
 isValidDuration(NaN)      // false
 isValidDuration(undefined)// false
 isValidDuration(null)     // false
 ```
 */
function isValidDuration(val) {
  return typeof val === 'number' && !isNaN(val)
}

/**
 * Normalize a transition hook's argument length. The hook may be:
 * - a merged hook (invoker) with the original in .fns
 * - a wrapped component method (check ._length)
 * - a plain function (.length)
 */
/**
 * 用于**判断过渡钩子函数是否声明了第二个参数**（即回调函数 `done`）
 * @param fn 需要检测的函数，通常是过渡钩子（如 enter、leave、appear 等），也可能是被 Vue 包装过的 invoker 函数

 - 在 Vue 过渡动画中，如果钩子函数有第二个参数，说明用户想手动控制动画结束时机（比如异步动画），Vue 就不会自动结束动画，而是等你手动调用 `done`。
 - 如果没有第二个参数，Vue 会自动监听 CSS 动画/过渡事件来判断动画结束。
 */
function getHookArgumentsLength(fn: Function): boolean {
  if (isUndef(fn)) {
    return false
  }
  // @ts-expect-error
  const invokerFns = fn.fns
  if (isDef(invokerFns)) {
    // invoker
    return getHookArgumentsLength(
      Array.isArray(invokerFns) ? invokerFns[0] : invokerFns
    )
  } else {
    // @ts-expect-error
    return (fn._length || fn.length) > 1
  }
}

/**
 * 在节点插入或激活时，自动触发 enter 过渡动画
 * 但如果是 `v-show` 场景则跳过（因为 `v-show` 的显示切换由别的逻辑处理）。
 * @param _
 * @param vnode 当前需要处理的虚拟节点（VNode），包含了元素、数据、过渡配置等信息
 */
function _enter(_: any, vnode: VNodeWithData) {
  if (vnode.data.show !== true) {
    enter(vnode)
  }
}

export default inBrowser
  ? {
      create: _enter,
      activate: _enter,
      remove(vnode: VNode, rm: Function) {
        /* istanbul ignore else */
        if (vnode.data!.show !== true) {
          // @ts-expect-error
          leave(vnode, rm)
        } else {
          rm()
        }
      }
    }
  : {}
