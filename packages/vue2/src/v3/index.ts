/**
 * Note: also update dist/vue.runtime.mjs when adding new exports to this file.
 */

/**
 * 一个占位符，会在构建过程中通过工具（如 Webpack、Rollup 或 Vite）替换为实际的版本号字符串，例如 `1.0.0`。
 */
export const version: string = '__VERSION__'

export {
  ref,
  shallowRef,
  isRef,
  toRef,
  toRefs,
  unref,
  proxyRefs,
  customRef,
  triggerRef,
  Ref,
  ToRef,
  ToRefs,
  UnwrapRef,
  ShallowRef,
  ShallowUnwrapRef,
  RefUnwrapBailTypes,
  CustomRefFactory
} from './reactivity/ref'

export {
  reactive,
  isReactive,
  isReadonly,
  isShallow,
  isProxy,
  shallowReactive,
  markRaw,
  toRaw,
  ReactiveFlags,
  ShallowReactive,
  UnwrapNestedRefs
} from './reactivity/reactive'

export { readonly, shallowReadonly, DeepReadonly } from './reactivity/readonly'

export {
  computed,
  ComputedRef,
  WritableComputedRef,
  WritableComputedOptions,
  ComputedGetter,
  ComputedSetter
} from './reactivity/computed'

export {
  watch,
  watchEffect,
  watchPostEffect,
  watchSyncEffect,
  WatchEffect,
  WatchOptions,
  WatchOptionsBase,
  WatchCallback,
  WatchSource,
  WatchStopHandle
} from './apiWatch'

export {
  EffectScope,
  effectScope,
  onScopeDispose,
  getCurrentScope
} from './reactivity/effectScope'

export { DebuggerOptions, DebuggerEvent, DebuggerEventExtraInfo } from './debug'

export { TrackOpTypes, TriggerOpTypes } from './reactivity/operations'

export { provide, inject, InjectionKey } from './apiInject'

export { h } from './h'
export { getCurrentInstance } from './currentInstance'
export { useSlots, useAttrs, useListeners, mergeDefaults } from './apiSetup'
export { nextTick } from 'core/util/next-tick'
export { set, del } from 'core/observer'

export { useCssModule } from './sfc-helpers/useCssModule'
export { useCssVars } from './sfc-helpers/useCssVars'

/**
 * @internal
 * 该类型在 <root>/types/v3-define-component.d.ts 中手动声明。
 *
 * 用于定义一个组件。主要用于类型推导和语义标记，实际运行时只是原样返回 options。
 *
 * @param options 组件的选项对象（如 data、props、setup、render 等）
 * @returns       返回传入的 options 对象本身
 */
export function defineComponent(options: any) {
  return options
}

export { defineAsyncComponent } from './apiAsyncComponent'

export * from './apiLifecycle'
