import { defineReactive } from 'core/observer/index'
import {
  isReactive,
  ReactiveFlags,
  type ShallowReactiveMarker
} from './reactive'
import type { IfAny } from 'types/utils'
import Dep from 'core/observer/dep'
import { warn, def, isServerRendering } from 'core/util'
import { TrackOpTypes, TriggerOpTypes } from './operations'

/**
 * 用于区分 `Ref` 对象和普通对象。
 */
declare const RefSymbol: unique symbol
/**
 * - 用于标记原始（非响应式）对象。
 * - 通常与 `markRaw` 函数配合使用，用于标记对象跳过响应式处理。
 */
export declare const RawSymbol: unique symbol

/**
 * @internal
 */
export const RefFlag = `__v_isRef`

/**
 * 用于包装一个值，使其成为响应式数据。
 */
export interface Ref<T = any> {
  /**
   * - 包含被包装的值。
   * - 通过 `.value` 访问或修改响应式数据。
   */
  value: T
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  /**
   * 用于类型区分，标记该对象是一个 `Ref`。
   */
  [RefSymbol]: true
  /**
   * @internal
   */
  /**
   * 内部依赖管理器，用于追踪和通知依赖。
   */
  dep?: Dep
  /**
   * @internal
   */
  /**
   * 标志该对象是一个 `Ref`。
   */
  [RefFlag]: true
}

/**
 * 判断一个值是否是 `Ref` 对象。
 * @param r
 */
export function isRef<T>(r: Ref<T> | unknown): r is Ref<T>
export function isRef(r: any): r is Ref {
  return !!((r as Ref)?.__v_isRef === true)
}

/**
 * 创建一个响应式的 `Ref` 对象。
 * @param value
 */
export function ref<T extends Ref>(value: T): T
export function ref<T>(value: T): Ref<UnwrapRef<T>>
export function ref<T = any>(): Ref<T | undefined>
export function ref(value?: unknown) {
  return createRef(value, false)
}

/**
 * 类型系统中的标志，用于区分浅层响应式的 `Ref` 和普通的 `Ref`。
 */
declare const ShallowRefMarker: unique symbol

/**
 * 继承了 `Ref` 的所有特性，并通过 `ShallowRefMarker` 标记为浅层响应式。
 */
export type ShallowRef<T = any> = Ref<T> & {
  [ShallowRefMarker]?: true
}

/**
 * 创建一个浅层响应式的 `Ref` 对象。
 * @param value
 */
export function shallowRef<T>(value: T | Ref<T>): Ref<T> | ShallowRef<T>
export function shallowRef<T extends Ref>(value: T): T
export function shallowRef<T>(value: T): ShallowRef<T>
export function shallowRef<T = any>(): ShallowRef<T | undefined>
export function shallowRef(value?: unknown) {
  return createRef(value, true)
}

/**
 * 创建一个 `Ref` 对象，并将其值设置为响应式。
 * @param rawValue
 * @param shallow
 * @returns
 */
function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    // 如果 `rawValue` 已经是一个 `Ref`，直接返回。
    return rawValue
  }
  const ref: any = {}
  // 标记该对象是一个 `Ref`。
  def(ref, RefFlag, true)
  // 如果是浅层 `Ref`，添加 `ReactiveFlags.IS_SHALLOW` 标志
  def(ref, ReactiveFlags.IS_SHALLOW, shallow)
  // 调用 `defineReactive` 将 `ref.value` 设置为响应式。
  def(
    ref,
    'dep',
    defineReactive(ref, 'value', rawValue, null, shallow, isServerRendering())
  )
  return ref
}

/**
 * 手动触发对 `Ref` 的依赖更新。
 * @param ref
 */
export function triggerRef(ref: Ref) {
  if (__DEV__ && !ref.dep) {
    warn(`received object is not a triggerable ref.`)
  }
  if (__DEV__) {
    ref.dep?.notify({
      type: TriggerOpTypes.SET,
      target: ref,
      key: 'value'
    })
  } else {
    ref.dep?.notify()
  }
}

/**
 * 简化对 `Ref` 和普通值的处理逻辑。
 * @param ref
 * @returns
 */
export function unref<T>(ref: T | Ref<T>): T {
  return isRef(ref) ? (ref.value as any) : ref
}

/**
 * 简化对包含 `Ref` 的对象的操作。
 * 它通过代理（`Proxy` 或 `Object.defineProperty`）的方式，
 * 将对象中的 `Ref` 自动解包（unwrap），
 * 使得开发者可以像操作普通属性一样操作 `Ref`，而无需显式地访问 `.value`。
 * @param objectWithRefs
 * @returns
 */
export function proxyRefs<T extends object>(
  objectWithRefs: T
): ShallowUnwrapRef<T> {
  if (isReactive(objectWithRefs)) {
    return objectWithRefs as any
  }
  const proxy = {}
  const keys = Object.keys(objectWithRefs)

  keys.forEach(key => {
    proxyWithRefUnwrap(proxy, objectWithRefs, key)
  })

  return proxy as any
}

/**
 * 为目标对象（`target`）的某个属性设置代理。
 * @param target
 * @param source
 * @param key
 */
