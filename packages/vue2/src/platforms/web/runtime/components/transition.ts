// Provides transition support for a single element/component.
// supports transition mode (out-in / in-out)

import { warn } from 'core/util/index'
import { camelize, extend, isPrimitive } from 'shared/util'
import {
  mergeVNodeHook,
  isAsyncPlaceholder,
  getFirstComponentChild
} from 'core/vdom/helpers/index'
import VNode from 'core/vdom/vnode'
import type { Component } from 'types/component'

/**
 * Vue 过渡组件(transition)的属性定义对象
 * 用于定义<transition>组件支持的所有prop及其类型
 */
export const transitionProps = {
  /** 过渡名称，用于自动生成CSS类名前缀 */
  name: String,
  /** 是否在初始渲染时应用过渡效果 */
  appear: Boolean,
  /** 是否使用CSS过渡类（设为false则只使用JavaScript钩子） */
  css: Boolean,
  /** 过渡模式("in-out"或"out-in")，控制多元素过渡的顺序 */
  mode: String,
  /** 指定过渡事件类型（"transition"或"animation"） */
  type: String,
  /** 进入过渡的开始状态CSS类名 */
  enterClass: String,
  /** 离开过渡的开始状态CSS类名 */
  leaveClass: String,
  /** 进入过渡的结束状态CSS类名 */
  enterToClass: String,
  /** 离开过渡的结束状态CSS类名 */
  leaveToClass: String,
  /** 进入过渡生效时的CSS类名 */
  enterActiveClass: String,
  /** 离开过渡生效时的CSS类名 */
  leaveActiveClass: String,
  /** 初始渲染的开始状态CSS类名 */
  appearClass: String,
  /** 初始渲染过渡生效时的CSS类名 */
  appearActiveClass: String,
  /** 初始渲染的结束状态CSS类名 */
  appearToClass: String,
  /** 过渡持续时间，可以是数字(毫秒)、字符串或对象形式 */
  duration: [Number, String, Object]
}

// in case the child is also an abstract component, e.g. <keep-alive>
// we want to recursively retrieve the real component to be rendered
/**
 * getRealChild函数 - 用于获取虚拟节点中的真实子节点（跳过抽象组件）
 * @param {VNode | undefined} vnode - 要处理的虚拟节点
 * @returns {VNode | undefined} - 返回第一个非抽象组件节点
 */
function getRealChild(vnode?: VNode): VNode | undefined {
  const compOptions = vnode && vnode.componentOptions
  if (compOptions && compOptions.Ctor.options.abstract) {
    return getRealChild(getFirstComponentChild(compOptions.children))
  } else {
    return vnode
  }
}

/**
 * extractTransitionData函数 - 从组件中提取过渡相关的数据
 * @param {Component} comp - Vue组件实例
 * @returns {Record<string, any>} - 返回包含props和事件监听器的对象
 */
export function extractTransitionData(comp: Component): Record<string, any> {
  const data = {}
  const options = comp.$options
  // props
  for (const key in options.propsData) {
    data[key] = comp[key]
  }
  // events.
  // extract listeners and pass them directly to the transition methods
  const listeners = options._parentListeners
  for (const key in listeners) {
    data[camelize(key)] = listeners[key]
  }
  return data
}

/**
 * placeholder函数 - 为特定格式的组件创建占位符节点
 * @param {Function} h - Vue的渲染函数(createElement)
 * @param {VNode} rawChild - 原始的虚拟节点
 * @returns {VNode | undefined} - 返回占位符节点或undefined
 */
function placeholder(h: Function, rawChild: VNode): VNode | undefined {
  // - `\d`：匹配一个数字字符(0-9)
  // - `-keep-alive$`：匹配字符串末尾的"-keep-alive"
  // - 整体匹配：以数字加"-keep-alive"结尾的字符串，如"1-keep-alive"、"2-keep-alive"等

  // @ts-expect-error
  if (/\d-keep-alive$/.test(rawChild.tag)) {
    return h('keep-alive', {
      props: rawChild.componentOptions!.propsData
    })
  }
}

/**
 * hasParentTransition函数 - 检查虚拟节点是否有包含transition属性的父节点
 * @param {VNode} vnode - 要检查的虚拟节点
 * @returns {boolean | undefined} - 如果找到带有transition的父节点则返回true，否则返回undefined
 */
function hasParentTransition(vnode: VNode): boolean | undefined {
  while ((vnode = vnode.parent!)) {
    if (vnode.data!.transition) {
      return true
    }
  }
}

/**
 * isSameChild函数 - 判断两个虚拟节点是否代表相同的子元素
 * @param {VNode} child - 新的虚拟节点
 * @param {VNode} oldChild - 旧的虚拟节点
 * @returns {boolean} - 如果两个节点被视为相同则返回true，否则返回false
 */
