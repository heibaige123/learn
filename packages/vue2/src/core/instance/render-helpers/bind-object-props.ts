import config from 'core/config'

import {
  warn,
  isObject,
  toObject,
  isReservedAttribute,
  camelize,
  hyphenate,
  isArray
} from 'core/util/index'
import type { VNodeData } from 'types/vnode'

/**
 * Runtime helper for merging v-bind="object" into a VNode's data.
 */
/**
 * 把一个对象（或数组）里的所有属性，合并到 VNode 的 data 对象中，从而让这些属性最终能正确地绑定到真实 DOM 元素上。
 * @param data VNode 的 data 对象（最终会被渲染到 DOM 或组件上）
 * @param tag 当前标签名（如 'div'、'input'、'my-comp'）
 * @param value v-bind 绑定的对象或数组
 * @param asProp 是否作为 DOM property 绑定（如 input.value），否则作为 attribute
 * @param isSync 是否开启 .sync 修饰符（如 v-bind.sync）
 * @returns
 */
export function bindObjectProps(
  data: any,
  tag: string,
  value: any,
  asProp: boolean,
  isSync?: boolean
): VNodeData {
  if (value) {
    if (!isObject(value)) {
      __DEV__ &&
        warn('v-bind without argument expects an Object or Array value', this)
    } else {
      if (isArray(value)) {
        value = toObject(value)
      }
      let hash
      for (const key in value) {
        if (key === 'class' || key === 'style' || isReservedAttribute(key)) {
          hash = data
        } else {
          const type = data.attrs && data.attrs.type
          hash =
            asProp || config.mustUseProp(tag, type, key)
              ? data.domProps || (data.domProps = {})
              : data.attrs || (data.attrs = {})
        }
        const camelizedKey = camelize(key)
        const hyphenatedKey = hyphenate(key)
        // 避免重复赋值
        if (!(camelizedKey in hash) && !(hyphenatedKey in hash)) {
          hash[key] = value[key]

          if (isSync) {
            // 如果 `isSync` 为 true，会在 `data.on` 上添加 `update:key` 事件监听器，实现 `.sync` 的双向绑定。
            const on = data.on || (data.on = {})
            on[`update:${key}`] = function ($event) {
              value[key] = $event
            }
          }
        }
      }
    }
  }
  return data
}
