import { DebuggerEvent } from './debug'
import { Component } from 'types/component'
import { mergeLifecycleHook, warn } from '../core/util'
import { currentInstance } from './currentInstance'

/**
 * 创建一个生命周期钩子的注册函数（如 onMounted、onUpdated 等）。
 * 这些注册函数会将传入的回调函数（fn）注入到当前组件实例的生命周期中。
 *
 * @param hookName 生命周期钩子的名称（如 'mounted', 'beforeUpdate' 等）
 * @returns 返回一个注册函数，接收回调和目标组件实例（默认当前实例），用于注册生命周期钩子
 */
function createLifeCycle<T extends (...args: any[]) => any = () => void>(
  hookName: string
) {
  return (fn: T, target: any = currentInstance) => {
    // 如果没有当前激活的组件实例，开发环境下给出警告
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
    // 将回调函数注入到目标组件实例的指定生命周期钩子中
    return injectHook(target, hookName, fn)
  }
}

/**
 * 格式化生命周期钩子的名称，用于生成与 Vue 3 一致的 API 名称。
 * @param name 生命周期钩子的原始名称（如 'beforeDestroy'）
 * @returns 格式化后的名称（如 'onBeforeUnmount'）
 */
function formatName(name: string) {
  if (name === 'beforeDestroy') {
    // Vue 2 的 beforeDestroy 对应 Vue 3 的 beforeUnmount
    name = 'beforeUnmount'
  } else if (name === 'destroyed') {
    // Vue 2 的 destroyed 对应 Vue 3 的 unmounted
    name = 'unmounted'
  }
  // 首字母大写并加上 'on' 前缀
  return `on${name[0].toUpperCase() + name.slice(1)}`
}

/**
 * 将回调函数注入到指定的生命周期钩子中。
 * @param instance 组件实例
 * @param hookName 生命周期钩子的名称
 * @param fn       要注入的回调函数
 */
function injectHook(instance: Component, hookName: string, fn: () => void) {
  const options = instance.$options
  // 合并生命周期钩子，保证多个回调都能被执行
  options[hookName] = mergeLifecycleHook(options[hookName], fn)
}

// 定义一系列生命周期钩子的注册函数，供组合式 API 使用
export const onBeforeMount = createLifeCycle('beforeMount')
export const onMounted = createLifeCycle('mounted')
export const onBeforeUpdate = createLifeCycle('beforeUpdate')
export const onUpdated = createLifeCycle('updated')
export const onBeforeUnmount = createLifeCycle('beforeDestroy')
export const onUnmounted = createLifeCycle('destroyed')
export const onActivated = createLifeCycle('activated')
export const onDeactivated = createLifeCycle('deactivated')
export const onServerPrefetch = createLifeCycle('serverPrefetch')

// 定义渲染跟踪和触发的钩子，用于调试响应式系统
/**
 * 在依赖被跟踪时触发（调试用）
 */
export const onRenderTracked =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTracked')
/**
 * 在依赖被触发更新时触发（调试用）
 */
export const onRenderTriggered =
  createLifeCycle<(e: DebuggerEvent) => any>('renderTriggered')
/**
 * 定义组件的 errorCaptured 钩子类型。
 * 当子组件抛出错误时会触发该钩子。
 *
 * @template TError 捕获到的错误类型，默认为 unknown
 * @param err      捕获到的错误对象
 * @param instance 发生错误的组件实例
 * @param info     错误信息字符串，描述错误来源
 * @returns        返回 true/void。如果返回 false，错误会停止向上传播；否则会继续冒泡到父组件
 */
export type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: any,
  info: string
) => boolean | void

/**
 * 注入 errorCaptured 生命周期钩子的工具函数。
 * 通过 createLifeCycle 工厂函数生成，参数为生命周期名称 'errorCaptured'。
 * 用于在组件内注册 errorCaptured 钩子。
 */
const injectErrorCapturedHook =
  createLifeCycle<ErrorCapturedHook<any>>('errorCaptured')

/**
 * 用于在组件中注册 errorCaptured 钩子函数，实现对子组件错误的捕获和处理。
 *
 * @template TError 捕获到的错误类型，默认为 Error
 * @param hook   用户自定义的错误捕获回调函数（ErrorCapturedHook）
 *               - 参数1：err 捕获到的错误对象
 *               - 参数2：instance 发生错误的组件实例
 *               - 参数3：info 错误信息字符串
 *               - 返回值：boolean | void，返回 false 可阻止错误继续冒泡
 * @param target 指定注册钩子的组件实例，默认是当前激活的组件实例（currentInstance）
 */
export function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target: any = currentInstance
) {
  // 调用内部工具函数，将 errorCaptured 钩子注入到目标组件实例
  injectErrorCapturedHook(hook, target)
}
