import VNode from 'core/vdom/vnode'
import { Ref } from 'v3'
import { Component } from './component'
import { ASTModifiers } from './compiler'

/**
 * @internal
 */
/**
 * VNode 的子节点类型
 * 可以是以下几种类型的组合：
 * - 一个数组，数组中的元素可以是 null、VNode、字符串、数字或嵌套的 VNodeChildren
 * - 一个字符串
 */
export type VNodeChildren =
  | Array<null | VNode | string | number | VNodeChildren>
  | string

/**
 * 组件选项类型
 * 包括组件构造函数、属性数据、事件监听器、子节点和标签
 */
export type VNodeComponentOptions = {
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

/**
 * 已挂载的组件 VNode 类型
 * 包含上下文、组件选项、组件实例、父节点和数据
 */
export type MountedComponentVNode = VNode & {
  /** 上下文组件实例 */
  context: Component
  /** 组件选项 */
  componentOptions: VNodeComponentOptions
  /** 组件实例 */
  componentInstance: Component
  /** 父节点 */
  parent: VNode
  /** 节点数据 */
  data: VNodeData
}

/**
 * @internal
 *
 * 一个扩展了基础 VNode 的类型，包含了与虚拟 DOM 节点相关的详细数据。
 * 通常用于 Vue 的内部实现中，表示带有数据的虚拟节点
 */
// interface for vnodes in update modules
export type VNodeWithData = VNode & {
  /** 节点标签 */
  tag: string
  /** 节点数据 */
  data: VNodeData
  /** 子节点数组 */
  children: Array<VNode>
  /** 文本内容，始终为 void */
  text: void
  /** 对应的真实 DOM 节点引用。 */
  elm: any
  /** 命名空间 */
  ns: string | void
  /** 上下文组件实例 */
  context: Component
  /** 节点的唯一标识 */
  key: string | number | undefined
  /** 父节点 */
  parent?: VNodeWithData
  /** 存储组件的选项信息。 */
  componentOptions?: VNodeComponentOptions
  /** 组件实例 */
  componentInstance?: Component
  /** 是否为根插入 */
  isRootInsert: boolean
}

// // interface for vnodes in update modules
// export type VNodeWithData = {
//   tag: string;
//   data: VNodeData;
//   children: Array<VNode>;
//   text: void;
//   elm: any;
//   ns: string | void;
//   context: Component;
//   key: string | number | undefined;
//   parent?: VNodeWithData;
//   componentOptions?: VNodeComponentOptions;
//   componentInstance?: Component;
//   isRootInsert: boolean;
// };

/**
 * @internal
 *
 * 用于描述 Vue 虚拟 DOM 节点 (VNode) 的数据结构。
 * 它包含了与虚拟节点相关的各种属性和配置，
 * 主要用于在虚拟 DOM 渲染和更新过程中传递节点的详细信息
 */
export interface VNodeData {
  /** 唯一标识符，用于区分不同的虚拟节点 */
  key?: string | number

  /** 插槽名称，用于指定该节点属于哪个插槽 */
  slot?: string

  /** 引用标识符或回调函数，用于获取组件或 DOM 元素的引用 */
  ref?: string | Ref | ((el: any) => void)

  /** 用于指定自定义元素的 is 特性 */
  is?: string

  /** 标记节点是否为预编译节点 */
  pre?: boolean

  /** 节点的标签名 */
  tag?: string

  /** 静态类名，用于优化性能 */
  staticClass?: string

  /** 动态类名，可以是字符串、对象或数组 */
  class?: any

  /** 静态样式，用于优化性能 */
  staticStyle?: { [key: string]: any }

  /** 动态样式，可以是字符串、对象或数组 */
  style?: string | Array<Object> | Object

  /** 规范化后的样式对象 */
  normalizedStyle?: Object

  /** 组件的 props 属性 */
  props?: { [key: string]: any }

  /** 普通的 HTML 属性 */
  attrs?: { [key: string]: string }

  /** DOM 属性 */
  domProps?: { [key: string]: any }

  /** 生命周期钩子函数 */
  hook?: { [key: string]: Function }

  /** 事件监听器 */
  on?: { [key: string]: Function | Array<Function> }

  /** 原生事件监听器 */
  nativeOn?: { [key: string]: Function | Array<Function> }

  /** 过渡效果的配置对象 */
  transition?: Object

  /** 用于 v-show 指令的标记 */
  show?: boolean // marker for v-show

  /** 内联模板的渲染函数和静态渲染函数 */
  inlineTemplate?: {
    /** 渲染函数 */
    render: Function
    /** 静态渲染函数数组 */
    staticRenderFns: Array<Function>
  }

  /** 指令数组 */
  directives?: Array<VNodeDirective>

  /** 是否保持组件的状态 */
  keepAlive?: boolean

  /** 作用域插槽的定义 */
  scopedSlots?: { [key: string]: Function }

  /** 用于 v-model 的数据绑定和回调函数 */
  model?: {
    /** v-model 的值 */
    value: any
    /** v-model 的回调函数 */
    callback: Function
  }

  /** 其他任意属性 */
  [key: string]: any
}

/**
 * @internal
 *
 * 用于描述 Vue 虚拟 DOM 节点中指令的相关信息。
 * 它包含了指令的名称、值、参数、修饰符等内容，
 * 主要用于在虚拟 DOM 渲染和更新过程中处理指令。
 */
export type VNodeDirective = {
  /**
   * 指令的名称
   */
  name: string

  /**
   * 指令的原始名称
   */
  rawName: string

  /**
   * 指令的值
   */
  value?: any

  /**
   * 指令的旧值
   */
  oldValue?: any

  /**
   * 指令的参数
   */
  arg?: string

  /**
   * 指令的旧参数
   */
  oldArg?: string

  /**
   * 指令的修饰符
   */
  modifiers?: ASTModifiers

  /**
   * 指令的定义对象
   */
  def?: Object
}

/**
 * 作用域插槽数据类型
 * 可以是一个数组，数组中的元素可以是包含键值对的对象或嵌套的 ScopedSlotsData
 */
export type ScopedSlotsData = Array<
  | {
      /** 插槽的键 */
      key: string
      /** 插槽的渲染函数 */
      fn: Function
    }
  | ScopedSlotsData
>
