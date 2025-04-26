import { TrackOpTypes, TriggerOpTypes } from './reactivity/operations'

/**
 * 定义调试选项的接口。
 * 开发者可以通过实现 `onTrack` 和 `onTrigger` 回调函数，监听响应式系统的行为，帮助调试和分析数据变化。
 */
export interface DebuggerOptions {
  /**
   * 在依赖被收集时触发。
   * @param event
   * @returns
   */
  onTrack?: (event: DebuggerEvent) => void
  /**
   * 在依赖被触发更新时触发。
   * @param event
   * @returns
   */
  onTrigger?: (event: DebuggerEvent) => void
}

/**
 * - 定义调试事件的类型。
 * - 包含依赖收集或触发更新时的详细信息。
 */
export type DebuggerEvent = {
  /**
   * 表示当前的副作用函数（`effect`）。
   * 副作用函数是响应式系统中的核心部分，用于在依赖变化时重新执行。
   * @internal
   */
  effect: any
} & DebuggerEventExtraInfo

/**
 * - 定义调试事件的额外信息。
 * - 包含依赖收集或触发更新时的目标对象、操作类型、键值等信息。
 */
export type DebuggerEventExtraInfo = {
  /**
   * 表示触发事件的目标对象（响应式对象）。
   */
  target: object
  /**
   * 表示操作的类型。
   * - `TrackOpTypes`：依赖收集的操作类型（如读取属性）。
   * - `TriggerOpTypes`：触发更新的操作类型（如设置属性）。
   */
  type: TrackOpTypes | TriggerOpTypes
  /**
   * 表示触发事件的属性键。
   */
  key?: any
  /**
   * 表示触发更新时的新值（仅适用于写操作）。
   */
  newValue?: any
  /**
   * 表示触发更新时的旧值（仅适用于写操作）。
   */
  oldValue?: any
}
