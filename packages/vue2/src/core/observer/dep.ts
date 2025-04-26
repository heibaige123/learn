/**
### 使用场景

#### 1. **依赖收集**
- 当响应式属性被访问时，调用 `depend` 方法，将当前的 `Dep` 添加到 `Dep.target` 的依赖列表中。

#### 2. **依赖通知**
- 当响应式属性被修改时，调用 `notify` 方法，通知所有订阅者进行更新。

#### 3. **嵌套依赖**
- 使用 `pushTarget` 和 `popTarget` 管理嵌套的依赖收集。


1. **`Dep`**
   - 表示依赖管理器，用于管理响应式属性的订阅者。

2. **`Dep.target`**
   - 当前正在被收集依赖的目标（`Watcher`）。

3. **核心方法**
   - `addSub`：添加订阅者。
   - `removeSub`：移除订阅者。
   - `depend`：收集依赖。
   - `notify`：通知订阅者更新。

4. **辅助工具**
   - `pushTarget` 和 `popTarget`：管理依赖收集的栈。
   - `cleanupDeps`：清理无效的订阅者。
*/

import config from '../config'
import { DebuggerOptions, DebuggerEventExtraInfo } from 'v3'

let uid = 0

const pendingCleanupDeps: Dep[] = []

/**
 * 清理所有标记为需要清理的 `Dep` 实例。
 */
export const cleanupDeps = () => {
  for (let i = 0; i < pendingCleanupDeps.length; i++) {
    const dep = pendingCleanupDeps[i]
    dep.subs = dep.subs.filter(s => s)
    dep._pending = false
  }
  pendingCleanupDeps.length = 0
}

/**
 * 表示当前正在被收集依赖的目标（通常是 `Watcher`）。
 * @internal
 */
export interface DepTarget extends DebuggerOptions {
  id: number
  addDep(dep: Dep): void
  update(): void
}

/**
 * - 依赖管理器（Dependency Manager）
 * - 每个响应式属性都会对应一个 `Dep` 实例，用于管理依赖该属性的所有订阅者（`Watcher`）。
 * @internal
 */
export default class Dep {
  /**
   * - 表示当前正在被收集依赖的目标（`DepTarget`）。
   * - 全局唯一，因为同一时间只能有一个 `Watcher` 被收集。
   */
  static target?: DepTarget | null
  /**
   * 每个 `Dep` 实例的唯一标识符，用于区分不同的依赖管理器。
   */
  id: number
  /**
   * 订阅者列表，存储所有依赖该属性的 `DepTarget`（通常是 `Watcher`）。
   */
  subs: Array<DepTarget | null>
  // pending subs cleanup
  /**
   * - 标记是否需要清理订阅者列表。
   * - 用于优化性能，避免频繁清理订阅者。
   */
  _pending = false

  constructor() {
    this.id = uid++
    this.subs = []
  }

  /**
   * 将订阅者（`DepTarget`）添加到 `subs` 列表中。
   * @param sub
   */
  addSub(sub: DepTarget) {
    this.subs.push(sub)
  }

  /**
   * - 将订阅者从 `subs` 列表中移除。
   * - 为了优化性能，不直接删除，而是将对应位置设置为 `null`，并将当前 `Dep` 标记为需要清理（`_pending = true`）。
   * - 将当前 `Dep` 添加到 `pendingCleanupDeps` 列表中，等待下一次调度时清理。
   * @param sub
   */
  removeSub(sub: DepTarget) {
    // #12696 deps with massive amount of subscribers are extremely slow to
    // clean up in Chromium
    // to workaround this, we unset the sub for now, and clear them on
    // next scheduler flush.
    this.subs[this.subs.indexOf(sub)] = null
    if (!this._pending) {
      this._pending = true
      pendingCleanupDeps.push(this)
    }
  }

  /**
   * - 收集依赖，将当前的 `Dep` 添加到 `Dep.target` 的依赖列表中。
   * @param info
   */
  depend(info?: DebuggerEventExtraInfo) {
    if (Dep.target) {
      Dep.target.addDep(this)
      if (__DEV__ && info && Dep.target.onTrack) {
        // 在开发模式下，如果提供了调试信息（`info`），调用 `onTrack` 回调函数，记录依赖收集的调试信息。
        Dep.target.onTrack({
          effect: Dep.target,
          ...info
        })
      }
    }
  }

  /**
   * - 通知所有订阅者（`DepTarget`）进行更新。
   * @param info
   */
  notify(info?: DebuggerEventExtraInfo) {
    // stabilize the subscriber list first
    // 过滤掉已被标记为 `null` 的订阅者。
    const subs = this.subs.filter(s => s) as DepTarget[]
    if (__DEV__ && !config.async) {
      // subs aren't sorted in scheduler if not running async
      // we need to sort them now to make sure they fire in correct
      // order
      // - 在开发模式下，如果未启用异步更新，按照订阅者的 `id` 排序，确保更新顺序一致。
      subs.sort((a, b) => a.id - b.id)
    }
    // 遍历订阅者列表，调用每个订阅者的 `update` 方法触发更新。
    for (let i = 0, l = subs.length; i < l; i++) {
      const sub = subs[i]
      if (__DEV__ && info) {
        // 在开发模式下，如果提供了调试信息（`info`），调用 `onTrigger` 回调函数，记录触发更新的调试信息。
        sub.onTrigger &&
          sub.onTrigger({
            effect: subs[i],
            ...info
          })
      }
      sub.update()
    }
  }
}

// The current target watcher being evaluated.
// This is globally unique because only one watcher
// can be evaluated at a time.
Dep.target = null
const targetStack: Array<DepTarget | null | undefined> = []

/**
 * 将目标（`DepTarget`）推入栈顶，并设置为当前的 `Dep.target`。
 * @param target
 */
export function pushTarget(target?: DepTarget | null) {
  targetStack.push(target)
  Dep.target = target
}

/**
 * 将栈顶目标弹出，并将 `Dep.target` 设置为栈顶的下一个目标。
 */
export function popTarget() {
  targetStack.pop()
  Dep.target = targetStack[targetStack.length - 1]
}
