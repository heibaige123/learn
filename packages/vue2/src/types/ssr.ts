import VNode from 'core/vdom/vnode'
import { Component } from './component'

/**
 * 表示带有缓存的组件上下文
 */
export type ComponentWithCacheContext = {
  /** 类型为 'ComponentWithCache' */
  type: 'ComponentWithCache'
  /** 缓存的缓冲区索引 */
  bufferIndex: number
  /** 缓冲区数组 */
  buffer: Array<string>
  /** 缓存的键值 */
  key: string
}

/**
 * 表示元素上下文
 */
export type ElementContext = {
  /** 类型为 'Element' */
  type: 'Element'
  /** 子节点数组 */
  children: Array<VNode>
  /** 已渲染的子节点数量 */
  rendered: number
  /** 元素的结束标签 */
  endTag: string
  /** 总计数量 */
  total: number
}

/**
 * 表示组件上下文
 */
export type ComponentContext = {
  /** 类型为 'Component' */
  type: 'Component'
  /** 之前激活的组件 */
  prevActive: Component
}

/**
 * 渲染状态类型
 */
export type RenderState =
  | ComponentContext
  | ComponentWithCacheContext
  | ElementContext
