import config from '../config'
import { warn } from './debug'
import { inBrowser } from './env'
import { isPromise } from 'shared/util'
import { pushTarget, popTarget } from '../observer/dep'

/**
 * 处理错误的函数
 * @param err 错误对象
 * @param vm Vue 实例
 * @param info 错误信息
 */
export function handleError(err: Error, vm: any, info: string) {
  /**
   * 暂停依赖追踪，避免在处理错误时可能导致的无限渲染
   * 参考: https://github.com/vuejs/vuex/issues/1505
   */
  pushTarget()
  try {
    if (vm) {
      /**
       * 当前 Vue 实例
       */
      let cur = vm
      while ((cur = cur.$parent)) {
        /**
         * 当前实例的 errorCaptured 钩子函数数组
         */
        const hooks = cur.$options.errorCaptured
        if (hooks) {
          for (let i = 0; i < hooks.length; i++) {
            try {
              /**
               * 是否捕获错误
               */
              const capture = hooks[i].call(cur, err, vm, info) === false
              if (capture) return
            } catch (e: any) {
              globalHandleError(e, cur, 'errorCaptured hook')
            }
          }
        }
      }
    }
    globalHandleError(err, vm, info)
  } finally {
    popTarget()
  }
}

/**
 * 安全地执行传入的函数，并捕获和处理可能发生的错误
 *
 * @param handler 要执行的函数
 * @param context 函数的执行上下文
 * @param args 函数的参数数组，可以为 null
 * @param vm Vue 实例，用于错误处理时的上下文
 * @param info 错误信息的附加描述
 * @returns 函数执行的结果
 */
export function invokeWithErrorHandling(
  handler: Function,
  context: any,
  args: null | any[],
  vm: any,
  info: string
) {
  let res
  try {
    res = args ? handler.apply(context, args) : handler.call(context)
    if (res && !res._isVue && isPromise(res) && !(res as any)._handled) {
      res.catch(e => handleError(e, vm, info + ` (Promise/async)`))
      // issue #9511
      // avoid catch triggering multiple times when nested calls
      ;(res as any)._handled = true
    }
  } catch (e: any) {
    handleError(e, vm, info)
  }
  return res
}

/**
 * 全局错误处理函数，用于捕获和处理应用中的错误。
 *
 * @param err 捕获的错误对象。
 * @param vm 发生错误的 Vue 实例（如果可用）。
 * @param info 错误的附加信息，例如生命周期钩子名称。
 *
 * 如果配置了 `config.errorHandler`，会优先调用用户自定义的错误处理器。
 * 如果自定义处理器抛出错误且与原始错误不同，则会记录该错误。
 * 最终，所有未被处理的错误都会通过 `logError` 记录。
 */
function globalHandleError(err, vm, info) {
  if (config.errorHandler) {
    try {
      return config.errorHandler.call(null, err, vm, info)
    } catch (e: any) {
      // if the user intentionally throws the original error in the handler,
      // do not log it twice
      if (e !== err) {
        logError(e, null, 'config.errorHandler')
      }
    }
  }
  logError(err, vm, info)
}

/**
 * 记录错误信息的函数。
 *
 * @param err 错误对象。
 * @param vm Vue 实例，用于标识错误发生的上下文。
 * @param info 错误信息的描述，通常是错误发生的具体位置或原因。
 */
function logError(err, vm, info) {
  if (__DEV__) {
    warn(`Error in ${info}: "${err.toString()}"`, vm)
  }
  /* istanbul ignore else */
  if (inBrowser && typeof console !== 'undefined') {
    console.error(err)
  } else {
    throw err
  }
}
