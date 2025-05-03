import { _Set as Set, isObject, isArray } from '../util/index'
import type { SimpleSet } from '../util/index'
import VNode from '../vdom/vnode'
import { isRef } from '../../v3'

/**
 * 一个全局 Set 集合，用于在遍历过程中记录已访问过的对象，防止循环引用导致的无限递归。这个变量在每次 `traverse` 调用后会被清空。
 */
const seenObjects = new Set()

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
/**
 * 递归遍历一个对象以触发所有已转换的 getter，这样对象内的每个嵌套属性都会被收集为"深度"依赖。
 * @param val 需要深度遍历的值，可以是数组、对象或其他任何类型的值。
 * @returns
 */
export function traverse(val: any) {
  _traverse(val, seenObjects)
  seenObjects.clear()
  return val
}

/**
 *
 * @param val 需要递归遍历的值，可以是数组、对象、ref 或其他任何类型的值。
 * @param seen 一个 Set 集合，用于记录已访问过的对象 ID，防止循环引用导致的无限递归。
 * @returns
 */
function _traverse(val: any, seen: SimpleSet) {
  let i, keys
  const isA = isArray(val)
  // 1. 跳过不需要遍历的情况
  if (
    // 原始类型值（字符串、数字等）
    (!isA && !isObject(val)) ||
    // 被标记为跳过响应式
    val.__v_skip /* ReactiveFlags.SKIP */ ||
    // 被冻结的对象
    Object.isFrozen(val) ||
    // VNode 实例
    val instanceof VNode
  ) {
    return
  }
  // 2. 处理响应式对象并防止循环引用
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      // 已经遍历过这个对象，直接返回避免循环引用
      return
    }
    // 标记这个对象已经被遍历
    seen.add(depId)
  }
  // 3. 遍历数组的每个元素
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  }
  // 4. 处理 Vue3 的 ref 对象
  else if (isRef(val)) {
    // 展开 ref，遍历它的 value
    _traverse(val.value, seen)
  }
  // 5. 遍历普通对象的所有属性
  else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
