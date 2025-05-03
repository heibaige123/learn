import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError,
  invokeWithErrorHandling,
  noop,
  isFunction
} from '../util/index'

import { traverse } from './traverse'
import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget, DepTarget } from './dep'
import { DebuggerEvent, DebuggerOptions } from 'v3/debug'

import type { SimpleSet } from '../util/index'
import type { Component } from 'types/component'
import { activeEffectScope, recordEffectScope } from 'v3/reactivity/effectScope'

/** 全局变量，用于为每个 watcher 实例分配唯一标识符。 */
let uid = 0

/**
 * Vue 2 响应式系统的核心部分，负责：
 * 1. **依赖收集**：跟踪组件模板或计算属性依赖的响应式数据。
 * 2. **变更通知**：当依赖的数据变化时，触发组件重新渲染或计算属性重新计算。
 * 3. **用户侦听器**：实现 `watch` 选项和 `$watch` API。
 * @internal
 */
export interface WatcherOptions extends DebuggerOptions {
  /** 是否深度观察。如果为 `true`，watcher 会递归遍历被观察对象的所有属性，使这些嵌套属性的变化也能触发回调。 */
  deep?: boolean
  /** 是否是用户定义的 watcher。用户定义的 watcher 是通过 `vm.$watch` 或组件选项中的 `watch` 属性创建的，它们的错误处理更加友好。 */
  user?: boolean
  /** 是否是惰性求值的 watcher。计算属性（computed）使用惰性 watcher，只有当它们被访问时才会计算值。 */
  lazy?: boolean
  /** 是否同步执行回调。默认情况下，watcher 回调会被推入异步更新队列，但如果设置为 `true`，回调会在数据变化时立即执行。 */
  sync?: boolean
  /** 可选的钩子函数，在 watcher 运行前执行。通常用于在更新 DOM 前执行一些操作（如获取滚动位置）。 */
  before?: Function
}

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 * @internal
 */
/**
 * Vue 2 响应式系统的核心，它负责：
 1. 解析表达式或函数
 2. 收集依赖（追踪响应式数据）
 3. 当依赖变化时触发回调
 */
export default class Watcher implements DepTarget {
  /** 所属组件实例 */
  vm?: Component | null
  /** 表达式字符串，主要用于调试 */
  expression: string
  /** 回调函数，值变化时调用 */
  cb: Function
  /** 唯一标识符，用于排序和去重 */
  id: number

  // 配置选项相关

  /** 是否深度监听 */
  deep: boolean
  /** 是否由用户创建（$watch API） */
  user: boolean
  /** 是否惰性求值（计算属性用） */
  lazy: boolean
  /** 是否同步执行 */
  sync: boolean
  /** 对于计算属性，脏检查标记 */
  dirty: boolean

  // 状态控制

  /** 是否活跃 */
  active: boolean
  /** 是否为后置watcher */
  post: boolean

  // 依赖相关

  /** 当前依赖集合 */
  deps: Array<Dep>
  /** 新一轮依赖收集的依赖集合 */
  newDeps: Array<Dep>
  /** deps的id集合，用于快速查找 */
  depIds: SimpleSet
  /** newDeps的id集合 */
  newDepIds: SimpleSet

  // 核心功能

  /**  执行前的钩子 */
  before?: Function
  /** 获取观察值的函数 */
  getter: Function
  /** 当前值 */
  value: any
  /** 当 watcher 停止（被销毁）时会调用的回调函数。 */
  onStop?: Function
  /** 控制 watcher 在执行时是否应该避免递归触发自身。 */
  noRecurse?: boolean

  // dev only
  // 开发辅助
  /** 依赖收集/触发时的调试钩子 */
  onTrack?: ((event: DebuggerEvent) => void) | undefined
  onTrigger?: ((event: DebuggerEvent) => void) | undefined

