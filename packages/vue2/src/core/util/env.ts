// can we use __proto__?
/**
 * 一个布尔值，用于检测当前环境是否支持 `__proto__` 属性。
 * 如果对象字面量中存在 `__proto__` 属性，则返回 `true`，否则返回 `false`。
 */
export const hasProto = '__proto__' in {}

/**
 * 表示当前代码是否运行在浏览器环境中。
 * 如果 `window` 对象被定义，则说明代码运行在浏览器中。
 */
export const inBrowser = typeof window !== 'undefined'

/**
 * 当前运行环境的用户代理字符串（User Agent）。
 * 如果运行在浏览器环境中，则返回 `window.navigator.userAgent` 的小写形式；
 * 否则返回 `false`。
 */
export const UA = inBrowser && window.navigator.userAgent.toLowerCase()

/**
 * 判断当前环境是否为 Internet Explorer (IE) 浏览器。
 *
 * 通过检测用户代理字符串 (User Agent) 中是否包含 "msie" 或 "trident" 来确定。
 * - "msie" 是旧版 IE 浏览器的标识。
 * - "trident" 是 IE 的渲染引擎标识。
 */
export const isIE = UA && /msie|trident/.test(UA)

/**
 * 判断当前用户代理是否为 IE9 浏览器。
 *
 * UA 是用户代理字符串，`indexOf('msie 9.0') > 0` 用于检测是否包含 IE9 的标识。
 */
export const isIE9 = UA && UA.indexOf('msie 9.0') > 0

/**
 * 判断当前用户代理字符串是否包含 'edge/'，用于检测是否为 Edge 浏览器。
 * 如果 UA 存在且包含 'edge/'，则返回 true。
 */
export const isEdge = UA && UA.indexOf('edge/') > 0

/**
 * 判断当前用户代理字符串是否包含 'android'，用于检测是否为 Android 设备。
 * 如果 UA 存在且包含 'android'，则返回 true。
 */
export const isAndroid = UA && UA.indexOf('android') > 0

/**
 * 判断当前用户代理是否为 iOS 设备。
 *
 * 通过检测用户代理字符串（UA）中是否包含 `iphone`、`ipad`、`ipod` 或 `ios` 来确定。
 */
export const isIOS = UA && /iphone|ipad|ipod|ios/.test(UA)

/**
 * 判断当前用户代理是否为 Chrome 浏览器。
 *
 * 通过检测用户代理字符串（UA）中是否包含 `chrome/`，并且排除 Edge 浏览器。
 */
export const isChrome = UA && /chrome\/\d+/.test(UA) && !isEdge

/**
 * 判断当前用户代理是否为 Firefox 浏览器。
 *
 * 通过检测用户代理字符串（UA）中是否包含 `firefox/`。
 */
export const isFF = UA && UA.match(/firefox\/(\d+)/)

/**
 * 检测当前环境是否支持 `Object.prototype.watch` 方法。
 *
 * Firefox 浏览器在 `Object.prototype` 上提供了一个 `watch` 方法。
 */
// @ts-expect-error firebox support
export const nativeWatch = {}.watch

/**
 * 一个布尔值，用于检测当前环境是否支持 `passive` 事件监听器。
 *
 * 如果支持，则 `supportsPassive` 为 `true`。
 */
export let supportsPassive = false
if (inBrowser) {
  try {
    const opts = {}
    Object.defineProperty(opts, 'passive', {
      get() {
        /* istanbul ignore next */
        supportsPassive = true
      }
    } as object) // https://github.com/facebook/flow/issues/285
    window.addEventListener('test-passive', null as any, opts)
  } catch (e: any) {}
}

// this needs to be lazy-evaled because vue may be required before
// vue-server-renderer can set VUE_ENV
let _isServer
/**
 * 检测当前代码是否运行在服务端渲染环境中。
 *
 * 如果 `_isServer` 未定义，则通过检测 `global.process.env.VUE_ENV` 是否为 `server` 来确定。
 * 如果运行在浏览器环境中，则返回 `false`。
 */
export const isServerRendering = () => {
  if (_isServer === undefined) {
    if (!inBrowser && typeof global !== 'undefined') {
      _isServer =
        global['process'] && global['process'].env.VUE_ENV === 'server'
    } else {
      _isServer = false
    }
  }
  return _isServer
}

/**
 * 检测是否存在 Vue Devtools。
 *
 * 如果 `window.__VUE_DEVTOOLS_GLOBAL_HOOK__` 被定义，则返回 `true`。
 */
export const devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__

/**
 * 检测给定的构造函数是否为原生代码实现。
 *
 * @param Ctor - 要检测的构造函数。
 * @returns 如果是原生代码实现，则返回 `true`；否则返回 `false`。
 */
export function isNative(Ctor: any): boolean {
  return typeof Ctor === 'function' && /native code/.test(Ctor.toString())
}

let _Set // $flow-disable-line
/* istanbul ignore if */ if (typeof Set !== 'undefined' && isNative(Set)) {
  // use native Set when available.
  _Set = Set
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  _Set = class Set implements SimpleSet {
    set: Record<string, boolean> = Object.create(null)

    has(key: string | number) {
      return this.set[key] === true
    }
    add(key: string | number) {
      this.set[key] = true
    }
    clear() {
      this.set = Object.create(null)
    }
  }
}
/**
 * 一个简单的 Set 接口，用于存储和操作唯一值。
 */

export interface SimpleSet {
  /**
   * 检测 Set 中是否包含指定的键。
   *
   * @param key - 要检测的键。
   * @returns 如果包含，则返回 `true`；否则返回 `false`。
   */
  has(key: string | number): boolean

  /**
   * 向 Set 中添加一个键。
   *
   * @param key - 要添加的键。
   */
  add(key: string | number): any

  /**
   * 清空 Set 中的所有键。
   */
  clear(): void
}

/**
 * 一个 Set 的实现，用于存储唯一值。
 *
 * 如果原生 Set 可用，则使用原生 Set；否则使用自定义实现。
 */
export { _Set }
