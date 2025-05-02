import VNode from '../vnode'
import { createFnInvoker } from './update-listeners'
import { remove, isDef, isUndef, isTrue } from 'shared/util'

/**
 * - Vue 内部用于**合并 VNode 钩子函数（如 insert、destroy、update 等）**的工具函数
 * - 确保多个钩子函数可以安全地合并到同一个 VNode 的同一个生命周期钩子上，并且不会重复执行或内存泄漏。
 * @param def VNode.data.hook 或 VNode 实例
 * @param hookKey 钩子名，如 'insert'、'destroy'
 * @param hook 要合并的新钩子函数
 */
export function mergeVNodeHook(
  def: Record<string, any>,
  hookKey: string,
  hook: Function
) {
  if (def instanceof VNode) {
    def = def.data!.hook || (def.data!.hook = {})
  }
  let invoker
  const oldHook = def[hookKey]

  /**
   * - 调用传入的 `hook`。
   * - 调用后会自动从 invoker 的 fns 数组中移除自己，**保证只执行一次，防止内存泄漏**
   */
  function wrappedHook() {
    hook.apply(this, arguments)
    // important: remove merged hook to ensure it's called only once
    // and prevent memory leak
    remove(invoker.fns, wrappedHook)
  }

  if (isUndef(oldHook)) {
    // no existing hook
    invoker = createFnInvoker([wrappedHook])
  } else {
    /* istanbul ignore if */
    if (isDef(oldHook.fns) && isTrue(oldHook.merged)) {
      // already a merged invoker
      invoker = oldHook
      invoker.fns.push(wrappedHook)
    } else {
      // existing plain hook
      invoker = createFnInvoker([oldHook, wrappedHook])
    }
  }

  invoker.merged = true
  def[hookKey] = invoker
}
