import { inBrowser, isIE9 } from 'core/util/index'
import { addClass, removeClass } from 'web/runtime/class-util'
import { remove, extend, cached } from 'shared/util'

/**
 * **规范化和合并 `<transition>` 组件的配置**，生成一个包含所有过渡相关 class 和钩子的对象，供后续过渡逻辑使用
 * @param def

 可以处理两种类型的配置：

 1. 字符串（如 `<transition name="fade">`）
 2. 对象（如 `<transition :name="xxx" :css="false" @enter="..." ...>`）

 */
export function resolveTransition(
  def?: string | Record<string, any>
): Record<string, any> | undefined {
  if (!def) {
    return
  }
  /* istanbul ignore else */
  if (typeof def === 'object') {
    const res = {}
    if (def.css !== false) {
      extend(res, autoCssTransition(def.name || 'v'))
    }
    extend(res, def)
    return res
  } else if (typeof def === 'string') {
    return autoCssTransition(def)
  }
}

/**
 * 根据传入的 name（比如 `'fade'`），自动生成一组 CSS 过渡 class 名字
 */
const autoCssTransition: (name: string) => Object = cached(name => {
  return {
    enterClass: `${name}-enter`,
    enterToClass: `${name}-enter-to`,
    enterActiveClass: `${name}-enter-active`,
    leaveClass: `${name}-leave`,
    leaveToClass: `${name}-leave-to`,
    leaveActiveClass: `${name}-leave-active`
  }
})

/** 判断当前环境是否可以使用 CSS 过渡 */
export const hasTransition = inBrowser && !isIE9
const TRANSITION = 'transition'
const ANIMATION = 'animation'

// Transition property/event sniffing
export let transitionProp = 'transition'
export let transitionEndEvent = 'transitionend'
export let animationProp = 'animation'
export let animationEndEvent = 'animationend'
if (hasTransition) {
  /* istanbul ignore if */
  if (
    window.ontransitionend === undefined &&
    window.onwebkittransitionend !== undefined
  ) {
    transitionProp = 'WebkitTransition'
    transitionEndEvent = 'webkitTransitionEnd'
  }
  if (
    window.onanimationend === undefined &&
    window.onwebkitanimationend !== undefined
  ) {
    animationProp = 'WebkitAnimation'
    animationEndEvent = 'webkitAnimationEnd'
  }
}

// binding to window is necessary to make hot reload work in IE in strict mode
const raf = inBrowser
  ? window.requestAnimationFrame
    ? window.requestAnimationFrame.bind(window)
    : setTimeout
  : /* istanbul ignore next */ fn => fn()

/**
 * 在下下帧（即连续两次 requestAnimationFrame）后执行传入的函数
 * @param fn
 */
export function nextFrame(fn: Function) {
  raf(() => {
    // @ts-expect-error
    raf(fn)
  })
}

/**
 * 给元素添加过渡（transition）相关的 class，并做去重和记录
 * @param el
 * @param cls
 */
export function addTransitionClass(el: any, cls: string) {
  const transitionClasses =
    el._transitionClasses || (el._transitionClasses = [])
  if (transitionClasses.indexOf(cls) < 0) {
    transitionClasses.push(cls)
    addClass(el, cls)
  }
}

/**
 * 移除过渡 class
 * @param el 需要移除过渡 class 的 DOM 元素
 * @param cls 要移除的 class 名称（字符串），比如 `'fade-enter'`、`'fade-leave-active'` 等
 */
export function removeTransitionClass(el: any, cls: string) {
  if (el._transitionClasses) {
    remove(el._transitionClasses, cls)
  }
  removeClass(el, cls)
}

/**
 * 在所有 CSS 过渡/动画结束后，安全地执行回调
 * @param el 需要监听过渡/动画结束事件的 DOM 元素。
 * @param expectedType 期望的动画类型，可以是 `'transition'` 或 `'animation'`，也可以不传（自动判断）。
 * @param cb 过渡/动画结束后要执行的回调函数。
 * @returns
 */
export function whenTransitionEnds(
  el: Element,
  expectedType: string | undefined,
  cb: Function
) {
  const { type, timeout, propCount } = getTransitionInfo(el, expectedType)
  if (!type) return cb()
  const event: string =
    type === TRANSITION ? transitionEndEvent : animationEndEvent
  let ended = 0
  const end = () => {
    el.removeEventListener(event, onEnd)
    cb()
  }
  const onEnd = e => {
    if (e.target === el) {
      if (++ended >= propCount) {
        end()
      }
    }
  }
  setTimeout(() => {
    if (ended < propCount) {
      end()
    }
  }, timeout + 1)
  el.addEventListener(event, onEnd)
}

