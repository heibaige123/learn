import type VNode from 'core/vdom/vnode'
import type Watcher from 'core/observer/watcher'
import { ComponentOptions } from './options'
import { SetupContext } from 'v3/apiSetup'
import { ScopedSlotsData, VNodeChildren, VNodeData } from './vnode'
import { GlobalAPI } from './global-api'
import { EffectScope } from 'v3/reactivity/effectScope'

// TODO this should be using the same as /component/

/**
 * @internal
 */
/** 组件类，用于定义 Vue 组件的基本结构 */
export declare class Component {
  /**
   * 构造函数，用于创建组件实例
   * @param options 组件的选项对象
   */
  constructor(options?: any)

  // 静态属性
  /** 组件的唯一标识符 */
  static cid: number

  /** 组件的选项 */
  static options: Record<string, any>

  /** 用于扩展组件 */
  static extend: GlobalAPI['extend']

  /** 父组件的选项 */
  static superOptions: Record<string, any>

  /** 扩展的选项 */
  static extendOptions: Record<string, any>

  /** 密封的选项 */
  static sealedOptions: Record<string, any>

  /** 父组件的引用 */
  static super: typeof Component

  /** 注册指令 */
  static directive: GlobalAPI['directive']

  /** 注册组件 */
  static component: GlobalAPI['component']

  /** 注册过滤器 */
  static filter: GlobalAPI['filter']

  /** 函数式渲染上下文构造器 */
  static FunctionalRenderContext: Function

  /** 混入方法 */
  static mixin: GlobalAPI['mixin']

  /** 插件注册方法 */
  static use: GlobalAPI['use']

  // 公共属性
  /** 组件的根 DOM 元素 */
  $el: any

  /** 组件的数据对象 */
  $data: Record<string, any>

  /** 组件的属性对象 */
  $props: Record<string, any>

  /** 组件的选项 */
  $options: ComponentOptions

  /** 父组件的引用 */
  $parent: Component | undefined

  /** 根组件的引用 */
  $root: Component

  /** 子组件的数组 */
  $children: Array<Component>

  /** 引用的 DOM 或组件 */
  $refs: {
    [key: string]: Component | Element | Array<Component | Element> | undefined
  }

  /** 插槽内容 */
  $slots: { [key: string]: Array<VNode> }

  /** 作用域插槽 */
  $scopedSlots: { [key: string]: () => VNode[] | undefined }

  /** 当前组件的虚拟节点 */
  $vnode: VNode

  /** 父组件传递的非 prop 属性 */
  $attrs: { [key: string]: string }

  /** 父组件绑定的事件监听器 */
  $listeners: Record<string, Function | Array<Function>>

  /** 是否为服务端渲染 */
  $isServer: boolean

  // 公共方法
  /**
   * 挂载组件
   * @param el 挂载的 DOM 元素或选择器
   * @param hydrating 是否为服务端渲染
   * @returns 组件实例
   */
  $mount: (
    el?: Element | string,
    hydrating?: boolean
  ) => Component & { [key: string]: any }

  /** 强制更新组件 */
  $forceUpdate: () => void

  /** 销毁组件 */
  $destroy: () => void

  /**
   * 设置响应式数据
   * @param target 数据对象或数组
   * @param key 数据的键
   * @param val 数据的值
   * @returns 设置的值
   */
  $set: <T>(
    target: Record<string, any> | Array<T>,
    key: string | number,
    val: T
  ) => T

  /**
   * 删除响应式数据
   * @param target 数据对象或数组
   * @param key 数据的键
   */
  $delete: <T>(
    target: Record<string, any> | Array<T>,
    key: string | number
  ) => void

  /**
   * 监听数据变化
   * @param expOrFn 数据表达式或函数
   * @param cb 回调函数
   * @param options 监听选项
   * @returns 取消监听的函数
   */
  $watch: (
    expOrFn: string | (() => any),
    cb: Function,
    options?: Record<string, any>
  ) => Function

  /**
   * 监听事件
   * @param event 事件名称或事件数组
   * @param fn 回调函数
   * @returns 组件实例
   */
  $on: (event: string | Array<string>, fn: Function) => Component

  /**
   * 监听一次性事件
   * @param event 事件名称
   * @param fn 回调函数
   * @returns 组件实例
   */
  $once: (event: string, fn: Function) => Component

