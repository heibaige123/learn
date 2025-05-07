// Provides transition support for list items.
// supports move transitions using the FLIP technique.

// Because the vdom's children update algorithm is "unstable" - i.e.
// it doesn't guarantee the relative positioning of removed elements,
// we force transition-group to update its children into two passes:
// in the first pass, we remove all nodes that need to be removed,
// triggering their leaving transition; in the second pass, we insert/move
// into the final desired state. This way in the second pass removed
// nodes will remain where they should be.

import { warn, extend } from 'core/util/index'
import { addClass, removeClass } from 'web/runtime/class-util'
import { transitionProps, extractTransitionData } from './transition'
import { setActiveInstance } from 'core/instance/lifecycle'

import {
  hasTransition,
  getTransitionInfo,
  transitionEndEvent,
  addTransitionClass,
  removeTransitionClass
} from 'web/runtime/transition-util'
import VNode from 'core/vdom/vnode'
import { VNodeWithData } from 'types/vnode'
import { getComponentName } from 'core/vdom/create-component'

/**
 * transition-group组件的props定义 - 扩展基本过渡属性并添加特有属性
 */
const props = extend(
  {
    tag: String,
    moveClass: String
  },
  transitionProps
)

delete props.mode

export default {
  props,

  /**
   * 挂载前钩子 - 重写更新方法以处理过渡效果
   */
  beforeMount() {
    const update = this._update
    this._update = (vnode, hydrating) => {
      const restoreActiveInstance = setActiveInstance(this)
      // force removing pass
      // 强制移除处理
      this.__patch__(
        this._vnode,
        this.kept,
        false, // hydrating
        true // removeOnly (!important, avoids unnecessary moves)
      )
      this._vnode = this.kept
      restoreActiveInstance()
      update.call(this, vnode, hydrating)
    }
  },

  /**
   * 渲染函数 - 处理子元素并准备过渡效果
   * @param {Function} h - createElement函数
   * @returns {VNode} - 渲染的虚拟节点
   */
  render(h: Function) {
    const tag: string = this.tag || this.$vnode.data.tag || 'span'
    const map: Record<string, any> = Object.create(null)
    const prevChildren: Array<VNode> = (this.prevChildren = this.children)
    const rawChildren: Array<VNode> = this.$slots.default || []
    const children: Array<VNode> = (this.children = [])
    const transitionData = extractTransitionData(this)

    // 处理新的子节点
    for (let i = 0; i < rawChildren.length; i++) {
      const c: VNode = rawChildren[i]
      if (c.tag) {
        // 验证子节点是否有key（必须有key才能正确处理过渡）
        if (c.key != null && String(c.key).indexOf('__vlist') !== 0) {
          children.push(c)
          map[c.key] = c
          ;(c.data || (c.data = {})).transition = transitionData
        } else if (__DEV__) {
          const opts = c.componentOptions
          const name: string = opts
            ? getComponentName(opts.Ctor.options as any) || opts.tag || ''
            : c.tag
          warn(`<transition-group> children must be keyed: <${name}>`)
        }
      }
    }

    // 处理前一次渲染的子节点
    if (prevChildren) {
      const kept: Array<VNode> = []
      const removed: Array<VNode> = []
      for (let i = 0; i < prevChildren.length; i++) {
        const c: VNode = prevChildren[i]
        c.data!.transition = transitionData
        // 记录DOM元素的初始位置
        // @ts-expect-error .getBoundingClientRect is not typed in Node
        c.data!.pos = c.elm.getBoundingClientRect()
        if (map[c.key!]) {
          kept.push(c)
        } else {
          removed.push(c)
        }
      }
      this.kept = h(tag, null, kept)
      this.removed = removed
    }

    return h(tag, null, children)
  },

  /**
   * 更新钩子 - 实现FLIP动画技术处理元素移动
   */
  updated() {
    const children: Array<VNodeWithData> = this.prevChildren
    const moveClass: string = this.moveClass || (this.name || 'v') + '-move'
    if (!children.length || !this.hasMove(children[0].elm, moveClass)) {
      return
    }

    // we divide the work into three loops to avoid mixing DOM reads and writes
    // in each iteration - which helps prevent layout thrashing.
    // 将工作分为三个循环，避免在每次迭代中混合DOM读取和写入
    // 这有助于防止布局抖动
    children.forEach(callPendingCbs) // 调用待处理的回调
    children.forEach(recordPosition) // 记录新位置
    children.forEach(applyTranslation) // 应用变换

    // force reflow to put everything in position
    // assign to this to avoid being removed in tree-shaking
    // 强制回流，将所有元素放置到位置
    // 赋值给this以避免在tree-shaking中被移除
    // $flow-disable-line
    this._reflow = document.body.offsetHeight

    // 应用移动过渡效果
    children.forEach((c: VNode) => {
      if (c.data!.moved) {
        const el: any = c.elm
        const s: any = el.style
        addTransitionClass(el, moveClass)
        s.transform = s.WebkitTransform = s.transitionDuration = ''
        el.addEventListener(
          transitionEndEvent,
          (el._moveCb = function cb(e) {
            if (e && e.target !== el) {
              return
            }
            if (!e || /transform$/.test(e.propertyName)) {
              el.removeEventListener(transitionEndEvent, cb)
              el._moveCb = null
              removeTransitionClass(el, moveClass)
            }
          })
        )
      }
    })
  },

  methods: {
    /**
     * hasMove方法 - 检测元素是否支持移动过渡效果
     * @param {HTMLElement} el - 要检测的元素
     * @param {string} moveClass - 移动CSS类名
     * @returns {boolean} - 是否支持移动过渡
     */
    hasMove(el: any, moveClass: string): boolean {
      /* istanbul ignore if */
      if (!hasTransition) {
        return false
      }
      /* istanbul ignore if */
      if (this._hasMove) {
        return this._hasMove
      }
      // Detect whether an element with the move class applied has
      // CSS transitions. Since the element may be inside an entering
      // transition at this very moment, we make a clone of it and remove
      // all other transition classes applied to ensure only the move class
      // is applied.
      // 检测应用了移动类的元素是否有CSS过渡。
      // 由于此刻元素可能正在进入过渡中，
      // 我们创建一个克隆并移除所有其他过渡类，
      // 确保只应用移动类。
      const clone: HTMLElement = el.cloneNode()
      if (el._transitionClasses) {
        el._transitionClasses.forEach((cls: string) => {
          removeClass(clone, cls)
        })
      }
      addClass(clone, moveClass)
      clone.style.display = 'none'
      this.$el.appendChild(clone)
      const info: any = getTransitionInfo(clone)
      this.$el.removeChild(clone)
      return (this._hasMove = info.hasTransform)
    }
  }
}

