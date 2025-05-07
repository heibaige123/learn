/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import { isTextInputType } from 'web/util/element'
import { looseEqual, looseIndexOf } from 'shared/util'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import { warn, isIE9, isIE, isEdge } from 'core/util/index'

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement
    // @ts-expect-error
    if (el && el.vmodel) {
      trigger(el, 'input')
    }
  })
}

const directive = {
  /**
   * inserted钩子 - 处理指令首次绑定到元素时的初始化操作
   * @param {HTMLElement} el - 指令绑定的DOM元素
   * @param {Object} binding - 指令绑定信息(value, modifiers等)
   * @param {VNode} vnode - 当前的虚拟节点
   * @param {VNode} oldVnode - 旧的虚拟节点
   */
  inserted(el, binding, vnode, oldVnode) {
    if (vnode.tag === 'select') {
      // #6903
      if (oldVnode.elm && !oldVnode.elm._vOptions) {
        mergeVNodeHook(vnode, 'postpatch', () => {
          directive.componentUpdated(el, binding, vnode)
        })
      } else {
        setSelected(el, binding, vnode.context)
      }
      el._vOptions = [].map.call(el.options, getValue)
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      el._vModifiers = binding.modifiers
      if (!binding.modifiers.lazy) {
        el.addEventListener('compositionstart', onCompositionStart)
        el.addEventListener('compositionend', onCompositionEnd)
        // Safari < 10.2 & UIWebView在确认输入法选择前切换焦点时不会触发compositionend
        // 这也修复了一些浏览器(如iOS Chrome)在自动完成时
        // 触发"change"而非"input"的问题
        el.addEventListener('change', onCompositionEnd)
        /* istanbul ignore if */
        if (isIE9) {
          el.vmodel = true
        }
      }
    }
  },

  /**
   * componentUpdated钩子 - 处理组件更新时select元素的v-model同步
   * @param {HTMLElement} el - 指令绑定的DOM元素
   * @param {Object} binding - 指令绑定信息(value, oldValue等)
   * @param {VNode} vnode - 生成的虚拟节点
   */
  componentUpdated(el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // 处理v-for渲染的选项可能发生变化的情况
      // 值可能与渲染的选项不同步
      // 检测此类情况并过滤掉在DOM中不再有匹配选项的值
      const prevOptions = el._vOptions
      const curOptions = (el._vOptions = [].map.call(el.options, getValue))
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        // 当至少有一个值没有找到匹配选项时触发change事件
        const needReset = el.multiple
          ? binding.value.some(v => hasNoMatchingOption(v, curOptions))
          : binding.value !== binding.oldValue &&
            hasNoMatchingOption(binding.value, curOptions)
        if (needReset) {
          trigger(el, 'change')
        }
      }
    }
  }
}

/**
 * setSelected函数 - 设置select元素的选中状态，并处理浏览器兼容性问题
 * @param {HTMLSelectElement} el - select元素
 * @param {Object} binding - 指令绑定对象，包含v-model的值
 * @param {Vue} vm - Vue实例，用于警告信息
 */
function setSelected(el, binding, vm) {
  actuallySetSelected(el, binding, vm)
  /* istanbul ignore if */
  if (isIE || isEdge) {
    setTimeout(() => {
      actuallySetSelected(el, binding, vm)
    }, 0)
  }
}

/**
 * actuallySetSelected函数 - 实际设置select元素的选中状态的核心逻辑
 * @param {HTMLSelectElement} el - select元素
 * @param {Object} binding - 指令绑定对象，包含v-model的值
 * @param {Vue} vm - Vue实例，用于警告信息
 */
function actuallySetSelected(el, binding, vm) {
  const value = binding.value
  const isMultiple = el.multiple
  if (isMultiple && !Array.isArray(value)) {
    __DEV__ &&
      warn(
        `<select multiple v-model="${binding.expression}"> ` +
          `expects an Array value for its binding, but got ${Object.prototype.toString
            .call(value)
            .slice(8, -1)}`,
        vm
      )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}

/**
 * hasNoMatchingOption函数 - 检查值是否在选项列表中不存在匹配项
 * @param {any} value - 要检查的值（通常是v-model绑定的值）
 * @param {Array<any>} options - 选项值数组（从select的options中提取）
 * @returns {boolean} - 如果没有匹配项返回true，有匹配项返回false
 */
function hasNoMatchingOption(value, options) {
  return options.every(o => !looseEqual(o, value))
}

/**
 * getValue函数 - 从option元素中获取实际值
 * @param {HTMLOptionElement} option - 选项元素
 * @returns {any} - 选项的实际值
 */
function getValue(option) {
  return '_value' in option ? option._value : option.value
}

/**
 * onCompositionStart函数 - 处理输入法编辑开始事件
 * @param {CompositionEvent} e - 输入法编辑开始事件对象
 */
function onCompositionStart(e) {
  e.target.composing = true
}

/**
 * onCompositionEnd函数 - 处理输入法编辑完成事件
 * @param {CompositionEvent} e - 输入法编辑结束事件对象

 用于处理输入法(IME)输入完成的情况，
 解决中文、日文、韩文等需要组合输入的语言在v-model中的特殊处理问题。
 */
function onCompositionEnd(e) {
  // prevent triggering an input event for no reason
  if (!e.target.composing) return
  e.target.composing = false
  trigger(e.target, 'input')
}

/**
 * trigger函数 - 在指定DOM元素上手动触发指定类型的事件
 * @param {HTMLElement} el - 需要触发事件的DOM元素
 * @param {string} type - 要触发的事件类型（如'input'、'change'等）
 */
function trigger(el, type) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}

export default directive