  /**
   * 取消事件监听
   * @param event 事件名称或事件数组
   * @param fn 回调函数
   * @returns 组件实例
   */
  $off: (event?: string | Array<string>, fn?: Function) => Component

  /**
   * 触发事件
   * @param event 事件名称
   * @param args 事件参数
   * @returns 组件实例
   */
  $emit: (event: string, ...args: Array<any>) => Component

  /**
   * 下一次 DOM 更新后执行回调
   * @param fn 回调函数
   * @returns Promise 或 void
   */
  $nextTick: (fn: (...args: any[]) => any) => void | Promise<any>

  /**
   * 创建虚拟节点
   * @param tag 标签或组件
   * @param data 节点数据
   * @param children 子节点
   * @returns 虚拟节点
   */
  $createElement: (
    tag?: string | Component,
    data?: Record<string, any>,
    children?: VNodeChildren
  ) => VNode

  // 私有属性
  /** 组件的唯一 ID */
  _uid: number | string

  /** 组件的名称（仅在开发模式下存在） */
  _name: string

  /** 标识是否为 Vue 实例 */
  _isVue: true

  /** 跳过响应式标记 */
  __v_skip: true

  /** 组件自身的引用 */
  _self: Component

  /** 渲染代理 */
  _renderProxy: Component

  /** 渲染上下文 */
  _renderContext?: Component

  /** 组件的观察者 */
  _watcher: Watcher | null

  /** 组件的作用域 */
  _scope: EffectScope

  /** 计算属性的观察者 */
  _computedWatchers: { [key: string]: Watcher }

  /** 组件的数据对象 */
  _data: Record<string, any>

  /** 组件的属性对象 */
  _props: Record<string, any>

  /** 组件的事件对象 */
  _events: Record<string, any>

  /** 是否处于非活动状态 */
  _inactive: boolean | null

  /** 是否直接非活动 */
  _directInactive: boolean

  /** 是否已挂载 */
  _isMounted: boolean

  /** 是否已销毁 */
  _isDestroyed: boolean

  /** 是否正在销毁 */
  _isBeingDestroyed: boolean

  /** 组件的虚拟节点 */
  _vnode?: VNode | null

  /** 缓存的静态树 */
  _staticTrees?: Array<VNode> | null

  /** 是否有钩子事件 */
  _hasHookEvent: boolean

  /** 提供给子组件的数据 */
  _provided: Record<string, any>

  /** 组件的 setup 状态 */
  _setupState?: Record<string, any>

  /** setup 的代理对象 */
  _setupProxy?: Record<string, any>

  /** setup 的上下文 */
  _setupContext?: SetupContext

  /** 属性的代理对象 */
  _attrsProxy?: Record<string, any>

  /** 监听器的代理对象 */
  _listenersProxy?: Record<string, Function | Function[]>

  /** 插槽的代理对象 */
  _slotsProxy?: Record<string, () => VNode[]>

  /** 预定义的观察者 */
  _preWatchers?: Watcher[]

  // 私有方法
  /** 初始化组件 */
  _init: Function

  /**
   * 挂载组件
   * @param el 挂载的 DOM 元素
   * @param hydrating 是否为服务端渲染
   * @returns 组件实例
   */
  _mount: (el?: Element | void, hydrating?: boolean) => Component

  /**
   * 更新组件
   * @param vnode 虚拟节点
   * @param hydrating 是否为服务端渲染
   */
  _update: (vnode: VNode, hydrating?: boolean) => void

  /**
   * 渲染组件
   * @returns 虚拟节点
   */
  _render: () => VNode

  /**
   * 打补丁
   * @param a 旧的虚拟节点或 DOM 元素
   * @param b 新的虚拟节点
   * @param hydrating 是否为服务端渲染
   * @param removeOnly 是否仅移除
   * @param parentElm 父元素
   * @param refElm 参考元素
   * @returns 打补丁的结果
   */
  __patch__: (
    a: Element | VNode | void | null,
    b: VNode | null,
    hydrating?: boolean,
    removeOnly?: boolean,
    parentElm?: any,
    refElm?: any
  ) => any

