import { warn, extend, isPlainObject } from 'core/util/index'
import type { VNodeData } from 'types/vnode'

/**
 * 用于处理 `v-on="object"` 语法的运行时辅助函数
 * 把一个对象里的所有事件监听器，合并到 VNode 的 data.on 对象中
 * @param data VNode 的 data 对象
 * @param value v-on 绑定的对象
 * @returns
 */
export function bindObjectListeners(data: any, value: any): VNodeData {
  if (value) {
    if (!isPlainObject(value)) {
      __DEV__ && warn('v-on without argument expects an Object value', this)
    } else {
      const on = (data.on = data.on ? extend({}, data.on) : {})
      for (const key in value) {
        const existing = on[key]
        const ours = value[key]
        on[key] = existing ? [].concat(existing, ours) : ours
      }
    }
  }
  return data
}
