import { isDef, isUndef, extend, toNumber, isTrue } from 'shared/util'
import type { VNodeWithData } from 'types/vnode'
import { isSVG } from 'web/util/index'

let svgContainer

/**
 * updateDOMProps函数 - 更新DOM元素的属性
 * @param {VNodeWithData} oldVnode - 旧的虚拟节点
 * @param {VNodeWithData} vnode - 新的虚拟节点
 */
function updateDOMProps(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (isUndef(oldVnode.data.domProps) && isUndef(vnode.data.domProps)) {
    return
  }
  let key, cur
  const elm: any = vnode.elm
  const oldProps = oldVnode.data.domProps || {}
  let props = vnode.data.domProps || {}
  // clone observed objects, as the user probably wants to mutate it
  if (isDef(props.__ob__) || isTrue(props._v_attr_proxy)) {
    props = vnode.data.domProps = extend({}, props)
  }

  for (key in oldProps) {
    if (!(key in props)) {
      elm[key] = ''
    }
  }

  for (key in props) {
    cur = props[key]
    // ignore children if the node has textContent or innerHTML,
    // as these will throw away existing DOM nodes and cause removal errors
    // on subsequent patches (#3360)
    if (key === 'textContent' || key === 'innerHTML') {
      if (vnode.children) vnode.children.length = 0
      if (cur === oldProps[key]) continue
      // #6601 work around Chrome version <= 55 bug where single textNode
      // replaced by innerHTML/textContent retains its parentNode property
      if (elm.childNodes.length === 1) {
        elm.removeChild(elm.childNodes[0])
      }
    }

    if (key === 'value' && elm.tagName !== 'PROGRESS') {
      // store value as _value as well since
      // non-string values will be stringified
      elm._value = cur
      // avoid resetting cursor position when value is the same
      const strCur = isUndef(cur) ? '' : String(cur)
      if (shouldUpdateValue(elm, strCur)) {
        elm.value = strCur
      }
    } else if (
      key === 'innerHTML' &&
      isSVG(elm.tagName) &&
      isUndef(elm.innerHTML)
    ) {
      // IE doesn't support innerHTML for SVG elements
      svgContainer = svgContainer || document.createElement('div')
      svgContainer.innerHTML = `<svg>${cur}</svg>`
      const svg = svgContainer.firstChild
      while (elm.firstChild) {
        elm.removeChild(elm.firstChild)
      }
      while (svg.firstChild) {
        elm.appendChild(svg.firstChild)
      }
    } else if (
      // skip the update if old and new VDOM state is the same.
      // `value` is handled separately because the DOM value may be temporarily
      // out of sync with VDOM state due to focus, composition and modifiers.
      // This  #4521 by skipping the unnecessary `checked` update.
      cur !== oldProps[key]
    ) {
      // some property updates can throw
      // e.g. `value` on <progress> w/ non-finite value
      try {
        elm[key] = cur
      } catch (e: any) {}
    }
  }
}

// check platforms/web/util/attrs.js acceptValue
type acceptValueElm = HTMLInputElement | HTMLSelectElement | HTMLOptionElement

/**
 * shouldUpdateValue函数 - 决定是否应该更新表单元素的值
 * @param {HTMLInputElement|HTMLSelectElement|HTMLOptionElement} elm - 表单元素
 * @param {string} checkVal - 用于比较的值(通常是v-model绑定的值)
 * @returns {boolean} - 如果元素值应该被更新，则返回true
 */
function shouldUpdateValue(elm: acceptValueElm, checkVal: string): boolean {
  return (
    //@ts-expect-error
    !elm.composing &&
    (elm.tagName === 'OPTION' ||
      isNotInFocusAndDirty(elm, checkVal) ||
      isDirtyWithModifiers(elm, checkVal))
  )
}

/**
 * isNotInFocusAndDirty函数 - 检查输入元素是否满足"失焦且值变脏"的条件
 * @param {HTMLInputElement|HTMLTextAreaElement} elm - 接受值的元素(input或textarea)
 * @param {string} checkVal - 用于比较的值(通常是v-model绑定的值)
 * @returns {boolean} - 如果元素失去焦点且值与checkVal不同，则返回true
 */
function isNotInFocusAndDirty(elm: acceptValueElm, checkVal: string): boolean {
  // return true when textbox (.number and .trim) loses focus and its value is
  // not equal to the updated value
  // 当文本框(.number和.trim修饰符)失去焦点且其值不等于更新的值时返回true
  let notInFocus = true
  // #6157
  // work around IE bug when accessing document.activeElement in an iframe
  try {
    notInFocus = document.activeElement !== elm
  } catch (e: any) {}
  return notInFocus && elm.value !== checkVal
}

/**
 * isDirtyWithModifiers函数 - 考虑修饰符检查元素值是否"脏"(已更改)
 * @param {HTMLElement} elm - 带有值的元素，可能包含v-model修饰符
 * @param {string} newVal - 新值
 * @returns {boolean} - 根据应用修饰符后，如果值不同则返回true
 */
function isDirtyWithModifiers(elm: any, newVal: string): boolean {
  const value = elm.value
  const modifiers = elm._vModifiers // injected by v-model runtime
  if (isDef(modifiers)) {
    if (modifiers.number) {
      return toNumber(value) !== toNumber(newVal)
    }
    if (modifiers.trim) {
      return value.trim() !== newVal.trim()
    }
  }
  return value !== newVal
}

export default {
  create: updateDOMProps,
  update: updateDOMProps
}