  // 渲染相关方法
  /**
   * 创建虚拟节点
   * @param vnode 虚拟节点
   * @param data 节点数据
   * @param children 子节点
   * @param normalizationType 标准化类型
   * @returns 虚拟节点或 void
   */
  _c: (
    vnode?: VNode,
    data?: VNodeData,
    children?: VNodeChildren,
    normalizationType?: number
  ) => VNode | void

  /**
   * 渲染静态节点
   * @param index 静态节点的索引
   * @param isInFor 是否在 v-for 中
   * @returns 虚拟节点或子节点
   */
  _m: (index: number, isInFor?: boolean) => VNode | VNodeChildren

  /**
   * 标记一次性节点
   * @param vnode 虚拟节点或节点数组
   * @param index 索引
   * @param key 键值
   * @returns 虚拟节点或子节点
   */
  _o: (
    vnode: VNode | Array<VNode>,
    index: number,
    key: string
  ) => VNode | VNodeChildren

  /**
   * 转换为字符串
   * @param value 值
   * @returns 字符串
   */
  _s: (value: any) => string

  /**
   * 创建文本节点
   * @param value 文本值
   * @returns 虚拟节点
   */
  _v: (value: string | number) => VNode

  /**
   * 转换为数字
   * @param value 字符串值
   * @returns 数字或字符串
   */
  _n: (value: string) => number | string

  /**
   * 创建空节点
   * @returns 虚拟节点
   */
  _e: () => VNode

  /**
   * 判断是否相等
   * @param a 值 a
   * @param b 值 b
   * @returns 是否相等
   */
  _q: (a: any, b: any) => boolean

  /**
   * 查找值的索引
   * @param arr 数组
   * @param val 值
   * @returns 索引
   */
  _i: (arr: Array<any>, val: any) => number

  /**
   * 解析过滤器
   * @param id 过滤器 ID
   * @returns 过滤器函数
   */
  _f: (id: string) => Function

  /**
   * 渲染列表
   * @param val 列表值
   * @param render 渲染函数
   * @returns 虚拟节点数组或 null
   */
  _l: (val: any, render: Function) => Array<VNode> | null

  /**
   * 渲染插槽
   * @param name 插槽名称
   * @param fallback 回退内容
   * @param props 插槽属性
   * @returns 虚拟节点数组或 null
   */
  _t: (
    name: string,
    fallback?: Array<VNode>,
    props?: Record<string, any>
  ) => Array<VNode> | null

  /**
   * 应用 v-bind 对象
   * @param data 节点数据
   * @param tag 标签
   * @param value 值
   * @param asProp 是否作为属性
   * @param isSync 是否同步
   * @returns 节点数据
   */
  _b: (
    data: any,
    tag: string,
    value: any,
    asProp: boolean,
    isSync?: boolean
  ) => VNodeData

  /**
   * 应用 v-on 对象
   * @param data 节点数据
   * @param value 值
   * @returns 节点数据
   */
  _g: (data: any, value: any) => VNodeData

  /**
   * 检查自定义键码
   * @param eventKeyCode 事件键码
   * @param key 键值
   * @param builtInAlias 内置别名
   * @param eventKeyName 事件键名
   * @returns 是否匹配
   */
  _k: (
    eventKeyCode: number,
    key: string,
    builtInAlias?: number | Array<number>,
    eventKeyName?: string
  ) => boolean | null

  /**
   * 解析作用域插槽
   * @param scopedSlots 作用域插槽数据
   * @param res 结果对象
   * @returns 插槽函数对象
   */
  _u: (
    scopedSlots: ScopedSlotsData,
    res?: Record<string, any>
  ) => { [key: string]: Function }

  // 服务端渲染相关方法
  /** 服务端渲染节点 */
  _ssrNode: Function

  /** 服务端渲染列表 */
  _ssrList: Function

  /** 服务端渲染转义 */
  _ssrEscape: Function

  /** 服务端渲染属性 */
  _ssrAttr: Function

  /** 服务端渲染属性集合 */
  _ssrAttrs: Function

  /** 服务端渲染 DOM 属性 */
  _ssrDOMProps: Function

  /** 服务端渲染类名 */
  _ssrClass: Function

  /** 服务端渲染样式 */
  _ssrStyle: Function

  // allow dynamic method registration
  // [key: string]: any
}
