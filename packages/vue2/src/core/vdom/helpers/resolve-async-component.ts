import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  isPromise,
  remove
} from 'core/util/index'

import VNode, { createEmptyVNode } from 'core/vdom/vnode'
import { currentRenderingInstance } from 'core/instance/render'
import type { VNodeData } from 'types/vnode'
import type { Component } from 'types/component'

/**
 * Vue 内部用于**确保传入的组件选项最终被转换为构造函数（Ctor）**的辅助函数。
 * @param comp 组件选项，可能是对象（组件配置）、构造函数、ES module、异步组件返回值等。
 * @param base Vue 构造函数（通常是 Vue 本身），用于调用 `extend`
 * @returns

 ## 举例

 ```js
 // 1. 传入组件对象
 ensureCtor({ template: '<div/>' }, Vue)
 // => 返回 Vue.extend({ template: '<div/>' }) 生成的构造函数

 // 2. 传入构造函数
 ensureCtor(MyComponent, Vue)
 // => 返回 MyComponent

 // 3. 传入 ES module
 ensureCtor({ __esModule: true, default: CompObj }, Vue)
 // => 返回 Vue.extend(CompObj)
 ```

 */
function ensureCtor(comp: any, base) {
  if (comp.__esModule || comp[Symbol.toStringTag] === 'Module') {
    comp = comp.default
  }
  return isObject(comp) ? base.extend(comp) : comp
}

/**
 * - Vue 2 内部用于**创建异步组件的占位 VNode** 的辅助函数。
 * - 它主要用于异步组件还未加载完成时，在虚拟 DOM 树中插入一个特殊的“占位节点”，以便后续异步组件加载完成后能正确地替换和渲染。
 * @param factory 异步组件工厂函数（即 `resolve => require(['./Comp.vue'], resolve)` 这种）。
 * @param data VNode 的 data 对象（包含属性、事件等）。
 * @param context 当前组件实例（上下文）。
 * @param children 子节点数组。
 * @param tag 原始标签名（如 `<my-async-comp>`）。
 * @returns
 */
export function createAsyncPlaceholder(
  factory: Function,
  data: VNodeData | undefined,
  context: Component,
  children: Array<VNode> | undefined,
  tag?: string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

/**
 * Vue 内部用于**解析异步组件**的核心函数。
  - 根据异步组件工厂函数，决定当前应该渲染什么（已加载的组件、loading 组件、error 组件、还是返回 undefined 让外部插入占位节点）。
  - 管理异步组件的加载、超时、错误、loading 状态等生命周期。
  - 支持异步组件的多种写法（Promise、回调、带 loading/error/timeout 的高级配置）。
 * @param factory 异步组件工厂函数
    - **类型**：异步组件工厂函数（带缓存属性）
    - **含义**：定义异步组件的加载方式，可以是：
        - 回调式：`resolve => require(['./Comp.vue'], resolve)`
        - Promise式：`() => import('./Comp.vue')`
        - 高级配置对象：`{ component: Promise, loading, error, delay, timeout }`
    - **扩展属性**：在异步加载过程中，Vue 会在 factory 上挂载一些属性，如：
        - `factory.resolved`：已解析的组件构造函数
        - `factory.error`：是否加载失败
        - `factory.errorComp`：错误时渲染的组件
        - `factory.loading`：是否处于 loading 状态
        - `factory.loadingComp`：loading 时渲染的组件
        - `factory.owners`：当前等待该异步组件的组件实例数组
 * @param baseCtor Vue 构造函数
 * @returns
 */
export function resolveAsyncComponent(
  factory: { (...args: any[]): any; [keye: string]: any },
  baseCtor: typeof Component
): typeof Component | void {
  // 如果之前加载失败且有 error 组件，直接返回 error 组件。
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  // - 如果工厂函数已经解析过（`factory.resolved`），直接返回已解析的组件构造函数。
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  const owner = currentRenderingInstance
  if (owner && isDef(factory.owners) && factory.owners.indexOf(owner) === -1) {
    // already pending
    factory.owners.push(owner)
  }

  // 如果正在加载且有 loading 组件，直接返回 loading 组件。
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  if (owner && !isDef(factory.owners)) {
    // 如果是首次加载，初始化 `owners` 数组（记录所有等待该异步组件的组件实例）。
    const owners = (factory.owners = [owner])
    let sync = true
    let timerLoading: number | null = null
    let timerTimeout: number | null = null

    owner.$on('hook:destroyed', () => remove(owners, owner))

    /**
     * 在异步组件加载状态发生变化（如加载完成、加载失败、超时、loading 状态切换等）时，通知所有依赖该异步组件的父组件强制重新渲染
     * @param renderCompleted
     * - 触发时机
     *    - 异步组件加载成功（resolve 回调触发）
     *    - 异步组件加载失败（reject 回调触发）
     *    - loading 状态切换（delay 到达）
     *    - 超时（timeout 到达）
     */
    const forceRender = (renderCompleted: boolean) => {
      for (let i = 0, l = owners.length; i < l; i++) {
        owners[i].$forceUpdate()
      }

      if (renderCompleted) {
        owners.length = 0
        if (timerLoading !== null) {
          clearTimeout(timerLoading)
          timerLoading = null
        }
        if (timerTimeout !== null) {
          clearTimeout(timerTimeout)
          timerTimeout = null
        }
      }
    }

    /**
     * 当异步组件加载成功时，缓存组件构造函数，并通知所有依赖它的父组件强制重新渲染
     */
    const resolve = once((res: Object | Component) => {
      // cache resolved
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      // - `sync` 是一个标记，表示当前 resolve 是否在同步流程中被调用（比如 SSR 或特殊场景）。
      // - 如果不是同步（即真正的异步加载完成），调用 `forceRender(true)`，通知所有等待该异步组件的父组件强制重新渲染，这样页面上就能显示出加载完成的组件内容。
      // - 如果是同步 resolve（极少见，主要是 SSR 场景），直接清空 owners，不需要强制渲染。
      if (!sync) {
        forceRender(true)
      } else {
        owners.length = 0
      }
    })

    /**
     * 当异步组件加载失败时，设置错误状态，并通知所有依赖它的父组件强制重新渲染
     */
    const reject = once(reason => {
      __DEV__ &&
        warn(
          `Failed to resolve async component: ${String(factory)}` +
            (reason ? `\nReason: ${reason}` : '')
        )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender(true)
      }
    })

    const res = factory(resolve, reject)

    if (isObject(res)) {
      if (isPromise(res)) {
        // () => Promise
        if (isUndef(factory.resolved)) {
          res.then(resolve, reject)
        }
      } else if (isPromise(res.component)) {
        res.component.then(resolve, reject)
        // 处理 error 组件
        if (isDef(res.error)) {
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }
        // 处理 loading 组件
        if (isDef(res.loading)) {
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            factory.loading = true
          } else {
            // @ts-expect-error NodeJS timeout type
            timerLoading = setTimeout(() => {
              timerLoading = null
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                factory.loading = true
                forceRender(false)
              }
            }, res.delay || 200)
          }
        }
        // 处理超时
        if (isDef(res.timeout)) {
          // @ts-expect-error NodeJS timeout type
          timerTimeout = setTimeout(() => {
            timerTimeout = null
            if (isUndef(factory.resolved)) {
              reject(__DEV__ ? `timeout (${res.timeout}ms)` : null)
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // return in case resolved synchronously
    return factory.loading ? factory.loadingComp : factory.resolved
  }
}
