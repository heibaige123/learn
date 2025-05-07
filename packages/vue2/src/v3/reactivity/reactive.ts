/**
### 核心概念

1. **`reactive`**
   - 将一个普通对象转换为深度响应式对象。
   - 对象的所有嵌套属性都会被递归地转换为响应式。

2. **`shallowReactive`**
   - 将一个普通对象转换为浅层响应式对象。
   - 只有对象的顶层属性是响应式的，嵌套属性不会被递归地转换为响应式。

3. **响应式标志（`ReactiveFlags`）**
   - 用于标记对象的响应式状态，例如是否是只读、是否是浅层响应式等。

4. **`observe`**
   - Vue 2 的核心方法，用于将对象转换为响应式对象。
*/

import { observe, Observer } from 'core/observer'
import {
  def,
  isPrimitive,
  warn,
  toRawType,
  isServerRendering
} from 'core/util'
import type { Ref, UnwrapRefSimple, RawSymbol } from './ref'

/**
 * 定义响应式对象的内部标志，用于标记对象的响应式状态。
 */
export const enum ReactiveFlags {
  /**
   * 标记对象应跳过响应式转换。
   */
  SKIP = '__v_skip',
  /**
   * 标记对象是否是只读的。
   */
  IS_READONLY = '__v_isReadonly',
  /**
   * 标记对象是否是浅层响应式的。
   */
  IS_SHALLOW = '__v_isShallow',
  /**
   * 存储原始对象的引用。
   */
  RAW = '__v_raw'
}

/**
 * 用于描述可以被观察（reactive）的对象的接口。
 * 它定义了一些内部标志和属性，用于标识对象的响应式状态以及与响应式系统的交互。
 */
export interface Target {
  /**
   * - `__ob__` 是 Vue 2 响应式系统中每个被观察对象的标志。
   * - 判断一个对象是否已经被观察（即是否是响应式对象）。
   * - 通过 `__ob__` 可以访问与该对象关联的响应式系统功能（如依赖收集和通知）。
   */
  __ob__?: Observer
  /**
   *  标记该对象是否应该跳过响应式转换。
   */
  [ReactiveFlags.SKIP]?: boolean
  /**
   * 标记该对象是否是只读的。
   */
  [ReactiveFlags.IS_READONLY]?: boolean
  /**
   * 标记该对象是否是浅层响应式的。
   */
  [ReactiveFlags.IS_SHALLOW]?: boolean
  /**
   * 存储该对象的原始非响应式版本。
   */
  [ReactiveFlags.RAW]?: any
}

// only unwrap nested ref
/**
 * 解包（unwrap）嵌套的 `Ref` 类型，使得开发者可以更方便地操作响应式数据。
 */
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

/**
 * 将一个普通对象转换为深度响应式对象。
 * @param target
 */
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>
export function reactive(target: object) {
  makeReactive(target, false)
  return target
}

/**
 * 用于在类型系统中标识浅层响应式对象。
 */
export declare const ShallowReactiveMarker: unique symbol

/**
 * 用于标记对象 `T` 为浅层响应式对象。
 */
export type ShallowReactive<T> = T & { [ShallowReactiveMarker]?: true }

/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
/**
 * 将一个普通对象转换为浅层响应式对象。
 * @param target
 * @returns
 */
export function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T> {
  makeReactive(target, true)
  def(target, ReactiveFlags.IS_SHALLOW, true)
  return target
}

/**
 * 用于将目标对象（`target`）转换为响应式对象。
 * 它支持创建普通响应式对象（`reactive`）和浅层响应式对象（`shallowReactive`）。
 * 该函数通过调用 Vue 2 的核心响应式方法 `observe` 来实现响应式转换。
 * @param target
 * @param shallow
 */
function makeReactive(target: any, shallow: boolean) {
  // if trying to observe a readonly proxy, return the readonly version.
  if (!isReadonly(target)) {
    if (__DEV__) {
      if (Array.isArray(target)) {
        // Vue 2 的响应式系统对数组的根级别跟踪存在限制，建议使用 `ref` 或 `shallowRef`。
        warn(
          `Avoid using Array as root value for ${
            shallow ? `shallowReactive()` : `reactive()`
          } as it cannot be tracked in watch() or watchEffect(). Use ${
            shallow ? `shallowRef()` : `ref()`
          } instead. This is a Vue-2-only limitation.`
        )
      }
      const existingOb = target && target.__ob__
      if (existingOb && existingOb.shallow !== shallow) {
        // 如果目标对象已经被观察（存在 `__ob__` 属性），
        // 并且其 `shallow` 标志与当前的 `shallow` 参数冲突，发出警告。
        warn(
          `Target is already a ${
            existingOb.shallow ? `` : `non-`
          }shallow reactive object, and cannot be converted to ${
            shallow ? `` : `non-`
          }shallow.`
        )
      }
    }
    const ob = observe(
      target,
      shallow,
      isServerRendering() /* SSR 模拟响应式 */
    )
    // 如果目标对象无法被观察，发出警告
    if (__DEV__ && !ob) {
      if (target == null || isPrimitive(target)) {
        warn(`value cannot be made reactive: ${String(target)}`)
      }
      if (isCollectionType(target)) {
        warn(
          `Vue 2 does not support reactive collection types such as Map or Set.`
        )
      }
    }
  }
}

/**
 * 判断对象是否是响应式的
 * @param value
 * @returns
 */
export function isReactive(value: unknown): boolean {
  // 如果对象是只读的，递归检查其原始对象是否是响应式的。
  if (isReadonly(value)) {
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target).__ob__)
}

/**
 * 判断对象是否是浅层响应式的
 * @param value
 * @returns
 */
export function isShallow(value: unknown): boolean {
  return !!(value && (value as Target).__v_isShallow)
}

/**
 * 判断对象是否是只读的
 * @param value
 * @returns
 */
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target).__v_isReadonly)
}

/**
 * 判断一个值是否是通过 Vue 的响应式系统创建的代理对象（`reactive` 或 `readonly`）。
 * 它是 Vue 3 中响应式系统的一部分，但在 Vue 2 的兼容性实现中也被引入。
 * @param value
 * @returns
 */
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/**
 * 获取对象的原始版本
 * @param observed
 * @returns
 */
export function toRaw<T>(observed: T): T {
  const raw = observed && (observed as Target)[ReactiveFlags.RAW]
  return raw ? toRaw(raw) : observed
}

/**
 * 标记对象为跳过响应式处理
 * @param value
 * @returns
 */
export function markRaw<T extends object>(
  value: T
): T & { [RawSymbol]?: true } {
  // non-extensible objects won't be observed anyway
  if (Object.isExtensible(value)) {
    def(value, ReactiveFlags.SKIP, true)
  }
  return value
}

/**
 * 用于判断一个值是否是集合类型（`Map`、`WeakMap`、`Set` 或 `WeakSet`）
 * 在 Vue 2 的响应式系统中，集合类型（如 `Map` 和 `Set`）并不支持响应式处理，
 * 因此需要通过该函数进行类型判断并发出警告。
 * @internal
 */
export function isCollectionType(value: unknown): boolean {
  const type = toRawType(value)
  return (
    type === 'Map' || type === 'WeakMap' || type === 'Set' || type === 'WeakSet'
  )
}
