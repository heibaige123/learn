import { isRef, Ref } from './reactivity/ref'
import { ComputedRef } from './reactivity/computed'
import { isReactive, isShallow } from './reactivity/reactive'
import {
  warn,
  noop,
  isFunction,
  emptyObject,
  hasChanged,
  isServerRendering,
  invokeWithErrorHandling
} from 'core/util'
import { currentInstance } from './currentInstance'
import { traverse } from 'core/observer/traverse'
import Watcher from '../core/observer/watcher'
import { queueWatcher } from '../core/observer/scheduler'
import { DebuggerOptions } from './debug'

// 定义常量字符串，用于标识 watcher 的不同阶段
const WATCHER = `watcher`
const WATCHER_CB = `${WATCHER} callback`
const WATCHER_GETTER = `${WATCHER} getter`
const WATCHER_CLEANUP = `${WATCHER} cleanup`

/**
 * watchEffect 的回调类型，参数为 onCleanup 注册清理函数
 */
export type WatchEffect = (onCleanup: OnCleanup) => void

/**
 * watch 的数据源类型，可以是 Ref、ComputedRef 或 getter 函数
 */
export type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

/**
 * watch 的回调类型，value 为新值，oldValue 为旧值，onCleanup 用于注册清理函数
 */
export type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any

/**
 * 用于映射多数据源的类型，Immediate 控制初始值是否允许 undefined
 */
type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
    ? Immediate extends true
      ? T[K] | undefined
      : T[K]
    : never
}

/**
 * onCleanup 的类型定义，参数为清理函数
 */
type OnCleanup = (cleanupFn: () => void) => void

/**
 * watch 选项的基础类型，支持 flush、调试等
 */
export interface WatchOptionsBase extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

/**
 * watch 选项类型，支持 immediate、deep 等
 */
export interface WatchOptions<Immediate = boolean> extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
}

/**
 * 停止 watch 的函数类型
 */
export type WatchStopHandle = () => void

/**
 * watchEffect：简单副作用监听，无需指定数据源。
 * 当依赖的响应式数据发生变化时，effect 会自动重新执行。
 *
 * @param effect  副作用函数，参数为 onCleanup，用于注册清理逻辑
 * @param options 监听选项（可选），如 flush 时机等
 * @returns       返回一个停止监听的函数（WatchStopHandle）
 */
export function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle {
  // 调用底层 doWatch 实现，第二个参数为 null，表示无回调，仅副作用
  return doWatch(effect, null, options)
}

/**
 * watchPostEffect：副作用在组件更新后（DOM 更新后）执行。
 * 适用于需要在 DOM 更新后访问页面的场景。
 *
 * @param effect  副作用函数，参数为 onCleanup，用于注册清理逻辑
 * @param options 调试选项（可选）
 * @returns       返回一个停止监听的函数（WatchStopHandle）
 */
export function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
) {
  // 调用 doWatch，强制 flush 选项为 'post'，即副作用在组件更新后执行
  return doWatch(
    effect,
    null,
    (__DEV__
      ? { ...options, flush: 'post' }
      : { flush: 'post' }) as WatchOptionsBase
  )
}

/**
 * watchSyncEffect：副作用同步执行。
 * 当依赖的响应式数据发生变化时，effect 会立即（同步）执行，而不是等到下一个事件循环或组件更新后。
 *
 * @param effect   副作用函数，参数为 onCleanup，用于注册清理逻辑
 * @param options  调试选项（可选）
 * @returns        返回一个停止监听的函数（WatchStopHandle）
 */
export function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
) {
  // 调用 doWatch，强制 flush 选项为 'sync'，即副作用同步执行
  return doWatch(
    effect,
    null,
    (__DEV__
      ? { ...options, flush: 'sync' }
      : { flush: 'sync' }) as WatchOptionsBase
  )
}

/**
 * 用于触发 watch 的初始值。
 * 该常量用于标记 watcher 的初始状态，避免与实际数据冲突。
 */
const INITIAL_WATCHER_VALUE = {}

/**
 * 多数据源类型。
 * 用于 watch 支持传入多个数据源（ref、getter、响应式对象等）的场景。
 */
type MultiWatchSources = (WatchSource<unknown> | object)[]

// watch 的多种重载签名，支持多数据源、单数据源、响应式对象等
export function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

export function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

export function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

export function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

// watch 的实现
export function watch<T = any, Immediate extends Readonly<boolean> = false>(
  source: T | WatchSource<T>,
  cb: any,
  options?: WatchOptions<Immediate>
): WatchStopHandle {
  // 如果没有回调，开发环境下警告
  if (__DEV__ && typeof cb !== 'function') {
    warn(
      `\`watch(fn, options?)\` signature has been moved to a separate API. ` +
        `Use \`watchEffect(fn, options?)\` instead. \`watch\` now only ` +
        `supports \`watch(source, cb, options?) signature.`
    )
  }
  return doWatch(source as any, cb, options)
}

/**
 * watch 和 watchEffect 的底层实现函数。
 * 负责根据不同的数据源类型和选项，创建 Watcher 实例，实现响应式副作用或侦听。
 *
 * @param source   监听的数据源，可以是 ref、getter、响应式对象、数组或副作用函数
 * @param cb       回调函数，watchEffect 时为 null
 * @param options  监听选项，包括 immediate、deep、flush、onTrack、onTrigger 等
 * @returns        返回一个停止监听的函数（WatchStopHandle）
 */
