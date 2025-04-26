/**
 * 表示当前是否处于开发模式。
 */
declare const __DEV__: boolean
/**
 * 表示当前是否处于测试模式。
 */
declare const __TEST__: boolean
/**
 * 表示当前是否是全局构建模式。
 * 通常用于区分模块化构建和全局构建（如 UMD 格式）。
 */
declare const __GLOBAL__: boolean

interface Window {
  /**
   * Vue Devtools 的全局钩子，用于与 Vue Devtools 进行通信
   */
  __VUE_DEVTOOLS_GLOBAL_HOOK__: DevtoolsHook
}

// from https://github.com/vuejs/vue-devtools/blob/bc719c95a744614f5c3693460b64dc21dfa339a8/packages/app-backend-api/src/global-hook.ts#L3
/**
 * 提供事件的发布（`emit`）和订阅（`on`、`once`、`off`）功能，
 * 用于 Vue Devtools 和 Vue 应用之间的交互。
 */
interface DevtoolsHook {
  /**
   * 用于触发一个事件。
   * @param event 事件名称。
   * @param payload 事件的附加数据。
   * @returns
   */
  emit: (event: string, ...payload: any[]) => void

  /**
   * 用于监听一个事件。
   * @param event 事件名称。
   * @param handler 事件触发时的回调函数。
   * @returns
   */
  on: (event: string, handler: Function) => void

  /**
   * 用于监听一个事件，但只触发一次。
   * @param event 事件名称。
   * @param handler 事件触发时的回调函数。
   * @returns
   */
  once: (event: string, handler: Function) => void

  /**
   * 用于取消事件监听。
   * @param event 事件名称。如果未提供，则移除所有事件监听器。
   * @param handler 要移除的特定事件处理程序。如果未提供，则移除该事件的所有监听器。
   * @returns
   */
  off: (event?: string, handler?: Function) => void

  /**
   * 用于存储 Vue 的全局实例或相关信息
   */
  Vue?: any
  // apps: AppRecordOptions[]
}
