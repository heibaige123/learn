import { RefFlag } from '../src/v3/reactivity/ref'
import Dep, { DepTarget } from '../src/core/observer/dep'
import { GlobalAPI } from '../src/types/global-api'
import { VNode, VNodeData } from './vnode'
import { SetupContext } from './v3-setup-context'
import { WatcherOptions } from 'rollup'

/**
 * 基本类型的集合。
 */
declare type BaseTypes = string | number | boolean

/** 内置类型 (Builtin)，包括基础类型和一些常见的内置对象类型 */
declare type Builtin = Primitive | Function | Date | Error | RegExp

/**
 * 集合类型的集合。
 */
declare type CollectionTypes = IterableCollections | WeakCollections

/**
 * @internal
 */
/** 组件类，用于定义 Vue 组件的基本结构 */
declare class Component {
  /**
   * 构造函数，用于创建组件实例
   * @param options 组件的选项对象
   */
  constructor(options?: any)

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
  $slots: {
    [key: string]: Array<VNode>
  }
  /** 作用域插槽 */
  $scopedSlots: {
    [key: string]: () => VNode[] | undefined
  }
  /** 当前组件的虚拟节点 */
  $vnode: VNode
  /** 父组件传递的非 prop 属性 */
  $attrs: {
    [key: string]: string
  }
  /** 父组件绑定的事件监听器 */
  $listeners: Record<string, Function | Array<Function>>
  /** 是否为服务端渲染 */
  $isServer: boolean
  /**
   * 挂载组件
   * @param el 挂载的 DOM 元素或选择器
   * @param hydrating 是否为服务端渲染
   * @returns 组件实例
   */
  $mount: (
    el?: Element | string,
    hydrating?: boolean
  ) => Component & {
    [key: string]: any
  }
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
  _computedWatchers: {
    [key: string]: Watcher
  }
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
  /**
   * - 是否有钩子事件
   * - 用于优化生命周期钩子事件（如 `hook:mounted`）的触发效率。
   */
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
  ) => {
    [key: string]: Function
  }
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
}

/**
 * @internal
 */
