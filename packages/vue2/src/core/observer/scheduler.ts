import type Watcher from './watcher'
import config from '../config'
import Dep, { cleanupDeps } from './dep'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import { warn, nextTick, devtools, inBrowser, isIE } from '../util/index'
import type { Component } from 'types/component'

/**
 * 最大更新计数限制，防止无限循环更新
 *
 * - 如果一个观察者在同一个刷新周期内被触发超过100次，Vue会认为存在无限更新循环并发出警告
 */
export const MAX_UPDATE_COUNT = 100

/**
 * 存储所有待执行的观察者队列
 *
 * - 按照观察者ID排序，确保更新顺序的一致性和可预测性
 */
const queue: Array<Watcher> = []

/**
 * 存储在当前更新周期中被激活的keep-alive组件
 *
 * - 确保组件在DOM更新后正确调用activated生命周期钩子
 */
const activatedChildren: Array<Component> = []

/**
 * 存储已处理的观察者ID
 *
 * - 避免重复处理同一个观察者，提高性能
 */
let has: { [key: number]: true | undefined | null } = {}

/**
 * 存储循环依赖的观察者ID及其深度
 *
 * - 检测并处理循环依赖，防止无限递归
 */
let circular: { [key: number]: number } = {}

/**
 * 标志是否正在等待更新
 *
 * - 在更新过程中设置为true，防止重复更新
 */
let waiting = false

/**
 * 标志是否正在刷新队列
 *
 * - 在刷新过程中设置为true，防止重复刷新
 */
let flushing = false

/**
 * 记录当前正在处理的观察者在队列中的索引位置
 *
 * - 在刷新过程中，用于遍历观察者队列，避免重复处理
 */
let index = 0

/**
 * 重置 Vue 调度器的所有状态变量，清除当前更新周期的所有痕迹，为下一轮更新做准备。
 */
function resetSchedulerState() {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (__DEV__) {
    circular = {}
  }
  waiting = flushing = false
}

// Async edge case #6566 requires saving the timestamp when event listeners are
// attached. However, calling performance.now() has a perf overhead especially
// if the page has thousands of event listeners. Instead, we take a timestamp
// every time the scheduler flushes and use that for all event listeners
// attached during that flush.

/**
 * 记录当前调度器刷新队列的时间戳。
 *
 * - **性能优化**：避免每个事件监听器单独调用 `performance.now()`，而是共享一个时间戳
 * - **一致性**：确保同一刷新周期内创建的所有事件监听器使用相同的时间戳
 * - **边缘情况处理**：解决特定的异步边缘情况
 */
export let currentFlushTimestamp = 0

// Async edge case fix requires storing an event listener's attach timestamp.
let getNow: () => number = Date.now

// Determine what event timestamp the browser is using. Annoyingly, the
// timestamp can either be hi-res (relative to page load) or low-res
// (relative to UNIX epoch), so in order to compare time we have to use the
// same timestamp type when saving the flush timestamp.
// All IE versions use low-res event timestamps, and have problematic clock
// implementations (#9632)
if (inBrowser && !isIE) {
  const performance = window.performance
  if (
    performance &&
    typeof performance.now === 'function' &&
    getNow() > document.createEvent('Event').timeStamp
  ) {
    // if the event timestamp, although evaluated AFTER the Date.now(), is
    // smaller than it, it means the event is using a hi-res timestamp,
    // and we need to use the hi-res version for event listener timestamps as
    // well.
    getNow = () => performance.now()
  }
}

/**
 * 用于在调度器中对观察者队列(`queue`)进行排序
 * @param a
 * @param b
 * @returns
 */
const sortCompareFn = (a: Watcher, b: Watcher): number => {
  if (a.post) {
    if (!b.post) return 1
  } else if (b.post) {
    return -1
  }
  return a.id - b.id
}

/**
 * 按特定顺序处理观察者队列，执行组件的更新过程。它是异步更新机制的执行入口。
 */
