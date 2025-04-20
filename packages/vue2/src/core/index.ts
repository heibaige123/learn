import Vue from './instance/index'
import { initGlobalAPI } from './global-api/index'
import { isServerRendering } from 'core/util/env'
import { FunctionalRenderContext } from 'core/vdom/create-functional-component'
import { version } from 'v3'

/**
 * Vue 的核心入口文件，导入 Vue 实例并初始化全局 API。
 * 定义了一些与服务端渲染相关的属性和方法。
 */

/**
 * 初始化全局 API 到 Vue 构造函数上。
 * @param Vue Vue 构造函数
 */
initGlobalAPI(Vue)

/**
 * 定义 Vue 实例的 $isServer 属性，用于判断是否在服务端渲染环境中。
 */
Object.defineProperty(Vue.prototype, '$isServer', {
  get: isServerRendering
})

/**
 * 定义 Vue 实例的 $ssrContext 属性，用于获取服务端渲染的上下文。
 */
Object.defineProperty(Vue.prototype, '$ssrContext', {
  get() {
    /* istanbul ignore next */
    return this.$vnode && this.$vnode.ssrContext
  }
})

/**
 * 暴露 FunctionalRenderContext，用于服务端渲染运行时的辅助安装。
 */
Object.defineProperty(Vue, 'FunctionalRenderContext', {
  value: FunctionalRenderContext
})

/**
 * 定义 Vue 的版本号。
 */
Vue.version = version

export default Vue