/** 组件选项类型 */
declare type ComponentOptions = {
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
  methods?: {
    [key: string]: Function
  }
  /**
   * 侦听器定义
   */
  watch?: {
    [key: string]: Function | string
  }
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
  directives?: {
    [key: string]: object
  }
  /**
   * 子组件集合
   */
  components?: {
    [key: string]: Component
  }
  /**
   * 过渡效果集合
   */
  transitions?: {
    [key: string]: object
  }
  /**
   * 过滤器集合
   */
  filters?: {
    [key: string]: Function
  }
  /**
   * 提供依赖注入的对象或函数
   */
  provide?: Record<string | symbol, any> | (() => Record<string | symbol, any>)
  /**
   * 注入依赖的定义
   */
  inject?:
    | {
        [key: string]:
          | InjectKey
          | {
              from?: InjectKey
              default?: any
            }
      }
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
 * 创建一个计算属性（computed ref）。
 * 支持只读和可写两种形式。
 *
 * @overload@overload
 * @param getter 只读计算属性的 getter 函数
 * @param debugOptions 可选的调试选项
 * @returns ComputedRef<T> 只读计算属性
 *
 * @overload@overload
 * @param options 包含 get/set 的可写计算属性选项对象
 * @param debugOptions 可选的调试选项
 * @returns WritableComputedRef<T> 可写计算属性
 */
export declare function computed<T>(
  getter: ComputedGetter<T>,
  debugOptions?: DebuggerOptions
): ComputedRef<T>

export declare function computed<T>(
  options: WritableComputedOptions<T>,
  debugOptions?: DebuggerOptions
): WritableComputedRef<T>

/**
 * 计算属性 getter 的类型定义
 * 返回类型为 T，可以接收任意参数（通常不需要参数）
 */
export declare type ComputedGetter<T> = (...args: any[]) => T

/**
 * 只读计算属性的接口定义
 * @template T 计算属性的值类型
 * 继承自 WritableComputedRef，包含只读 value 属性和唯一标识符
 */
export declare interface ComputedRef<T = any> extends WritableComputedRef<T> {
  readonly value: T
  [ComputedRefSymbol]: true
}

/** 声明一个唯一的 symbol，用于标识 ComputedRef 类型 */
declare const ComputedRefSymbol: unique symbol

/**
 * 计算属性 setter 的类型定义
 * 接收一个类型为 T 的参数，无返回值
 */
export declare type ComputedSetter<T> = (v: T) => void

/* Excluded from this release type: Config */

/**
 * - 创建一个自定义的 `Ref` 对象。
 * - 允许开发者完全控制依赖追踪和触发更新的逻辑。
 * @param factory
 * @returns
 */
export declare function customRef<T>(factory: CustomRefFactory<T>): Ref<T>

/**
 * 用于创建自定义的 `Ref` 对象。
 * 通过 `customRef` 函数，
 * 开发者可以完全控制 `Ref` 的依赖追踪（`track`）和触发更新（`trigger`）的行为，从而实现更灵活的响应式逻辑。
 */
export declare type CustomRefFactory<T> = (
  /**
   * - 用于手动触发依赖追踪。
   * - 通常在 `get` 方法中调用，通知 Vue 的响应式系统当前 `Ref` 被访问。
   */
  track: () => void,
  /**
   * - 用于手动触发依赖更新。
   * - 通常在 `set` 方法中调用，通知 Vue 的响应式系统当前 `Ref` 的值发生了变化。
   */
  trigger: () => void
) => {
  get: () => T
  set: (value: T) => void
}

/**
 * - 定义调试事件的类型。
 * - 包含依赖收集或触发更新时的详细信息。
 */
export declare type DebuggerEvent = {
  /* Excluded from this release type: effect */
} & DebuggerEventExtraInfo

/**
 * - 定义调试事件的额外信息。
 * - 包含依赖收集或触发更新时的目标对象、操作类型、键值等信息。
 */
export declare type DebuggerEventExtraInfo = {
  /**
   * 表示触发事件的目标对象（响应式对象）。
   */
  target: object
  /**
   * 表示操作的类型。
   * - `TrackOpTypes`：依赖收集的操作类型（如读取属性）。
   * - `TriggerOpTypes`：触发更新的操作类型（如设置属性）。
   */
  type: TrackOpTypes | TriggerOpTypes
  /**
   * 表示触发事件的属性键。
   */
  key?: any
  /**
   * 表示触发更新时的新值（仅适用于写操作）。
   */
  newValue?: any
  /**
   * 表示触发更新时的旧值（仅适用于写操作）。
   */
  oldValue?: any
}

/**
 * 定义调试选项的接口。
 * 开发者可以通过实现 `onTrack` 和 `onTrigger` 回调函数，监听响应式系统的行为，帮助调试和分析数据变化。
 */
export declare interface DebuggerOptions {
  /**
   * 当依赖被追踪时的回调（仅开发环境）。
   * @param event
   * @returns
   */
  onTrack?: (event: DebuggerEvent) => void
  /**
   * 当 watcher 被触发时的回调（仅开发环境）。
   * @param event
   * @returns
   */
  onTrigger?: (event: DebuggerEvent) => void
}

/** 定义 DeepReadonly 类型工具 */
export declare type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends ReadonlyMap<infer K, infer V>
  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends WeakMap<infer K, infer V>
  ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends ReadonlySet<infer U>
  ? ReadonlySet<DeepReadonly<U>>
  : T extends WeakSet<infer U>
  ? WeakSet<DeepReadonly<U>>
  : T extends Promise<infer U>
  ? Promise<DeepReadonly<U>>
  : T extends Ref<infer U>
  ? Readonly<Ref<DeepReadonly<U>>>
  : T extends {}
  ? {
      readonly [K in keyof T]: DeepReadonly<T[K]>
    }
  : Readonly<T>

/* Excluded from this release type: defineAsyncComponent */

/* Excluded from this release type: defineComponent */

/**
 * Delete a property and trigger change if necessary.
 */
export declare function del<T>(array: T[], key: number): void

export declare function del(object: object, key: string | number): void

/* Excluded from this release type: Dep */

/* Excluded from this release type: DepTarget */

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
export declare class EffectScope {
  detached: boolean
  /**
   * 是否处于活动状态
   */
  active: boolean
  /**
   * 存储关联的 Watcher 实例
   */
  effects: Watcher[]
  /**
   * 存储清理函数
   */
  cleanups: (() => void)[]
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
  private index

  /**
   * 构造函数
   * @param detached 是否为分离作用域
   */
  constructor(detached?: boolean)

  /**
   * 运行传入的函数，并将当前作用域设置为活动状态
   * @param fn 要运行的函数
   */
  run<T>(fn: () => T): T | undefined

  /**
   * 激活当前作用域
   * 仅适用于非分离作用域
   */
  on(): void

  /**
   * 停用当前作用域
   * 仅适用于非分离作用域
   */
  off(): void

  /**
   * 停止当前作用域及其子作用域
   * @param fromParent 是否从父作用域调用
   */
  stop(fromParent?: boolean): void
}

/**
 * 创建一个新的 EffectScope 实例
 * @param detached 是否为分离作用域
 */
export declare function effectScope(detached?: boolean): EffectScope

/**
 * 定义组件的 errorCaptured 钩子类型。
 * 当子组件抛出错误时会触发该钩子。
 *
 * @template TError 捕获到的错误类型，默认为 unknown
 * @param err      捕获到的错误对象
 * @param instance 发生错误的组件实例
 * @param info     错误信息字符串，描述错误来源
 * @returns        返回 true/void。如果返回 false，错误会停止向上传播；否则会继续冒泡到父组件
 */
export declare type ErrorCapturedHook<TError = unknown> = (
  err: TError,
  instance: any,
  info: string
) => boolean | void

/* Excluded from this release type: getCurrentInstance */

/**
 * 获取当前活动的 EffectScope。
 *
 * @returns 当前的活动 EffectScope，如果没有活动的则返回 undefined。
 */
export declare function getCurrentScope(): EffectScope | undefined

/* Excluded from this release type: GlobalAPI */

/* Excluded from this release type: h */

/**
 * 判断类型 T 是否为 any 类型。
 * 如果 T 是 any 类型，则返回类型 Y；否则返回类型 N。
 *
 * @template T - 要检查的类型。
 * @template Y - 如果 T 是 any 类型，则返回的类型。
 * @template N - 如果 T 不是 any 类型，则返回的类型。
 */
declare type IfAny<T, Y, N> = 0 extends 1 & T ? Y : N

/**
 *  在当前组件中获取祖先组件通过 `provide` 提供的值。
 * @param key
 */
export declare function inject<T>(key: InjectionKey<T> | string): T | undefined

export declare function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T

export declare function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T

/**
 * 定义一个类型安全的注入键。
 */
export declare interface InjectionKey<T> extends Symbol {}

/**
 * 表示注入键的类型，可以是字符串或 Symbol。
 */
declare type InjectKey = string | Symbol

/**
 * 判断一个值是否是通过 Vue 的响应式系统创建的代理对象（`reactive` 或 `readonly`）。
 * 它是 Vue 3 中响应式系统的一部分，但在 Vue 2 的兼容性实现中也被引入。
 * @param value
 * @returns
 */
export declare function isProxy(value: unknown): boolean

/**
 * 判断对象是否是响应式的
 * @param value
 * @returns
 */
export declare function isReactive(value: unknown): boolean

/**
 * 判断对象是否是只读的
 * @param value
 * @returns
 */
export declare function isReadonly(value: unknown): boolean

/**
 * 判断一个值是否是 `Ref` 对象。
 * @param r
 */
export declare function isRef<T>(r: Ref<T> | unknown): r is Ref<T>

/**
 * 判断对象是否是浅层响应式的
 * @param value
 * @returns
 */
export declare function isShallow(value: unknown): boolean

/**
 * 可迭代的集合类型。
 */
declare type IterableCollections = Map<any, any> | Set<any>

/**
 * 用于映射多数据源的类型，Immediate 控制初始值是否允许 undefined
 */
declare type MapSources<T, Immediate> = {
  [K in keyof T]: T[K] extends WatchSource<infer V>
    ? Immediate extends true
      ? V | undefined
      : V
    : T[K] extends object
    ? Immediate extends true
      ? T[K] | undefined
      : T[K]
    : never
}

/**
 * 标记对象为跳过响应式处理
 * @param value
 * @returns
 */
export declare function markRaw<T extends object>(
  value: T
): T & {
  [RawSymbol]?: true
}

/**
 * 运行时辅助函数，用于合并 props 的默认值声明。
 * 仅供编译后的代码导入使用。
 *
 * @param raw      原始 props 声明，可以是字符串数组或 props 对象
 * @param defaults 默认值对象，key 为 prop 名，value 为默认值
 * @returns        合并后的 props 对象，每个 prop 都带有 default 属性
 */
export declare function mergeDefaults(
  raw: string[] | Record<string, PropOptions>,
  defaults: Record<string, any>
): Record<string, PropOptions>

/**
 * 多数据源类型。
 * 用于 watch 支持传入多个数据源（ref、getter、响应式对象等）的场景。
 */
declare type MultiWatchSources = (WatchSource<unknown> | object)[]

/**
 * 在下次 DOM 更新循环结束之后执行延迟回调
 */
export declare function nextTick(): Promise<void>

export declare function nextTick<T>(
  this: T,
  cb: (this: T, ...args: any[]) => any
): void

export declare function nextTick<T>(
  cb: (this: T, ...args: any[]) => any,
  ctx: T
): void

export declare const onActivated: (fn: () => void, target?: any) => void

export declare const onBeforeMount: (fn: () => void, target?: any) => void

export declare const onBeforeUnmount: (fn: () => void, target?: any) => void

export declare const onBeforeUpdate: (fn: () => void, target?: any) => void

/**
 * onCleanup 的类型定义，参数为清理函数
 */
declare type OnCleanup = (cleanupFn: () => void) => void

export declare const onDeactivated: (fn: () => void, target?: any) => void

/**
 * 用于在组件中注册 errorCaptured 钩子函数，实现对子组件错误的捕获和处理。
 *
 * @template TError 捕获到的错误类型，默认为 Error
 * @param hook   用户自定义的错误捕获回调函数（ErrorCapturedHook）
 *               - 参数1：err 捕获到的错误对象
 *               - 参数2：instance 发生错误的组件实例
 *               - 参数3：info 错误信息字符串
 *               - 返回值：boolean | void，返回 false 可阻止错误继续冒泡
 * @param target 指定注册钩子的组件实例，默认是当前激活的组件实例（currentInstance）
 */
export declare function onErrorCaptured<TError = Error>(
  hook: ErrorCapturedHook<TError>,
  target?: any
): void

export declare const onMounted: (fn: () => void, target?: any) => void

/**
 * 在依赖被跟踪时触发（调试用）
 */
export declare const onRenderTracked: (
  fn: (e: DebuggerEvent) => any,
  target?: any
) => void

/**
 * 在依赖被触发更新时触发（调试用）
 */
export declare const onRenderTriggered: (
  fn: (e: DebuggerEvent) => any,
  target?: any
) => void

/**
 * 注册一个回调函数，当当前活动的 effect scope 被销毁时调用。
 *
 * @param fn 要在 effect scope 销毁时调用的回调函数。
 *
 * 如果当前没有活动的 effect scope，并且处于开发环境下，会发出警告。
 */
export declare function onScopeDispose(fn: () => void): void

export declare const onServerPrefetch: (fn: () => void, target?: any) => void

export declare const onUnmounted: (fn: () => void, target?: any) => void

export declare const onUpdated: (fn: () => void, target?: any) => void

/** 基础类型 (Primitive)，包括所有原始类型 */
declare type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null

/**
 * 用于描述 Vue 组件中 `props` 的选项配置。
 */
declare type PropOptions = {
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

/**
 * 在当前组件中提供一个值，供后代组件通过 `inject` 获取。
 * 数据通过键值对的形式存储，键可以是字符串、数字或 `InjectionKey`。
 * @param key
 * @param value
 */
export declare function provide<T>(
  key: InjectionKey<T> | string | number,
  value: T
): void

/**
 * 简化对包含 `Ref` 的对象的操作。
 * 它通过代理（`Proxy` 或 `Object.defineProperty`）的方式，
 * 将对象中的 `Ref` 自动解包（unwrap），
 * 使得开发者可以像操作普通属性一样操作 `Ref`，而无需显式地访问 `.value`。
 * @param objectWithRefs
 * @returns
 */
export declare function proxyRefs<T extends object>(
  objectWithRefs: T
): ShallowUnwrapRef<T>

/**
 * - 用于标记原始（非响应式）对象。
 * - 通常与 `markRaw` 函数配合使用，用于标记对象跳过响应式处理。
 */
declare const RawSymbol: unique symbol

/**
 * 将一个普通对象转换为深度响应式对象。
 * @param target
 */
export declare function reactive<T extends object>(
  target: T
): UnwrapNestedRefs<T>

/**
 * 定义响应式对象的内部标志，用于标记对象的响应式状态。
 */
export declare const enum ReactiveFlags {
  /**
   * 标记对象应跳过响应式转换。
   */
  SKIP = '__v_skip',
  /**
   * 标记对象是否是只读的。
   */
  IS_READONLY = '__v_isReadonly',
  /**
   * 标记对象是否是浅层响应式的。
   */
  IS_SHALLOW = '__v_isShallow',
  /**
   * 存储原始对象的引用。
   */
  RAW = '__v_raw'
}

/**
 * 创建一个对象的深层只读（deep readonly）代理。
 * 该代理会递归地将目标对象及其所有嵌套属性都变为只读，禁止任何修改操作。
 *
 * @param target 需要被转换为只读的原始对象（只能是对象类型，不能是原始类型）。
 * @returns 返回目标对象的深层只读代理，类型为 DeepReadonly<UnwrapNestedRefs<T>>。
 *          - DeepReadonly：递归地将所有属性变为只读。
 *          - UnwrapNestedRefs：会自动解包对象内部的 Ref 类型（如果有）。
 */
export declare function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>>

/**
 * 用于包装一个值，使其成为响应式数据。
 */
export declare interface Ref<T = any> {
  /**
   * - 包含被包装的值。
   * - 通过 `.value` 访问或修改响应式数据。
   */
  value: T
  /**
   * Type differentiator only.
   * We need this to be in public d.ts but don't want it to show up in IDE
   * autocomplete, so we use a private Symbol instead.
   */
  /**
   * 用于类型区分，标记该对象是一个 `Ref`。
   */
  [RefSymbol]: true
  /**
   * @internal
   */
  /**
   * 内部依赖管理器，用于追踪和通知依赖。
   */
  dep?: Dep
  /**
   * @internal
   */
  /**
   * 标志该对象是一个 `Ref`。
   */
  [RefFlag]: true
}

/**
 * 创建一个响应式的 `Ref` 对象。
 * @param value
 */
export declare function ref<T extends Ref>(value: T): T

export declare function ref<T>(value: T): Ref<UnwrapRef<T>>

export declare function ref<T = any>(): Ref<T | undefined>

/* Excluded from this release type: RefFlag */

/**
 * 用于区分 `Ref` 对象和普通对象。
 */
declare const RefSymbol: unique symbol

/**
 * 一个特殊的接口，用于声明在解包 `Ref` 类型时应该跳过的类型。
 * 允许其他模块（如 `@vue/runtime-dom`）扩展此接口，声明特定类型在解包 `Ref` 时不应该被处理。
 *
 * This is a special exported interface for other packages to declare
 * additional types that should bail out for ref unwrapping. For example
 * \@vue/runtime-dom can declare it like so in its d.ts:
 *
 * ``` ts
 * declare module 'vue' {
 *   export interface RefUnwrapBailTypes {
 *     runtimeDOMBailTypes: Node | Window
 *   }
 * }
 * ```
 *
 * Note that api-extractor somehow refuses to include `declare module`
 * augmentations in its generated d.ts, so we have to manually append them
 * to the final generated d.ts in our build process.
 */
export declare interface RefUnwrapBailTypes {
  runtimeDOMBailTypes: Node | Window
}

/**
 * 作用域插槽数据类型
 * 可以是一个数组，数组中的元素可以是包含键值对的对象或嵌套的 ScopedSlotsData
 */
declare type ScopedSlotsData = Array<
  | {
      /** 插槽的键 */
      key: string
      /** 插槽的渲染函数 */
      fn: Function
    }
  | ScopedSlotsData
>

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export declare function set<T>(array: T[], key: number, value: T): T

export declare function set<T>(
  object: object,
  key: string | number,
  value: T
): T

/* Excluded from this release type: SetupContext */

/**
 * 用于标记对象 `T` 为浅层响应式对象。
 */
export declare type ShallowReactive<T> = T & {
  [ShallowReactiveMarker]?: true
}

/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
/**
 * 将一个普通对象转换为浅层响应式对象。
 * @param target
 * @returns
 */
export declare function shallowReactive<T extends object>(
  target: T
): ShallowReactive<T>

/**
 * 用于在类型系统中标识浅层响应式对象。
 */
declare const ShallowReactiveMarker: unique symbol

/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
/**
 * 返回一个原始对象的浅只读（shallow readonly）代理副本。
 * 该代理对象只有**根属性**是只读的，嵌套的对象属性仍然是可变的。
 * 此函数不会解包 ref，也不会递归地将属性转换为只读。
 * 主要用于为有状态组件创建 props 代理对象。
 *
 * @param target 需要被转换为浅只读的原始对象（只能是对象类型，不能是原始类型）。
 * @returns 返回目标对象的浅只读代理，类型为 Readonly<T>（只对第一层属性加 readonly）。
 */
export declare function shallowReadonly<T extends object>(
  target: T
): Readonly<T>

/**
 * 继承了 `Ref` 的所有特性，并通过 `ShallowRefMarker` 标记为浅层响应式。
 */
export declare type ShallowRef<T = any> = Ref<T> & {
  [ShallowRefMarker]?: true
}

/**
 * 创建一个浅层响应式的 `Ref` 对象。
 * @param value
 */
export declare function shallowRef<T>(value: T | Ref<T>): Ref<T> | ShallowRef<T>

export declare function shallowRef<T extends Ref>(value: T): T

export declare function shallowRef<T>(value: T): ShallowRef<T>

export declare function shallowRef<T = any>(): ShallowRef<T | undefined>

/**
 * 类型系统中的标志，用于区分浅层响应式的 `Ref` 和普通的 `Ref`。
 */
declare const ShallowRefMarker: unique symbol

/**
 * - 用于浅层解包 `Ref` 类型的工具类型。
 * - 如果对象的某个属性是 `Ref`，则解包为其内部值；否则保持原样。
 */
export declare type ShallowUnwrapRef<T> = {
  [K in keyof T]: T[K] extends Ref<infer V>
    ? V
    : T[K] extends Ref<infer V> | undefined
    ? unknown extends V
      ? undefined
      : V | undefined
    : T[K]
}

/**
 * 一个简单的 Set 接口，用于存储和操作唯一值。
 */
declare interface SimpleSet {
  /**
   * 检测 Set 中是否包含指定的键。
   *
   * @param key - 要检测的键。
   * @returns 如果包含，则返回 `true`；否则返回 `false`。
   */
  has(key: string | number): boolean

  /**
   * 向 Set 中添加一个键。
   *
   * @param key - 要添加的键。
   */
  add(key: string | number): any

  /**
   * 清空 Set 中的所有键。
   */
  clear(): void
}

/**
 * 获取对象的原始版本
 * @param observed
 * @returns
 */
export declare function toRaw<T>(observed: T): T

export declare type ToRef<T> = IfAny<T, Ref<T>, [T] extends [Ref] ? T : Ref<T>>

/**
 * 将对象的某个属性转换为 `Ref`。
 * @param object
 * @param key
 */
export declare function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K
): ToRef<T[K]>

export declare function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K]
): ToRef<Exclude<T[K], undefined>>