  constructor(
    vm: Component | null,
    expOrFn: string | (() => any),
    cb: Function,
    options?: WatcherOptions | null,
    isRenderWatcher?: boolean
  ) {
    recordEffectScope(
      this,
      // if the active effect scope is manually created (not a component scope),
      // prioritize it
      activeEffectScope && !activeEffectScope._vm
        ? activeEffectScope
        : vm
        ? vm._scope
        : undefined
    )
    if ((this.vm = vm) && isRenderWatcher) {
      vm._watcher = this
    }
    // options
    if (options) {
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
      this.before = options.before
      if (__DEV__) {
        this.onTrack = options.onTrack
        this.onTrigger = options.onTrigger
      }
    } else {
      this.deep = this.user = this.lazy = this.sync = false
    }
    this.cb = cb
    this.id = ++uid // uid for batching
    this.active = true
    this.post = false
    this.dirty = this.lazy // for lazy watchers
    this.deps = []
    this.newDeps = []
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = __DEV__ ? expOrFn.toString() : ''
    // parse expression for getter
    // 处理表达式或函数，得到getter
    if (isFunction(expOrFn)) {
      this.getter = expOrFn
    } else {
      // 解析'obj.a.b'这样的路径
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        this.getter = noop
        __DEV__ &&
          warn(
            `Failed watching path: "${expOrFn}" ` +
              'Watcher only accepts simple dot-delimited paths. ' +
              'For full control, use a function instead.',
            vm
          )
      }
    }
    // 非惰性watcher立即求值
    this.value = this.lazy ? undefined : this.get()
  }

  /**
   * 依赖收集核心
   */
  get() {
    // 设置当前watcher为全局活动watcher
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 执行getter，其中会触发响应式属性的getter，从而收集依赖
      value = this.getter.call(vm, vm)
    } catch (e: any) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        // 深度遍历，触发所有嵌套属性的getter
        traverse(value)
      }
      // 恢复之前的全局watcher
      popTarget()
      // 清理依赖
      this.cleanupDeps()
    }
    return value
  }

  /**
   * 添加依赖
   */
  addDep(dep: Dep) {
    const id = dep.id
    // 去重
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 不在旧依赖中才添加订阅
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * 清理依赖
   */
  cleanupDeps() {
    // 移除不再依赖的属性
    let i = this.deps.length
    while (i--) {
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    // 交换新旧依赖集合，复用对象提高性能
    let tmp: any = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    // 同样交换deps数组
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * 响应变化
   */
  update() {
    /* istanbul ignore else */
    if (this.lazy) {
      // 计算属性只标记为脏
      this.dirty = true
    } else if (this.sync) {
      // 同步watcher立即执行
      this.run()
    } else {
      // 加入异步更新队列
      queueWatcher(this)
    }
  }

  /**
   * 执行更新
   */
  run() {
    if (this.active) {
      // 重新求值
      const value = this.get()
      if (
        // 值变化
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        // 对象可能内部变化
        isObject(value) ||
        // 深度监听总是触发
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        // 执行回调
        if (this.user) {
          const info = `callback for watcher "${this.expression}"`
          // 用户watcher带错误处理
          invokeWithErrorHandling(
            this.cb,
            this.vm,
            [value, oldValue],
            this.vm,
            info
          )
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * 惰性求值（用于计算属性）
   */
  evaluate() {
    this.value = this.get()
    // 标记为已计算
    this.dirty = false
  }

  /**
   * 让当前活跃的 watcher 也收集此 watcher 所依赖的所有依赖
   */
  depend() {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * 完全销毁一个 watcher，清理其所有依赖关系，防止内存泄漏。
   */
  teardown() {
    // 检查避免在组件销毁过程中重复操作
    if (this.vm && !this.vm._isBeingDestroyed) {
      remove(this.vm._scope.effects, this)
    }
    if (this.active) {
      let i = this.deps.length
      while (i--) {
        // 用于从依赖的订阅者列表移除当前 watcher
        this.deps[i].removeSub(this)
      }
      this.active = false
      if (this.onStop) {
        this.onStop()
      }
    }
  }
}
