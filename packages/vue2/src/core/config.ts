import { no, noop, identity } from 'shared/util'

import { LIFECYCLE_HOOKS } from 'shared/constants'
import type { Component } from 'types/component'

/**
 * @internal
 */
export interface Config {
  /** 用户配置选项的合并策略 */
  optionMergeStrategies: { [key: string]: Function }

  /** 是否取消 Vue 所有的日志与警告 */
  silent: boolean

  /** 是否在生产环境下显示生产模式的提示信息 */
  productionTip: boolean

  /** 是否开启性能追踪 */
  performance: boolean

  /** 是否启用开发者工具 */
  devtools: boolean

  /** 自定义全局错误处理函数 */
  errorHandler?: (err: Error, vm: Component | null, info: string) => void

  /** 自定义全局警告处理函数 */
  warnHandler?: (msg: string, vm: Component | null, trace: string) => void

  /** 忽略的元素列表，可以是字符串或正则表达式 */
  ignoredElements: Array<string | RegExp>

  /** 自定义键码别名 */
  keyCodes: { [key: string]: number | Array<number> }

  /** 检查是否为保留的标签 */
  isReservedTag: (x: string) => boolean | undefined

  /** 检查是否为保留的属性 */
  isReservedAttr: (x: string) => true | undefined

  /** 解析平台特定的标签名 */
  parsePlatformTagName: (x: string) => string

  /** 检查是否为未知的元素 */
  isUnknownElement: (x: string) => boolean

  /** 获取标签的命名空间 */
  getTagNamespace: (x: string) => string | undefined

  /** 检查是否必须使用 prop 绑定 */
  mustUseProp: (tag: string, type?: string | null, name?: string) => boolean

  /** 是否启用异步更新 */
  async: boolean

  /** 生命周期钩子函数的列表（仅用于兼容旧版） */
  _lifecycleHooks: Array<string>
}

export default {
  /**
   * 用户配置选项的合并策略
   * (用于 core/util/options)
   */
  // $flow-disable-line
  optionMergeStrategies: Object.create(null),

  /**
   * 是否取消 Vue 所有的日志与警告
   */
  silent: false,

  /**
   * 是否在生产环境下显示生产模式的提示信息
   */
  productionTip: __DEV__,

  /**
   * 是否启用开发者工具
   */
  devtools: __DEV__,

  /**
   * 是否开启性能追踪
   */
  performance: false,

  /**
   * 自定义全局错误处理函数
   * 用于处理观察者错误
   */
  errorHandler: null,

  /**
   * 自定义全局警告处理函数
   * 用于处理观察者警告
   */
  warnHandler: null,

  /**
   * 忽略的元素列表，可以是字符串或正则表达式
   */
  ignoredElements: [],

  /**
   * 自定义键码别名
   * 用于 v-on 的用户键别名
   */
  // $flow-disable-line
  keyCodes: Object.create(null),

  /**
   * 检查是否为保留的标签
   * 平台相关，可以被覆盖
   */
  isReservedTag: no,

  /**
   * 检查是否为保留的属性
   * 平台相关，可以被覆盖
   */
  isReservedAttr: no,

  /**
   * 检查是否为未知的元素
   * 平台相关
   */
  isUnknownElement: no,

  /**
   * 获取标签的命名空间
   */
  getTagNamespace: noop,

  /**
   * 解析平台特定的标签名
   */
  parsePlatformTagName: identity,

  /**
   * 检查是否必须使用 prop 绑定
   * 平台相关，例如 value
   */
  mustUseProp: no,

  /**
   * 是否启用异步更新
   * 主要用于 Vue Test Utils
   * 如果设置为 false，会显著降低性能
   */
  async: true,

  /**
   * 生命周期钩子函数的列表
   * 暴露出来仅用于兼容旧版
   */
  _lifecycleHooks: LIFECYCLE_HOOKS
} as unknown as Config