export declare type ToRefs<T = any> = {
  [K in keyof T]: ToRef<T[K]>
}

/**
 * 将对象的所有属性转换为 `Ref`。
 * @param object
 * @returns
 */
export declare function toRefs<T extends object>(object: T): ToRefs<T>

/**
 * 表示依赖追踪操作类型
 */
export declare const enum TrackOpTypes {
  /**
   * 获取操作
   */
  GET = 'get',
  /**
   * 触碰操作
   */
  TOUCH = 'touch'
}

/**
 * 表示触发操作类型
 */
export declare const enum TriggerOpTypes {
  /**
   * 设置操作
   */
  SET = 'set',
  /**
   * 添加操作
   */
  ADD = 'add',
  /**
   * 删除操作
   */
  DELETE = 'delete',
  /**
   * 数组变更操作
   */
  ARRAY_MUTATION = 'array mutation'
}

/**
 * 手动触发对 `Ref` 的依赖更新。
 * @param ref
 */
export declare function triggerRef(ref: Ref): void

/**
 * 简化对 `Ref` 和普通值的处理逻辑。
 * @param ref
 * @returns
 */
export declare function unref<T>(ref: T | Ref<T>): T

/**
 * 解包（unwrap）嵌套的 `Ref` 类型，使得开发者可以更方便地操作响应式数据。
 */