export function proxyWithRefUnwrap(
  target: any,
  source: Record<string, any>,
  key: string
) {
  Object.defineProperty(target, key, {
    enumerable: true,
    configurable: true,
    get: () => {
      const val = source[key]
      if (isRef(val)) {
        return val.value
      } else {
        const ob = val?.__ob__
        if (ob) {
          ob.dep.depend()
        }
        return val
      }
    },
    set: value => {
      const oldValue = source[key]
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
      } else {
        source[key] = value
      }
    }
  })
}

/**
 * 用于创建自定义的 `Ref` 对象。
 * 通过 `customRef` 函数，
 * 开发者可以完全控制 `Ref` 的依赖追踪（`track`）和触发更新（`trigger`）的行为，从而实现更灵活的响应式逻辑。
 */
export type CustomRefFactory<T> = (
  /**
   * - 用于手动触发依赖追踪。
   * - 通常在 `get` 方法中调用，通知 Vue 的响应式系统当前 `Ref` 被访问。
   */
  track: () => void,
  /**
   * - 用于手动触发依赖更新。
   * - 通常在 `set` 方法中调用，通知 Vue 的响应式系统当前 `Ref` 的值发生了变化。
   */
  trigger: () => void
) => {
  get: () => T
  set: (value: T) => void
}

/**
 * - 创建一个自定义的 `Ref` 对象。
 * - 允许开发者完全控制依赖追踪和触发更新的逻辑。
 * @param factory
 * @returns
 */
export function customRef<T>(factory: CustomRefFactory<T>): Ref<T> {
  const dep = new Dep()
  const { get, set } = factory(
    () => {
      if (__DEV__) {
        dep.depend({
          target: ref,
          type: TrackOpTypes.GET,
          key: 'value'
        })
      } else {
        dep.depend()
      }
    },
    () => {
      if (__DEV__) {
        dep.notify({
          target: ref,
          type: TriggerOpTypes.SET,
          key: 'value'
        })
      } else {
        dep.notify()
      }
    }
  )
  const ref = {
    get value() {
      return get()
    },
    set value(newVal) {
      set(newVal)
    }
  } as any
  def(ref, RefFlag, true)
  return ref
}

export type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}

/**
 * 将对象的所有属性转换为 `Ref`。
 * @param object
 * @returns
 */
export function toRefs<T extends object>(object: T): ToRefs<T> {
  if (__DEV__ && !isReactive(object)) {
    warn(`toRefs() expects a reactive object but received a plain one.`)
  }
  const ret: any = Array.isArray(object) ? new Array(object.length) : {}

  for (const key in object) {
    ret[key] = toRef(object, key)
  }
  return ret
}

export type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>

/**
 * 将对象的某个属性转换为 `Ref`。
 * @param object
 * @param key
 */
export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]>

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue?: T[K]
): ToRef<T[K]> {
  const val = object[key]
  if (isRef(val)) {
    return val as any
  }
  const ref = {
    get value() {
      const val = object[key]
      return val === undefined ? (defaultValue as T[K]) : val
    },
    set value(newVal) {
      object[key] = newVal
    }
  } as any
  def(ref, RefFlag, true)
  return ref
}

/**
 * 一个特殊的接口，用于声明在解包 `Ref` 类型时应该跳过的类型。
 * 允许其他模块（如 `@vue/runtime-dom`）扩展此接口，声明特定类型在解包 `Ref` 时不应该被处理。
 *
 * This is a special exported interface for other packages to declare
 * additional types that should bail out for ref unwrapping. For example
 * \@vue/runtime-dom can declare it like so in its d.ts:
 *
 * ``` ts
 * declare module 'vue' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 *
 * Note that api-extractor somehow refuses to include `declare module`
 * augmentations in its generated d.ts, so we have to manually append them
 * to the final generated d.ts in our build process.
 */
export interface RefUnwrapBailTypes {
  runtimeDOMBailTypes: Node | Window
}

/**
 * - 用于浅层解包 `Ref` 类型的工具类型。
 * - 如果对象的某个属性是 `Ref`，则解包为其内部值；否则保持原样。
 */
export type ShallowUnwrapRef<T> = {
  [K in keyof T]: T[K] extends Ref<infer V>
    ? V
    : // if `V` is `unknown` that means it does not extend `Ref` and is undefined
    T[K] extends Ref<infer V> | undefined
    ? unknown extends V
      ? undefined
      : V | undefined
    : T[K]
}

/**
 * - 用于递归解包 `Ref` 类型的工具类型。
 * - 与 `ShallowUnwrapRef` 不同，`UnwrapRef` 会递归解包嵌套的 `Ref`。
 */
export type UnwrapRef<T> = T extends ShallowRef<infer V>
  ? V
  : T extends Ref<infer V>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>

/**
 * 基本类型的集合。
 */
type BaseTypes = string | number | boolean
/**
 * 集合类型的集合。
 */
type CollectionTypes = IterableCollections | WeakCollections
/**
 * 可迭代的集合类型。
 */
type IterableCollections = Map<any, any> | Set<any>
/**
 * 弱引用的集合类型。
 */
type WeakCollections = WeakMap<any, any> | WeakSet<any>

/**
 * 用于递归解包非 `Ref` 类型的嵌套结构。
 */
export type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  | { [RawSymbol]?: true }
  ? T
  : T extends Array<any>
  ? { [K in keyof T]: UnwrapRefSimple<T[K]> }
  : T extends object & { [ShallowReactiveMarker]?: never }
  ? {
      [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
    }
  : T
