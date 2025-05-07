import { def, warn, isPlainObject } from 'core/util'
import {
  isCollectionType,
  isReadonly,
  isShallow,
  ReactiveFlags,
  UnwrapNestedRefs
} from './reactive'
import { isRef, Ref, RefFlag } from './ref'

/** 基础类型 (Primitive)，包括所有原始类型 */
type Primitive = string | number | boolean | bigint | symbol | undefined | null

/** 内置类型 (Builtin)，包括基础类型和一些常见的内置对象类型 */
type Builtin = Primitive | Function | Date | Error | RegExp

/** 定义 DeepReadonly 类型工具 */
export type DeepReadonly<T> =
  // 如果 T 是内置类型，则直接返回 T，因为内置类型是不可变的
  T extends Builtin
    ? T
    : // 如果 T 是 Map 类型，则递归地将键和值都标记为只读
    T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : // 如果 T 是 ReadonlyMap 类型，则递归地将键和值都标记为只读
    T extends ReadonlyMap<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : // 如果 T 是 WeakMap 类型，则递归地将键和值都标记为只读
    T extends WeakMap<infer K, infer V>
    ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
    : // 如果 T 是 Set 类型，则递归地将元素标记为只读
    T extends Set<infer U>
    ? ReadonlySet<DeepReadonly<U>>
    : // 如果 T 是 ReadonlySet 类型，则递归地将元素标记为只读
    T extends ReadonlySet<infer U>
    ? ReadonlySet<DeepReadonly<U>>
    : // 如果 T 是 WeakSet 类型，则递归地将元素标记为只读
    T extends WeakSet<infer U>
    ? WeakSet<DeepReadonly<U>>
    : // 如果 T 是 Promise 类型，则递归地将其解析值标记为只读
    T extends Promise<infer U>
    ? Promise<DeepReadonly<U>>
    : // 如果 T 是 Ref 类型 (Vue 的响应式引用)，则递归地将其值标记为只读
    T extends Ref<infer U>
    ? Readonly<Ref<DeepReadonly<U>>>
    : // 如果 T 是普通对象，则递归地将其所有属性标记为只读
    T extends {}
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : // 如果 T 是其他类型，则直接将其标记为只读
      Readonly<T>

/**
 * 创建一个对象的深层只读（deep readonly）代理。
 * 该代理会递归地将目标对象及其所有嵌套属性都变为只读，禁止任何修改操作。
 *
 * @param target 需要被转换为只读的原始对象（只能是对象类型，不能是原始类型）。
 * @returns 返回目标对象的深层只读代理，类型为 DeepReadonly<UnwrapNestedRefs<T>>。
 *          - DeepReadonly：递归地将所有属性变为只读。
 *          - UnwrapNestedRefs：会自动解包对象内部的 Ref 类型（如果有）。
 */
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReadonly(target, false)
}

/**
 * 创建一个对象的只读（readonly）代理。
 * 可选择浅只读（只根属性只读）或深只读（递归所有属性只读）。
 *
 * @param target  需要被代理的原始对象
 * @param shallow 是否为浅只读（true：只根属性只读，false：递归所有属性只读）
 * @returns       返回只读代理对象。如果目标不是普通对象，则直接返回原值。
 */
function createReadonly(target: any, shallow: boolean) {
  if (!isPlainObject(target)) {
    if (__DEV__) {
      if (Array.isArray(target)) {
        warn(`Vue 2 does not support readonly arrays.`)
      } else if (isCollectionType(target)) {
        warn(
          `Vue 2 does not support readonly collection types such as Map or Set.`
        )
      } else {
        warn(`value cannot be made readonly: ${typeof target}`)
      }
    }
    return target as any
  }

  if (__DEV__ && !Object.isExtensible(target)) {
    warn(
      `Vue 2 does not support creating readonly proxy for non-extensible object.`
    )
  }

  // already a readonly object
  if (isReadonly(target)) {
    return target as any
  }

  // already has a readonly proxy
  // 如果对象已经有只读代理，直接返回缓存的代理
  const existingFlag = shallow
    ? `__v_rawToShallowReadonly`
    : `__v_rawToReadonly`
  const existingProxy = target[existingFlag]
  if (existingProxy) {
    return existingProxy
  }

  const proxy = Object.create(Object.getPrototypeOf(target))
  // 在原对象上缓存只读代理，避免重复创建
  def(target, existingFlag, proxy)

  // 在代理对象上设置只读相关的内部标记
  def(proxy, ReactiveFlags.IS_READONLY, true) // 标记为只读
  def(proxy, ReactiveFlags.RAW, target) // 记录原始对象

  // 如果目标是 ref，则在代理上也标记为 ref
  if (isRef(target)) {
    def(proxy, RefFlag, true)
  }
  // 如果是浅只读或目标本身已是浅代理，则标记为浅只读
  if (shallow || isShallow(target)) {
    def(proxy, ReactiveFlags.IS_SHALLOW, true)
  }

  // 遍历目标对象的所有自有属性，为每个属性定义只读访问器
  const keys = Object.keys(target)

  keys.forEach(key => {
    defineReadonlyProperty(proxy, target, key, shallow)
  })

  return proxy as any
}

/**
 * 在代理对象 proxy 上定义一个只读属性 key。
 * 该属性的值来源于原始对象 target 的同名属性，并根据 shallow 参数决定是否递归只读。
 *
 * @param proxy   代理对象，在其上定义只读属性
 * @param target  原始对象，属性值的实际来源
 * @param key     属性名（字符串）
 * @param shallow 是否为浅只读（true：只读一层，false：递归深只读）
 */
function defineReadonlyProperty(
  proxy: any,
  target: any,
  key: string,
  shallow: boolean
) {
  Object.defineProperty(proxy, key, {
    enumerable: true,
    configurable: true,
    get() {
      const val = target[key]
      // 如果是浅只读，或属性值不是普通对象，则直接返回原始值
      // 否则递归调用 readonly 使其变为深只读
      return shallow || !isPlainObject(val) ? val : readonly(val)
    },
    set() {
      __DEV__ &&
        warn(`Set operation on key "${key}" failed: target is readonly.`)
    }
  })
}

/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
/**
 * 返回一个原始对象的浅只读（shallow readonly）代理副本。
 * 该代理对象只有**根属性**是只读的，嵌套的对象属性仍然是可变的。
 * 此函数不会解包 ref，也不会递归地将属性转换为只读。
 * 主要用于为有状态组件创建 props 代理对象。
 *
 * @param target 需要被转换为浅只读的原始对象（只能是对象类型，不能是原始类型）。
 * @returns 返回目标对象的浅只读代理，类型为 Readonly<T>（只对第一层属性加 readonly）。
 */
export function shallowReadonly<T extends object>(target: T): Readonly<T> {
  return createReadonly(target, true)
}