export declare type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRefSimple<T>

/**
 * - 用于递归解包 `Ref` 类型的工具类型。
 * - 与 `ShallowUnwrapRef` 不同，`UnwrapRef` 会递归解包嵌套的 `Ref`。
 */
export declare type UnwrapRef<T> = T extends ShallowRef<infer V>
  ? V
  : T extends Ref<infer V>
  ? UnwrapRefSimple<V>
  : UnwrapRefSimple<T>

/**
 * 用于递归解包非 `Ref` 类型的嵌套结构。
 */
declare type UnwrapRefSimple<T> = T extends
  | Function
  | CollectionTypes
  | BaseTypes
  | Ref
  | RefUnwrapBailTypes[keyof RefUnwrapBailTypes]
  | {
      [RawSymbol]?: true
    }
  ? T
  : T extends Array<any>
  ? {
      [K in keyof T]: UnwrapRefSimple<T[K]>
    }
  : T extends object & {
      [ShallowReactiveMarker]?: never
    }
  ? {
      [P in keyof T]: P extends symbol ? T[P] : UnwrapRef<T[P]>
    }
  : T

/* Excluded from this release type: useAttrs */

/**
 * 在组件的 setup 函数中获取 CSS Modules 对象。
 *
 * @param {string} [name='$style'] - CSS Modules 在组件实例上注入的名称。
 *                                  在 <style module> 或 <style module="customName"> 中定义。
 *                                  默认为 '$style'。
 *
 * @returns {Record<string, string>} - CSS Modules 对象，其中键是原始类名，值是编译后的、带作用域的类名。
 *                                    如果在 setup() 之外调用、找不到指定名称的模块或在全局构建中，则返回一个空对象。
 */