const transformRE = /\b(transform|all)(,|$)/

/**
 *
 * @param el 需要检测 CSS 过渡/动画信息的 DOM 元素。
 * @param expectedType 期望的动画类型，可以是 `'transition'` 或 `'animation'`，也可以不传（自动判断）。
 * @returns
 */
export function getTransitionInfo(
  el: Element,
  expectedType?: string
): {
  /** 实际检测到的动画类型，可能是 `'transition'`、`'animation'` 或 `null`。 */
  type?: string | null
  /** 需要监听的属性数量（即有多少个不同的 transition/animation 属性）。 */
  propCount: number
  /** 所有属性中最长的动画/过渡总时长（单位：毫秒）。 */
  timeout: number
  /** 是否有 `transform` 相关的过渡属性（用于优化性能判断）。 */
  hasTransform: boolean
} {
  const styles: any = window.getComputedStyle(el)
  // JSDOM may return undefined for transition properties
  // 1. 获取 transition 和 animation 的 delay/duration 数组
  const transitionDelays: Array<string> = (
    styles[transitionProp + 'Delay'] || ''
  ).split(', ')
  const transitionDurations: Array<string> = (
    styles[transitionProp + 'Duration'] || ''
  ).split(', ')
  const transitionTimeout: number = getTimeout(
    transitionDelays,
    transitionDurations
  )
  const animationDelays: Array<string> = (
    styles[animationProp + 'Delay'] || ''
  ).split(', ')
  const animationDurations: Array<string> = (
    styles[animationProp + 'Duration'] || ''
  ).split(', ')
  const animationTimeout: number = getTimeout(
    animationDelays,
    animationDurations
  )

  // 1. 获取 transition 和 animation 的 delay/duration 数组
  let type: string | undefined | null
  let timeout = 0
  let propCount = 0
  /* istanbul ignore if */
  if (expectedType === TRANSITION) {
    if (transitionTimeout > 0) {
      type = TRANSITION
      timeout = transitionTimeout
      propCount = transitionDurations.length
    }
  } else if (expectedType === ANIMATION) {
    if (animationTimeout > 0) {
      type = ANIMATION
      timeout = animationTimeout
      propCount = animationDurations.length
    }
  } else {
    timeout = Math.max(transitionTimeout, animationTimeout)
    type =
      timeout > 0
        ? transitionTimeout > animationTimeout
          ? TRANSITION
          : ANIMATION
        : null
    propCount = type
      ? type === TRANSITION
        ? transitionDurations.length
        : animationDurations.length
      : 0
  }
  // 3. 检查是否有 transform 相关的过渡
  const hasTransform: boolean =
    type === TRANSITION && transformRE.test(styles[transitionProp + 'Property'])
  return {
    type,
    timeout,
    propCount,
    hasTransform
  }
}

/**
 * 计算一个元素所有 CSS 过渡/动画的最大持续时间（毫秒）
 * @param delays 一个字符串数组，表示 CSS 过渡/动画的 delay（延迟）时间，比如 `["0s", "0.2s"]`
 * @param durations 一个字符串数组，表示 CSS 过渡/动画的 duration（持续）时间，比如 `["0.3s", "0.5s"]`
 * @returns
 */
function getTimeout(delays: Array<string>, durations: Array<string>): number {
  /* istanbul ignore next */
  while (delays.length < durations.length) {
    delays = delays.concat(delays)
  }

  return Math.max.apply(
    null,
    durations.map((d, i) => {
      return toMs(d) + toMs(delays[i])
    })
  )
}

// Old versions of Chromium (below 61.0.3163.100) formats floating pointer numbers
// in a locale-dependent way, using a comma instead of a dot.
// If comma is not replaced with a dot, the input will be rounded down (i.e. acting
// as a floor function) causing unexpected behaviors
/**
 * 把 CSS 的时间字符串（如 `"0.3s"`）转换成毫秒数（如 `300`）
 * @param s   一个表示 CSS 时间的字符串，通常是 transition-duration 或 transition-delay 里的值，比如 `"0.3s"`、`"1.5s"`、`"0,2s"`（有些老浏览器会用逗号）
 * @returns
 */
function toMs(s: string): number {
  return Number(s.slice(0, -1).replace(',', '.')) * 1000
}
