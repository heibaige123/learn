import type { ScopedSlotsData } from 'types/vnode'
import { isArray } from 'core/util'

/**
 * 处理作用域插槽（scoped slots）**的运行时辅助函数
 *
 * - 把编译生成的作用域插槽函数数组（`fns`），**转换成一个以插槽名为 key、渲染函数为 value 的对象**，
 * - 并加上一些特殊标记（如 `$stable`），以便后续渲染和 diff 时高效复用。
 *
 * @param fns 作用域插槽的函数数组（编译生成）
 * @param res 结果对象（递归时用）
 * @param hasDynamicKeys 是否有动态插槽名（2.6 新增）
 * @param contentHashKey 内容哈希 key（2.6 新增，用于优化）
 * @returns
 */
export function resolveScopedSlots(
  fns: ScopedSlotsData,
  res?: Record<string, any>,
  // the following are added in 2.6
  hasDynamicKeys?: boolean,
  contentHashKey?: number
): { $stable: boolean } & { [key: string]: Function } {
  // `$stable` 属性（表示插槽结构是否稳定，便于优化）
  res = res || { $stable: !hasDynamicKeys }
  for (let i = 0; i < fns.length; i++) {
    const slot = fns[i]
    if (isArray(slot)) {
      resolveScopedSlots(slot, res, hasDynamicKeys)
    } else if (slot) {
      // marker for reverse proxying v-slot without scope on this.$slots
      // @ts-expect-error
      if (slot.proxy) {
        // 如果有 `proxy` 标记，说明需要做反向代理（用于无作用域的 v-slot 语法），则把 `proxy` 标记传递到插槽函数上。
        // @ts-expect-error
        slot.fn.proxy = true
      }
      // 把 `slot.key` 作为 key，`slot.fn` 作为 value，存入结果对象。
      res[slot.key] = slot.fn
    }
  }
  if (contentHashKey) {
    // 如果传入了 `contentHashKey`，则把它挂到结果对象的 `$key` 属性上（用于优化）。
    ;(res as any).$key = contentHashKey
  }
  return res as any
}
