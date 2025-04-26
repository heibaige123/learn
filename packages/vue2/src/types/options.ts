import VNode from 'core/vdom/vnode'
import { DebuggerEvent } from 'v3/debug'
import { SetupContext } from 'v3/apiSetup'
import { Component } from './component'

/**
 * 描述 Vue 内部组件的选项配置。它是 Vue 内部实现的一部分，主要用于标识和处理内部组件的特殊选项。
 */
export type InternalComponentOptions = {
  /**
   * 表示组件是否为内部组件，固定为 true
   */
  _isComponent: true

  /**
   * 父组件的引用
   */
  parent: Component

  /**
   * 父组件的 VNode 节点
   */
  _parentVnode: VNode

  /**
   * 组件的渲染函数（可选）
   */
  render?: Function

  /**
   * 组件的静态渲染函数数组（可选）
   */
  staticRenderFns?: Array<Function>
}

/**
 * 表示注入键的类型，可以是字符串或 Symbol。
 */
type InjectKey = string | Symbol

/**
 * @internal
 */
/** 组件选项类型 */
export type ComponentOptions = {
  /**
   * Vue 3 的 setup 函数，用于组合式 API
   * @param props 组件的 props
   * @param ctx 上下文对象，包括 attrs、slots 和 emit
   */
  setup?: (props: Record<string, any>, ctx: SetupContext) => unknown

  /** 任意键值对，用于扩展 */
  [key: string]: any

  /** 组件的唯一标识 */
  componentId?: string

  /**
   * 数据对象或返回数据对象的函数
   */
  data: object | Function | void

  /**
   * 组件的 props 定义，可以是字符串数组或对象
   */
  props?:
    | string[]
    | Record<string, Function | Array<Function> | null | PropOptions>

  /**
   * 父组件传递的 props 数据
   */
  propsData?: object

  /**
   * 计算属性定义
   */
  computed?: {
    [key: string]:
      | Function
      | {
          /** 获取函数 */
          get?: Function
          /** 设置函数 */
          set?: Function
          /** 是否缓存 */
          cache?: boolean
        }
  }

  /**
   * 方法定义
   */
  methods?: { [key: string]: Function }

  /**
   * 侦听器定义
   */
  watch?: { [key: string]: Function | string }

  /**
   * 挂载的 DOM 元素或选择器
   */
  el?: string | Element

  /**
   * 模板字符串
   */
  template?: string

  /**
   * 渲染函数
   * @param h 渲染函数的辅助方法
   */
  render: (h: () => VNode) => VNode

  /**
   * 渲染错误时的回调函数
   * @param h 渲染函数的辅助方法
   * @param err 错误对象
   */
  renderError?: (h: () => VNode, err: Error) => VNode

  /**
   * 静态渲染函数数组
   */
  staticRenderFns?: Array<() => VNode>

  /**
   * 生命周期钩子：组件创建前
   */
  beforeCreate?: Function

  /**
   * 生命周期钩子：组件创建后
   */
  created?: Function

  /**
   * 生命周期钩子：组件挂载前
   */
  beforeMount?: Function

  /**
   * 生命周期钩子：组件挂载后
   */
  mounted?: Function

  /**
   * 生命周期钩子：组件更新前
   */
  beforeUpdate?: Function

  /**
   * 生命周期钩子：组件更新后
   */
  updated?: Function

  /**
   * 生命周期钩子：组件激活时
   */
  activated?: Function

  /**
   * 生命周期钩子：组件停用时
   */
  deactivated?: Function

  /**
   * 生命周期钩子：组件销毁前
   */
  beforeDestroy?: Function

  /**
   * 生命周期钩子：组件销毁后
   */
  destroyed?: Function

  /**
   * 捕获错误时的回调函数
   */
  errorCaptured?: () => boolean | void

  /**
   * 服务端预取数据的函数
   */
  serverPrefetch?: Function

  /**
   * 渲染跟踪事件的回调函数
   */
  renderTracked?(e: DebuggerEvent): void

  /**
   * 渲染触发事件的回调函数
   */
  renderTriggerd?(e: DebuggerEvent): void

  /**
   * 自定义指令集合
   */
  directives?: { [key: string]: object }

  /**
   * 子组件集合
   */
  components?: { [key: string]: Component }

  /**
   * 过渡效果集合
   */
  transitions?: { [key: string]: object }

  /**
   * 过滤器集合
   */
  filters?: { [key: string]: Function }

  /**
   * 提供依赖注入的对象或函数
   */
  provide?: Record<string | symbol, any> | (() => Record<string | symbol, any>)

  /**
   * 注入依赖的定义
   */
  inject?:
    | { [key: string]: InjectKey | { from?: InjectKey; default?: any } }
    | Array<string>

  /**
   * 自定义 v-model 的配置
   */
  model?: {
    /** 绑定的 prop 名称 */
    prop?: string
    /** 触发的事件名称 */
    event?: string
  }

  /**
   * 父组件实例
   */
  parent?: Component

  /**
   * 混入对象数组
   */
  mixins?: Array<object>

  /**
   * 组件名称
   */
  name?: string

  /**
   * 扩展的组件或对象
   */
  extends?: Component | object

  /**
   * 模板分隔符
   */
  delimiters?: [string, string]

  /**
   * 是否保留注释
   */
  comments?: boolean

  /**
   * 是否继承属性
   */
  inheritAttrs?: boolean

  /**
   * 是否为抽象组件
   */
  abstract?: any

  /**
   * 私有属性：是否为组件
   */
  _isComponent?: true

  /**
   * 私有属性：prop 键数组
   */
  _propKeys?: Array<string>

  /**
   * 私有属性：父虚拟节点
   */
  _parentVnode?: VNode

  /**
   * 私有属性：父监听器对象
   */
  _parentListeners?: object | null

  /**
   * 私有属性：渲染的子节点
   */
  _renderChildren?: Array<VNode> | null

  /**
   * 私有属性：组件标签
   */
  _componentTag: string | null

  /**
   * 私有属性：作用域 ID
   */
  _scopeId: string | null

  /**
   * 私有属性：组件基类
   */
  _base: typeof Component
}

/**
 * 用于描述 Vue 组件中 `props` 的选项配置。
 */
export type PropOptions = {
  /**
   * 属性的类型，可以是一个函数、函数数组或 null。
   */
  type?: Function | Array<Function> | null

  /**
   * 属性的默认值，可以是任意类型。
   */
  default?: any

  /**
   * 属性是否为必填项，可以是布尔值或 null。
   */
  required?: boolean | null

  /**
   * 属性的验证器函数，用于自定义验证逻辑，可以是函数或 null。
   */
  validator?: Function | null
}