/**
 * callPendingCbs函数 - 调用DOM元素上挂载的过渡回调函数
 * @param c - 带有可能包含回调函数的DOM引用的虚拟节点
 */
function callPendingCbs(
  c: VNodeWithData & { elm?: { _moveCb?: Function; _enterCb?: Function } }
) {
  // `_moveCb`: 移动过渡的回调函数
  /* istanbul ignore if */
  if (c.elm!._moveCb) {
    c.elm!._moveCb()
  }
  // `_enterCb`: 进入过渡的回调函数
  /* istanbul ignore if */
  if (c.elm!._enterCb) {
    c.elm!._enterCb()
  }
}

/**
 * recordPosition函数 - 记录DOM元素的当前位置
 * @param {VNodeWithData} c - 带有数据的虚拟节点
 */
function recordPosition(c: VNodeWithData) {
  c.data!.newPos = c.elm.getBoundingClientRect()
}

/**
 * applyTranslation函数 - 对虚拟节点应用CSS变换以准备移动动画
 * @param {VNodeWithData} c - 包含位置数据的虚拟节点

Vue的FLIP（First-Last-Invert-Play）动画系统的核心部分，
用于实现`<transition-group>`组件的移动过渡效果。
它通过CSS变换创造元素看似从旧位置移动到新位置的视觉效果
 */
function applyTranslation(c: VNodeWithData) {
  const oldPos = c.data.pos
  const newPos = c.data.newPos
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    c.data.moved = true
    const s = c.elm.style
    s.transform = s.WebkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
  }
}
