import { DebuggerEvent } from './debug'
import { Component } from 'types/component'
import { mergeLifecycleHook, warn } from '../core/util'
import { currentInstance } from './currentInstance'

/**
 * - 创建一个生命周期钩子的注册函数（如 `onMounted`、`onUpdated` 等）。
 * - 这些注册函数会将传入的回调函数（`fn`）注入到当前组件实例的生命周期中。
 * @param hookName
 * @returns
 */
function createLifeCycle<T extends (...args: any[]) => any = () => void>(
  hookName: string
) {
  return (fn: T, target: any = currentInstance) => {
    if (!target) {
      __DEV__ &&
        warn(
          `${formatName(
            hookName
          )} is called when there is no active component instance to be ` +
            `associated with. ` +
            `Lifecycle injection APIs can only be used during execution of setup().`
        )
      return
    }
    return injectHook(target, hookName, fn)
  }
}

/**
 * 格式化生命周期钩子的名称，用于生成与 Vue 3 一致的 API 名称。
 * @param name
 * @returns
 */
function formatName(name: string) {
  if (name === 'beforeDestroy') {
    // 将 Vue 2 的 `beforeDestroy` 转换为 Vue 3 的 `beforeUnmount`。
    name = 'beforeUnmount'
  } else if (name === 'destroyed') {
    // 将 Vue 2 的 `destroyed` 转换为 Vue 3 的 `unmounted`。
    name = 'unmounted'
  }
  return `on${name[0].toUpperCase() + name.slice(1)}`
}

/**
 * 将回调函数注入到指定的生命周期钩子中。
 * @param instance
 * @param hookName
 * @param fn
 */
function injectHook(instance: Component, hookName: string, fn: () => void) {
  const options = instance.$options
  options[hookName] = mergeLifecycleHook(options[hookName], fn)
}

// 定义一系列生命周期钩子的注册函数。
export const onBeforeMount = createLifeCycle('beforeMount')
export const onMounted = createLifeCycle('mounted')
export const onBeforeUpdate = createLifeCycle('beforeUpdate')
export const onUpdated = createLifeCycle('updated')
export const onBeforeUnmount = createLifeCycle('beforeDestroy')
export const onUnmounted = createLifeCycle('destroyed')
export const onActivated = createLifeCycle('activated')
export const onDeactivated = createLifeCycle('deactivated')
export const onServerPrefetch = createLifeCycle('serverPrefetch')

// 定义渲染跟踪和触发的钩子，用于调试响应式系统。
/**
 * 在依赖被跟踪时触发。
 */
export const onRenderTracked =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTracked')
/**
 * 在依赖被触发更新时触发。
 */
export const onRenderTriggered =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTriggered')

export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: any,
  info: string
) => boolean | void

const injectErrorCapturedHook =
  createLifeCycle<ErrorCapturedHook<any>>('errorCaptured')

/**
 * 用于捕获组件中的错误。
 */
export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: any = currentInstance
) {
  injectErrorCapturedHook(hook, target)
}
