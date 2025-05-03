/* not type checking this file because flow doesn't play well with Proxy */

import config from 'core/config'
import { warn, makeMap, isNative } from '../util/index'

/**
 * Vue 2 在**开发环境**中提供的一个强大调试和警告机制，用于拦截组件渲染过程中的属性访问，
 * 捕获常见错误并提供有用的警告。
 */
let initProxy

if (__DEV__) {
  /** 允许访问的全局变量列表 */
  const allowedGlobals = makeMap(
    'Infinity,undefined,NaN,isFinite,isNaN,' +
      'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
      'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,' +
      'require' // for Webpack/Browserify
  )

  /** 未定义属性警告函数 */
  const warnNonPresent = (target, key) => {
    warn(
      `Property or method "${key}" is not defined on the instance but ` +
        'referenced during render. Make sure that this property is reactive, ' +
        'either in the data option, or for class-based components, by ' +
        'initializing the property. ' +
        'See: https://v2.vuejs.org/v2/guide/reactivity.html#Declaring-Reactive-Properties.',
      target
    )
  }

  /** 保留前缀警告函数 */
  const warnReservedPrefix = (target, key) => {
    warn(
      `Property "${key}" must be accessed with "$data.${key}" because ` +
        'properties starting with "$" or "_" are not proxied in the Vue instance to ' +
        'prevent conflicts with Vue internals. ' +
        'See: https://v2.vuejs.org/v2/api/#data',
      target
    )
  }

  /** 检测浏览器是否支持 Proxy */
  const hasProxy = typeof Proxy !== 'undefined' && isNative(Proxy)

  // 特殊处理 keyCodes
  if (hasProxy) {
    const isBuiltInModifier = makeMap(
      'stop,prevent,self,ctrl,shift,alt,meta,exact'
    )
    config.keyCodes = new Proxy(config.keyCodes, {
      set(target, key: string, value) {
        if (isBuiltInModifier(key)) {
          warn(
            `Avoid overwriting built-in modifier in config.keyCodes: .${key}`
          )
          return false
        } else {
          target[key] = value
          return true
        }
      }
    })
  }

  /**  has 拦截器 - 用于 with 作用域中的属性检查 */
  const hasHandler = {
    has(target, key) {
      const has = key in target
      const isAllowed =
        allowedGlobals(key) ||
        (typeof key === 'string' &&
          key.charAt(0) === '_' &&
          !(key in target.$data))
      if (!has && !isAllowed) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return has || !isAllowed
    }
  }

  /** get 拦截器 - 用于直接属性访问 */
  const getHandler = {
    get(target, key) {
      if (typeof key === 'string' && !(key in target)) {
        if (key in target.$data) warnReservedPrefix(target, key)
        else warnNonPresent(target, key)
      }
      return target[key]
    }
  }

  /** 初始化代理 */
  initProxy = function initProxy(vm) {
    if (hasProxy) {
      // 根据渲染函数类型选择不同的处理器
      const options = vm.$options
      const handlers =
        options.render && options.render._withStripped ? getHandler : hasHandler
      // 创建渲染代理
      vm._renderProxy = new Proxy(vm, handlers)
    } else {
      // 不支持 Proxy 的环境直接使用实例本身
      vm._renderProxy = vm
    }
  }
}

export { initProxy }
