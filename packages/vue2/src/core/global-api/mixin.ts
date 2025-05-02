/*
Vue 插件/扩展系统的一部分。`mixin` 方法允许开发者向 Vue 组件全局添加可复用的功能。
当你调用 `Vue.mixin(...)` 时，
这些选项会被合并到之后创建的每个 Vue 组件中。

例如，调用 `Vue.mixin({ created() { console.log('component created') } })`
会将该生命周期钩子添加到应用程序中的每个组件。
*/

import type { GlobalAPI } from 'types/global-api'
import { mergeOptions } from '../util/index'

/**
 * 向 Vue 构造函数/类添加 `mixin` 方法
 * @param Vue
 */
export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
