import { Config } from 'core/config'
import { Component } from './component'

/**
 * 全局 API 接口
 * @internal
 */
export interface GlobalAPI {
  /**
   * Vue 实例构造函数
   */
  (options?: any): void

  /**
   * 全局唯一标识符
   */
  cid: number

  /**
   * 全局配置选项
   */
  options: Record<string, any>

  /**
   * 配置对象
   */
  config: Config

  /**
   * 工具方法集合
   */
  util: Object

  /**
   * 创建组件的扩展方法
   */
  extend: (options: typeof Component | object) => typeof Component

  /**
   * 设置对象或数组的属性
   */
  set: <T>(target: Object | Array<T>, key: string | number, value: T) => T

  /**
   * 删除对象或数组的属性
   */
  delete: <T>(target: Object | Array<T>, key: string | number) => void

  /**
   * 在下一个 DOM 更新周期之后执行回调
   */
  nextTick: (fn: Function, context?: Object) => void | Promise<any>

  /**
   * 注册或使用插件
   */
  use: (plugin: Function | Object) => GlobalAPI

  /**
   * 全局混入方法
   */
  mixin: (mixin: Object) => GlobalAPI

  /**
   * 编译模板为渲染函数
   */
  compile: (template: string) => {
    render: Function
    staticRenderFns: Array<Function>
  }

  /**
   * 注册或获取指令
   */
  directive: (id: string, def?: Function | Object) => Function | Object | void

  /**
   * 注册或获取组件
   */
  component: (
    id: string,
    def?: typeof Component | Object
  ) => typeof Component | void

  /**
   * 注册或获取过滤器
   */
  filter: (id: string, def?: Function) => Function | void

  /**
   * 将对象变为可观察对象
   */
  observable: <T>(value: T) => T

  /**
   * 允许动态方法注册
   */
  [key: string]: any
}