function flushSchedulerQueue() {
  // 记录当前刷新时间戳，用于事件系统
  currentFlushTimestamp = getNow()
  // 设置 `flushing` 标志为 `true`，表示队列正在刷新
  flushing = true
  let watcher, id

  // Sort queue before flush.
  // This ensures that:
  // 1. Components are updated from parent to child. (because parent is always
  //    created before the child)
  // 2. A component's user watchers are run before its render watcher (because
  //    user watchers are created before the render watcher)
  // 3. If a component is destroyed during a parent component's watcher run,
  //    its watchers can be skipped.
  // 1. **父组件先于子组件更新**：保证数据流向的一致性
  // 2. **用户侦听器先于渲染观察者执行**：确保自定义逻辑优先
  // 3. **可以跳过已销毁组件的观察者**：提高效率
  queue.sort(sortCompareFn)

  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    if (watcher.before) {
      watcher.before()
    }
    id = watcher.id
    has[id] = null
    watcher.run()
    // in dev build, check and stop circular updates.
    if (__DEV__ && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' +
            (watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  // 保存队列副本并重置状态
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)
  cleanupDeps()

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

/**
 * 函数负责在组件更新完成后调用组件的 `updated` 生命周期钩子。它确保只有满足特定条件的组件才会触发此钩子。
 * @param queue 已完成更新的观察者(Watcher)数组，这是更新队列的一个副本
 */
function callUpdatedHooks(queue: Watcher[]) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm && vm._watcher === watcher && vm._isMounted && !vm._isDestroyed) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
/**
 * 将一个被激活的 `<keep-alive>` 组件实例添加到激活队列中，以便在当前更新周期结束后触发其 `activated` 生命周期钩子。
 * @param vm 要激活的 Vue 组件实例，通常是一个从非活跃状态变为活跃状态的 `<keep-alive>` 缓存组件
 */
export function queueActivatedComponent(vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  // 将组件的 `_inactive` 标志设置为 `false`，表示组件已处于活跃状态
  vm._inactive = false
  activatedChildren.push(vm)
}

/**
 * 处理 `<keep-alive>` 组件激活过程，为队列中的每个组件触发 `activated` 生命周期钩子
 * @param queue 需要激活的组件实例数组，即前面通过 `queueActivatedComponent` 收集的 `activatedChildren` 的副本
 */
function callActivatedHooks(queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 */
/**
 * 将观察者添加到更新队列，并安排异步更新
 * @param watcher 需要加入队列的观察者对象，包含组件更新或计算属性重新计算的任务
 * @returns
 */
export function queueWatcher(watcher: Watcher) {
  const id = watcher.id
  // 去重检查，避免同一个观察者在一个更新周期内被多次添加
  if (has[id] != null) {
    return
  }

  // 递归保护，防止当前正在收集依赖的观察者递归触发自身
  if (watcher === Dep.target && watcher.noRecurse) {
    return
  }

  has[id] = true
  if (!flushing) {
    queue.push(watcher)
  } else {
    // 如果队列正在刷新，根据ID插入到合适位置
    // 队列刷新中：根据观察者ID找到合适位置插入，保持队列有序

    // if already flushing, splice the watcher based on its id
    // if already past its id, it will be run next immediately.
    let i = queue.length - 1
    while (i > index && queue[i].id > watcher.id) {
      i--
    }
    queue.splice(i + 1, 0, watcher)
  }
  // queue the flush
  if (!waiting) {
    waiting = true

    // - 首次添加观察者时，标记等待状态并安排队列刷新
    // - 开发环境且禁用异步时立即刷新（用于调试）
    // - 正常情况下使用 `nextTick` 在微任务队列中安排刷新

    if (__DEV__ && !config.async) {
      flushSchedulerQueue()
      return
    }
    nextTick(flushSchedulerQueue)
  }
}