function doWatch(
  source: WatchSource | WatchSource[] | WatchEffect | object,
  cb: WatchCallback | null,
  {
    immediate,
    deep,
    flush = 'pre',
    onTrack,
    onTrigger
  }: WatchOptions = emptyObject
): WatchStopHandle {
  // watchEffect 不支持 immediate/deep，开发环境下给出警告
  if (__DEV__ && !cb) {
    if (immediate !== undefined) {
      warn(
        `watch() "immediate" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
    if (deep !== undefined) {
      warn(
        `watch() "deep" option is only respected when using the ` +
          `watch(source, callback, options?) signature.`
      )
    }
  }

  // 非法数据源警告函数
  const warnInvalidSource = (s: unknown) => {
    warn(
      `Invalid watch source: ${s}. A watch source can only be a getter/effect ` +
        `function, a ref, a reactive object, or an array of these types.`
    )
  }

  const instance = currentInstance
  // 用于调用 getter/callback 并处理错误
  const call = (fn: Function, type: string, args: any[] | null = null) => {
    const res = invokeWithErrorHandling(fn, null, args, instance, type)
    if (deep && res && res.__ob__) res.__ob__.dep.depend()
    return res
  }

  let getter: () => any
  let forceTrigger = false
  let isMultiSource = false

  // 根据不同类型的数据源，生成 getter 函数
  if (isRef(source)) {
    // 如果是 ref，getter 返回 ref.value
    getter = () => source.value
    forceTrigger = isShallow(source)
  } else if (isReactive(source)) {
    // 如果是响应式对象，getter 返回对象本身，并收集依赖
    getter = () => {
      ;(source as any).__ob__.dep.depend()
      return source
    }
    deep = true
  } else if (Array.isArray(source)) {
    // 如果是数组，说明是多数据源
    isMultiSource = true
    forceTrigger = source.some(s => isReactive(s) || isShallow(s))
    getter = () =>
      source.map(s => {
        if (isRef(s)) {
          return s.value
        } else if (isReactive(s)) {
          s.__ob__.dep.depend()
          return traverse(s)
        } else if (isFunction(s)) {
          return call(s, WATCHER_GETTER)
        } else {
          __DEV__ && warnInvalidSource(s)
        }
      })
  } else if (isFunction(source)) {
    if (cb) {
      // 如果有回调，getter 调用 source 并收集依赖
      getter = () => call(source, WATCHER_GETTER)
    } else {
      // watchEffect 情况，getter 直接执行副作用
      getter = () => {
        if (instance && instance._isDestroyed) {
          return
        }
        if (cleanup) {
          cleanup()
        }
        return call(source, WATCHER, [onCleanup])
      }
    }
  } else {
    // 其他类型，getter 为 noop 并警告
    getter = noop
    __DEV__ && warnInvalidSource(source)
  }

  // 如果是深度监听，递归遍历所有属性
  if (cb && deep) {
    const baseGetter = getter
    getter = () => traverse(baseGetter())
  }

  let cleanup: () => void
  // onCleanup 用于注册清理函数
  let onCleanup: OnCleanup = (fn: () => void) => {
    cleanup = watcher.onStop = () => {
      call(fn, WATCHER_CLEANUP)
    }
  }

  // SSR 环境下特殊处理
  if (isServerRendering()) {
    onCleanup = noop
    if (!cb) {
      getter()
    } else if (immediate) {
      call(cb, WATCHER_CB, [
        getter(),
        isMultiSource ? [] : undefined,
        onCleanup
      ])
    }
    return noop
  }

  // 创建 Watcher 实例，lazy: true 表示惰性求值
  const watcher = new Watcher(currentInstance, getter, noop, {
    lazy: true
  })
  watcher.noRecurse = !cb

  let oldValue = isMultiSource ? [] : INITIAL_WATCHER_VALUE
  // 重写 watcher.run 方法，实现 watch 的核心逻辑
  watcher.run = () => {
    if (!watcher.active) {
      return
    }
    if (cb) {
      // watch(source, cb)
      const newValue = watcher.get()
      if (
        deep ||
        forceTrigger ||
        (isMultiSource
          ? (newValue as any[]).some((v, i) =>
              hasChanged(v, (oldValue as any[])[i])
            )
          : hasChanged(newValue, oldValue))
      ) {
        // 执行清理函数
        if (cleanup) {
          cleanup()
        }
        // 执行回调
        call(cb, WATCHER_CB, [
          newValue,
          oldValue === INITIAL_WATCHER_VALUE ? undefined : oldValue,
          onCleanup
        ])
        oldValue = newValue
      }
    } else {
      // watchEffect 情况，直接执行 getter
      watcher.get()
    }
  }

  // 根据 flush 选项设置 watcher 的调度方式
  if (flush === 'sync') {
    watcher.update = watcher.run
  } else if (flush === 'post') {
    watcher.post = true
    watcher.update = () => queueWatcher(watcher)
  } else {
    // pre（默认）
    watcher.update = () => {
      if (instance && instance === currentInstance && !instance._isMounted) {
        // 组件挂载前的 pre-watcher，先缓存在 _preWatchers
        const buffer = instance._preWatchers || (instance._preWatchers = [])
        if (buffer.indexOf(watcher) < 0) buffer.push(watcher)
      } else {
        queueWatcher(watcher)
      }
    }
  }

  // 开发环境下支持调试
  if (__DEV__) {
    watcher.onTrack = onTrack
    watcher.onTrigger = onTrigger
  }

  // 初始执行
  if (cb) {
    if (immediate) {
      watcher.run()
    } else {
      oldValue = watcher.get()
    }
  } else if (flush === 'post' && instance) {
    // watchEffect 且 flush 为 post，等组件挂载后执行
    instance.$once('hook:mounted', () => watcher.get())
  } else {
    watcher.get()
  }

  // 返回停止监听的函数
  return () => {
    watcher.teardown()
  }
}