function isSameChild(child: VNode, oldChild: VNode): boolean {
  return oldChild.key === child.key && oldChild.tag === child.tag
}

/**
 * isNotTextNode函数 - 判断虚拟节点是否不是文本节点
 * @param {VNode} c - 要检查的虚拟节点
 * @returns {boolean} - 如果不是文本节点则返回true
 */
const isNotTextNode = (c: VNode) => c.tag || isAsyncPlaceholder(c)

/**
 * isVShowDirective函数 - 判断一个指令是否为v-show指令
 * @param {Object} d - 指令对象
 * @returns {boolean} - 如果是v-show指令则返回true
 */
const isVShowDirective = d => d.name === 'show'

export default {
  name: 'transition',
  props: transitionProps,
  abstract: true,

  /**
   * <transition>组件的render函数 - 处理单个元素的进入/离开过渡
   * @param {Function} h - Vue的createElement函数
   * @returns {VNode | undefined} - 返回处理后的虚拟节点或undefined
   */
  render(h: Function) {
    let children: any = this.$slots.default
    if (!children) {
      return
    }

    // 过滤掉文本节点(可能的空白)
    // filter out text nodes (possible whitespaces)
    children = children.filter(isNotTextNode)
    /* istanbul ignore if */
    if (!children.length) {
      return
    }

    // warn multiple elements
    if (__DEV__ && children.length > 1) {
      warn(
        '<transition> can only be used on a single element. Use ' +
          '<transition-group> for lists.',
        this.$parent
      )
    }

    const mode: string = this.mode

    // （新元素先进入，旧元素后离开）或`'out-in'`（旧元素先离开，新元素后进入）
    // warn invalid mode
    if (__DEV__ && mode && mode !== 'in-out' && mode !== 'out-in') {
      warn('invalid <transition> mode: ' + mode, this.$parent)
    }

    const rawChild: VNode = children[0]

    // 如果是组件根节点且父容器也有过渡，则跳过
    // if this is a component root node and the component's
    // parent container node also has transition, skip.
    if (hasParentTransition(this.$vnode)) {
      return rawChild
    }

    // 应用过渡数据到子节点
    // 使用getRealChild()忽略抽象组件如keep-alive
    // apply transition data to child
    // use getRealChild() to ignore abstract components e.g. keep-alive
    const child = getRealChild(rawChild)
    /* istanbul ignore if */
    if (!child) {
      return rawChild
    }

    if (this._leaving) {
      return placeholder(h, rawChild)
    }

    // 确保为节点类型和此过渡组件实例提供唯一的key
    // 此key用于在进入过程中移除待离开的节点
    const id: string = `__transition-${this._uid}-`
    child.key =
      child.key == null
        ? child.isComment
          ? id + 'comment'
          : id + child.tag
        : isPrimitive(child.key)
        ? String(child.key).indexOf(id) === 0
          ? child.key
          : id + child.key
        : child.key

    const data: Object = ((child.data || (child.data = {})).transition =
      extractTransitionData(this))
    const oldRawChild: VNode = this._vnode
    const oldChild = getRealChild(oldRawChild)

    // 标记v-show
    // 使过渡模块可以将控制权交给指令
    if (child.data.directives && child.data.directives.some(isVShowDirective)) {
      child.data.show = true
    }

    if (
      oldChild &&
      oldChild.data &&
      !isSameChild(child, oldChild) &&
      !isAsyncPlaceholder(oldChild) &&
      // #6687 component root is a comment node
      !(
        oldChild.componentInstance &&
        oldChild.componentInstance._vnode!.isComment
      )
    ) {
      // 用新的过渡数据替换旧子节点的过渡数据
      // 对动态过渡很重要!
      const oldData: Object = (oldChild.data.transition = extend({}, data))
      // 处理过渡模式
      if (mode === 'out-in') {
        // 返回占位节点，并在离开完成时队列更新
        this._leaving = true
        mergeVNodeHook(oldData, 'afterLeave', () => {
          this._leaving = false
          this.$forceUpdate()
        })
        return placeholder(h, rawChild)
      } else if (mode === 'in-out') {
        if (isAsyncPlaceholder(child)) {
          return oldRawChild
        }
        let delayedLeave
        const performLeave = () => {
          delayedLeave()
        }
        mergeVNodeHook(data, 'afterEnter', performLeave)
        mergeVNodeHook(data, 'enterCancelled', performLeave)
        mergeVNodeHook(oldData, 'delayLeave', leave => {
          delayedLeave = leave
        })
      }
    }

    return rawChild
  }
}