export declare function useCssModule(name?: string): Record<string, string>

/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
/**
 * SFC (单文件组件) CSS 变量注入功能的运行时辅助函数。
 * 这个函数主要由 Vue 编译器在处理 <style vars> 语法时在生成的渲染函数代码中调用。
 * 函数逻辑 (Function Logic):
 * @private
 * @param getter - 一个函数，用于从组件实例和 setup 代理中计算出需要注入的 CSS 变量。
 *                 - 参数 (getter's Parameters):
 *                     - vm: Record<string, any> - 当前组件实例的公共属性 (类似于 `this` 在选项式 API 中的访问)。
 *                     - setupProxy: Record<string, any> - setup 函数返回的响应式对象代理。
 *                 - 返回值 (getter's Return Value): Record<string, string> - 一个对象，键是 CSS 变量名 (不带 '--')，值是对应的 CSS 变量值。
 */
export declare function useCssVars(
  getter: (
    vm: Record<string, any>,
    setupProxy: Record<string, any>
  ) => Record<string, string>
): void

/* Excluded from this release type: useListeners */

/* Excluded from this release type: useSlots */

/**
 * 一个占位符，会在构建过程中通过工具（如 Webpack、Rollup 或 Vite）替换为实际的版本号字符串，例如 `1.0.0`。
 */
