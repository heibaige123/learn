import { isServerRendering, noop, warn, def, isFunction } from 'core/util'
import { Ref, RefFlag } from './ref'
import Watcher from 'core/observer/watcher'
import Dep from 'core/observer/dep'
import { currentInstance } from '../currentInstance'
import { ReactiveFlags } from './reactive'
import { TrackOpTypes } from './operations'
import { DebuggerOptions } from '../debug'

/** 声明一个唯一的 symbol，用于标识 ComputedRef 类型 */
declare const ComputedRefSymbol: unique symbol

/**
 * 只读计算属性的接口定义
 * @template T 计算属性的值类型
 * 继承自 WritableComputedRef，包含只读 value 属性和唯一标识符
 */
export interface ComputedRef<T = any> extends WritableComputedRef<T> {
  // 只读的计算属性值
  readonly value: T
  // 用于类型判断的唯一 symbol 标记
  [ComputedRefSymbol]: true
}

/**
 * 可写计算属性的接口定义
 * @template T 计算属性的值类型
 * 继承自 Ref<T>，并包含 effect 属性（通常是 Watcher 实例）
 */
export interface WritableComputedRef<T> extends Ref<T> {
  // effect 属性，内部用于依赖追踪和响应式更新
  readonly effect: any /* Watcher */
}

/**
 * 计算属性 getter 的类型定义
 * 返回类型为 T，可以接收任意参数（通常不需要参数）
 */
export type ComputedGetter<T> = (...args: any[]) => T

/**
 * 计算属性 setter 的类型定义
 * 接收一个类型为 T 的参数，无返回值
 */
export type ComputedSetter<T> = (v: T) => void

/**
 * 可写计算属性的选项对象类型
 * 包含 get 和 set 两个函数
 */
export interface WritableComputedOptions<T> {
  // 获取计算属性值的函数
  get: ComputedGetter<T>
  // 设置计算属性值的函数
  set: ComputedSetter<T>
}

/**
 * 创建一个计算属性（computed ref）。
 * 支持只读和可写两种形式。
 *
 * @overload
 * @param getter 只读计算属性的 getter 函数
 * @param debugOptions 可选的调试选项
 * @returns ComputedRef<T> 只读计算属性
 *
 * @overload
 * @param options 包含 get/set 的可写计算属性选项对象
 * @param debugOptions 可选的调试选项
 * @returns WritableComputedRef<T> 可写计算属性
 */
export function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions
): ComputedRef<T>
export function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T>
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>

  // 判断是只读 getter 还是 get/set 对象
  const onlyGetter = isFunction(getterOrOptions)
  if (onlyGetter) {
    // 只读 computed，setter 是空操作（开发环境下会警告）
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
          warn('Write operation failed: computed value is readonly')
        }
      : noop
  } else {
    // 可写 computed，分别取出 get 和 set
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  // 创建 Watcher 实例，lazy: true 表示惰性求值
  // SSR 环境下 watcher 为 null
  const watcher = isServerRendering()
    ? null
    : new Watcher(currentInstance, getter, noop, { lazy: true })

  if (__DEV__ && watcher && debugOptions) {
    watcher.onTrack = debugOptions.onTrack
    watcher.onTrigger = debugOptions.onTrigger
  }

  // 构造 ref 对象，包含 effect、value 的 getter/setter
  const ref = {
    // some libs rely on the presence effect for checking computed refs
    // from normal refs, but the implementation doesn't matter
    // effect 属性用于区分 computed ref
    effect: watcher,
    get value() {
      if (watcher) {
        // 如果 watcher 脏了，先求值
        if (watcher.dirty) {
          watcher.evaluate()
        }
        // 依赖收集
        if (Dep.target) {
          if (__DEV__ && Dep.target.onTrack) {
            Dep.target.onTrack({
              effect: Dep.target,
              target: ref,
              type: TrackOpTypes.GET,
              key: 'value'
            })
          }
          watcher.depend()
        }
        return watcher.value
      } else {
        // SSR 环境直接调用 getter
        return getter()
      }
    },
    set value(newVal) {
      // 只读 computed 的 setter 会警告，可写 computed 正常调用 set
      setter(newVal)
    }
  } as any

  // 标记为 ref
  def(ref, RefFlag, true)
  // 标记是否只读
  def(ref, ReactiveFlags.IS_READONLY, onlyGetter)

  return ref
}
