import Watcher from 'core/observer/watcher'
import { warn } from 'core/util'

/**
 * 当前活动的 EffectScope 实例。
 * 用于跟踪当前正在运行的 effect scope。
 * 如果没有活动的 effect scope，则为 undefined。
 */
export let activeEffectScope: EffectScope | undefined

/**
 * 一个用于管理副作用（effects）的作用域类，通常用于 Vue 3 的响应式系统中。
 * 它允许将多个副作用（如 Watcher 或清理函数）集中管理，并在适当的时候统一清理，避免内存泄漏
 *
 * 作用域管理：
 * - EffectScope 可以嵌套，支持父子作用域的层级关系。
 * - 子作用域会自动注册到父作用域中，便于统一管理。
 *
 * 副作用收集：
 * - 通过 effects 数组存储关联的 Watcher 实例。
 * 通过 cleanups 数组存储清理函数。
 *
 * 作用域的激活与停用：
 * - 提供 on 和 off 方法，用于激活或停用当前作用域。
 * - 提供 stop 方法，用于停止当前作用域及其子作用域，并清理所有副作用。
 *
 * 运行函数：
 * - 提供 run 方法，在当前作用域中运行传入的函数，并自动设置为活动作用域。
 *
 */
export class EffectScope {
  /**
   * 是否处于活动状态
   */
  active = true

  /**
   * 存储关联的 Watcher 实例
   */
  effects: Watcher[] = []

  /**
   * 存储清理函数
   */
  cleanups: (() => void)[] = []

  /**
   * 父级作用域
   */
  parent: EffectScope | undefined

  /**
   * 存储未分离的子作用域
   */
  scopes: EffectScope[] | undefined

  /**
   * 标识是否为组件根作用域
   */
  _vm?: boolean

  /**
   * 子作用域在父作用域中的索引，用于优化移除操作
   */
  private index: number | undefined

  /**
   * 构造函数
   * @param detached 是否为分离作用域
   */
  constructor(public detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1
    }
  }

  /**
   * 运行传入的函数，并将当前作用域设置为活动状态
   * @param fn 要运行的函数
   */
  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const currentEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = currentEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  /**
   * 激活当前作用域
   * 仅适用于非分离作用域
   */
  on() {
    activeEffectScope = this
  }

  /**
   * 停用当前作用域
   * 仅适用于非分离作用域
   */
  off() {
    activeEffectScope = this.parent
  }

  /**
   * 停止当前作用域及其子作用域
   * @param fromParent 是否从父作用域调用
   */
  stop(fromParent?: boolean) {
    if (this.active) {
      let i, l
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].teardown()
      }
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
      }
      // 嵌套作用域，从父作用域中解除引用以避免内存泄漏
      if (!this.detached && this.parent && !fromParent) {
        // 优化的 O(1) 移除操作
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
      this.active = false
    }
  }
}

/**
 * 创建一个新的 EffectScope 实例
 * @param detached 是否为分离作用域
 */
export function effectScope(detached?: boolean) {
  return new EffectScope(detached)
}

/**
 * 记录一个 effect 到指定的作用域中
 * @param effect 要记录的 Watcher 实例
 * @param scope 要记录到的 EffectScope 实例，默认为当前活动的作用域
 * @internal
 */
export function recordEffectScope(
  effect: Watcher,
  scope: EffectScope | undefined = activeEffectScope
) {
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

/**
 * 获取当前活动的 EffectScope。
 *
 * @returns 当前的活动 EffectScope，如果没有活动的则返回 undefined。
 */
export function getCurrentScope() {
  return activeEffectScope
}

/**
 * 注册一个回调函数，当当前活动的 effect scope 被销毁时调用。
 *
 * @param fn 要在 effect scope 销毁时调用的回调函数。
 *
 * 如果当前没有活动的 effect scope，并且处于开发环境下，会发出警告。
 */
export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`
    )
  }
}
