import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'
import type { GlobalAPI } from 'types/global-api'

/**
 * Vue 的入口点，用于创建 Vue 实例
 */
function Vue(options) {
  if (__DEV__ && !(this instanceof Vue)) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

/**
 * - 为 `Vue` 添加初始化方法 `_init`。
 * - `_init` 是 Vue 实例的核心初始化方法，用于完成实例的选项合并、生命周期初始化、事件初始化等。
 */
//@ts-expect-error Vue has function type
initMixin(Vue)

/**
 * - 为 `Vue` 添加与状态相关的方法。
 * - 添加 `$data` 和 `$props` 的访问器。
 * - 添加 `$set`、`$delete` 和 `$watch` 方法，用于操作响应式数据。
 */
//@ts-expect-error Vue has function type
stateMixin(Vue)

/**
 * - 为 `Vue` 添加事件相关的方法。
 * - 添加 `$on`、`$once`、`$off` 和 `$emit` 方法，用于事件的订阅、取消订阅和触发。
 */
//@ts-expect-error Vue has function type
eventsMixin(Vue)

/**
 * - 为 `Vue` 添加生命周期相关的方法。
 * - 添加 `$forceUpdate` 和 `$destroy` 方法。
 * - 定义组件的销毁逻辑。
 */
//@ts-expect-error Vue has function type
lifecycleMixin(Vue)

/**
 * - 为 `Vue` 添加渲染相关的方法。
 * - 添加 `$nextTick` 方法，用于在下次 DOM 更新后执行回调。
 * - 定义 `_render` 方法，用于生成虚拟 DOM。
 */
//@ts-expect-error Vue has function type
renderMixin(Vue)

export default Vue as unknown as GlobalAPI
