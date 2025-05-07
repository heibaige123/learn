import Watcher from 'core/observer/watcher'
import { noop } from 'shared/util'
import { currentInstance } from '../currentInstance'

// export type EffectScheduler = (...args: any[]) => any

/**
 * @internal since we are not exposing this in Vue 2, it's used only for
 * internal testing.
 */
/**
 * 创建一个 effect (副作用)。
 * 这个函数主要用于 Vue 内部测试，模拟类似 Vue 3 `effect` 的行为，基于 Vue 2 的 `Watcher` 实现。
 *
 * @internal
 * @param fn - 要执行的副作用函数。此函数内部访问的响应式数据将被追踪。
 * @param scheduler - (可选) 一个调度函数。如果提供，它将在依赖更新时被调用，用于控制 `fn` 的重新执行时机。
 *                    调度函数接收一个回调参数，调用该回调会触发 `fn` 的重新执行。
 */
export function effect(fn: () => any, scheduler?: (cb: any) => void) {
  const watcher = new Watcher(currentInstance, fn, noop, {
    // sync: true - 设置为同步模式。当依赖变化时，watcher 的 update 会被立即调用，
    // 而不是像默认的异步 watcher 那样被推入队列等待下一个 tick。
    sync: true
  })
  if (scheduler) {
    watcher.update = () => {
      scheduler(() => watcher.run())
    }
  }
}