export declare const version: string

/* Excluded from this release type: VNode */

/**
 * @internal
 */
/**
 * VNode 的子节点类型
 * 可以是以下几种类型的组合：
 * - 一个数组，数组中的元素可以是 null、VNode、字符串、数字或嵌套的 VNodeChildren
 * - 一个字符串
 */
declare type VNodeChildren =
  | Array<null | VNode | string | number | VNodeChildren>
  | string

/**
 * 组件选项类型
 * 包括组件构造函数、属性数据、事件监听器、子节点和标签
 */
declare type VNodeComponentOptions = {
  /** 组件构造函数 */
  Ctor: typeof Component
  /** 属性数据 */
  propsData?: Object
  /** 事件监听器 */
  listeners?: Record<string, Function | Function[]>
  /** 子节点 */
  children?: Array<VNode>
  /** 标签 */
  tag?: string
}

/* Excluded from this release type: VNodeData */

/* Excluded from this release type: VNodeDirective */

export declare function watch<
  T extends MultiWatchSources,
  Immediate extends Readonly<boolean> = false
>(
  sources: [...T],
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

export declare function watch<
  T extends Readonly<MultiWatchSources>,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<MapSources<T, false>, MapSources<T, Immediate>>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

export declare function watch<T, Immediate extends Readonly<boolean> = false>(
  source: WatchSource<T>,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

export declare function watch<
  T extends object,
  Immediate extends Readonly<boolean> = false
>(
  source: T,
  cb: WatchCallback<T, Immediate extends true ? T | undefined : T>,
  options?: WatchOptions<Immediate>
): WatchStopHandle

/**
 * watch 的回调类型，value 为新值，oldValue 为旧值，onCleanup 用于注册清理函数
 */
export declare type WatchCallback<V = any, OV = any> = (
  value: V,
  oldValue: OV,
  onCleanup: OnCleanup
) => any

/**
 * watchEffect 的回调类型，参数为 onCleanup 注册清理函数
 */
export declare type WatchEffect = (onCleanup: OnCleanup) => void

/**
 * watchEffect：简单副作用监听，无需指定数据源。
 * 当依赖的响应式数据发生变化时，effect 会自动重新执行。
 *
 * @param effect  副作用函数，参数为 onCleanup，用于注册清理逻辑
 * @param options 监听选项（可选），如 flush 时机等
 * @returns       返回一个停止监听的函数（WatchStopHandle）
 */
export declare function watchEffect(
  effect: WatchEffect,
  options?: WatchOptionsBase
): WatchStopHandle

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
declare class Watcher implements DepTarget {
  /** 所属组件实例 */
  vm?: Component | null
  /** 表达式字符串，主要用于调试 */
  expression: string
  /** 回调函数，值变化时调用 */
  cb: Function
  /** 唯一标识符，用于排序和去重 */
  id: number
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
  /** 是否活跃 */
  active: boolean
  /** 是否为后置watcher */
  post: boolean
  /** 当前依赖集合 */
  deps: Array<Dep>
  /** 新一轮依赖收集的依赖集合 */
  newDeps: Array<Dep>
  /** deps的id集合，用于快速查找 */
  depIds: SimpleSet
  /** newDeps的id集合 */
  newDepIds: SimpleSet
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
  /** 依赖收集/触发时的调试钩子 */
  onTrack?: ((event: DebuggerEvent) => void) | undefined
  onTrigger?: ((event: DebuggerEvent) => void) | undefined

  constructor(
    vm: Component | null,
    expOrFn: string | (() => any),
    cb: Function,
    options?: WatcherOptions | null,
    isRenderWatcher?: boolean
  )

  /**
   * 依赖收集核心
   */
  get(): any

  /**
   * 添加依赖
   */
  addDep(dep: Dep): void

  /**
   * 清理依赖
   */
  cleanupDeps(): void

  /**
   * 响应变化
   */
  update(): void

  /**
   * 执行更新
   */
  run(): void

  /**
   * 惰性求值（用于计算属性）
   */
  evaluate(): void

  /**
   * 让当前活跃的 watcher 也收集此 watcher 所依赖的所有依赖
   */
  depend(): void

  /**
   * 完全销毁一个 watcher，清理其所有依赖关系，防止内存泄漏。
   */
  teardown(): void
}

/* Excluded from this release type: WatcherOptions */

/**
 * watch 选项类型，支持 immediate、deep 等
 */
export declare interface WatchOptions<Immediate = boolean>
  extends WatchOptionsBase {
  immediate?: Immediate
  deep?: boolean
}

/**
 * watch 选项的基础类型，支持 flush、调试等
 */
export declare interface WatchOptionsBase extends DebuggerOptions {
  flush?: 'pre' | 'post' | 'sync'
}

/**
 * watchPostEffect：副作用在组件更新后（DOM 更新后）执行。
 * 适用于需要在 DOM 更新后访问页面的场景。
 *
 * @param effect  副作用函数，参数为 onCleanup，用于注册清理逻辑
 * @param options 调试选项（可选）
 * @returns       返回一个停止监听的函数（WatchStopHandle）
 */
export declare function watchPostEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
): WatchStopHandle

/**
 * watch 的数据源类型，可以是 Ref、ComputedRef 或 getter 函数
 */
export declare type WatchSource<T = any> = Ref<T> | ComputedRef<T> | (() => T)

/**
 * 停止 watch 的函数类型
 */
export declare type WatchStopHandle = () => void

/**
 * watchSyncEffect：副作用同步执行。
 * 当依赖的响应式数据发生变化时，effect 会立即（同步）执行，而不是等到下一个事件循环或组件更新后。
 *
 * @param effect   副作用函数，参数为 onCleanup，用于注册清理逻辑
 * @param options  调试选项（可选）
 * @returns        返回一个停止监听的函数（WatchStopHandle）
 */
export declare function watchSyncEffect(
  effect: WatchEffect,
  options?: DebuggerOptions
): WatchStopHandle

/**
 * 弱引用的集合类型。
 */
declare type WeakCollections = WeakMap<any, any> | WeakSet<any>

/**
 * 可写计算属性的选项对象类型
 * 包含 get 和 set 两个函数
 */
export declare interface WritableComputedOptions<T> {
  get: ComputedGetter<T>
  set: ComputedSetter<T>
}

/**
 * 可写计算属性的接口定义
 * @template T 计算属性的值类型
 * 继承自 Ref<T>，并包含 effect 属性（通常是 Watcher 实例）
 */
export declare interface WritableComputedRef<T> extends Ref<T> {
  readonly effect: any
}

export {}
