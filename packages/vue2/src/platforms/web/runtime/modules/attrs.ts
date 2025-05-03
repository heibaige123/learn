import { isIE, isIE9, isEdge } from 'core/util/env'

import { extend, isDef, isUndef, isTrue } from 'shared/util'
import type { VNodeWithData } from 'types/vnode'

import {
  isXlink,
  xlinkNS,
  getXlinkProp,
  isBooleanAttr,
  isEnumeratedAttr,
  isFalsyAttrValue,
  convertEnumeratedValue
} from 'web/util/index'

/**
 * 同步真实 DOM 元素的属性（attributes）。它会对比新旧 VNode 的属性，把变化同步到真实 DOM 上。
 * @param oldVnode
 * @param vnode
 * @returns
 */
function updateAttrs(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  const opts = vnode.componentOptions
  if (isDef(opts) && opts.Ctor.options.inheritAttrs === false) {
    return
  }
  if (isUndef(oldVnode.data.attrs) && isUndef(vnode.data.attrs)) {
    return
  }
  let key, cur, old
  /** 真实 DOM 元素。 */
  const elm = vnode.elm
  /** 旧属性对象（没有就用空对象）。 */
  const oldAttrs = oldVnode.data.attrs || {}
  /** 新属性对象（没有就用空对象）。 */
  let attrs: any = vnode.data.attrs || {}
  // clone observed objects, as the user probably wants to mutate it
  // 响应式对象（有 `__ob__`）、代理对象（`_v_attr_proxy`）
  if (isDef(attrs.__ob__) || isTrue(attrs._v_attr_proxy)) {
    attrs = vnode.data.attrs = extend({}, attrs)
  }

  for (key in attrs) {
    cur = attrs[key]
    old = oldAttrs[key]
    if (old !== cur) {
      setAttr(elm, key, cur, vnode.data.pre)
    }
  }
  // #4391: in IE9, setting type can reset value for input[type=radio]
  // #6666: IE/Edge forces progress value down to 1 before setting a max
  /* istanbul ignore if */
  if ((isIE || isEdge) && attrs.value !== oldAttrs.value) {
    setAttr(elm, 'value', attrs.value)
  }
  for (key in oldAttrs) {
    if (isUndef(attrs[key])) {
      if (isXlink(key)) {
        // 如果是 XLink 属性，用命名空间移除。
        elm.removeAttributeNS(xlinkNS, getXlinkProp(key))
      } else if (!isEnumeratedAttr(key)) {
        // 如果不是枚举属性（如 `contenteditable`），直接移除。
        elm.removeAttribute(key)
      }
    }
  }
}

/**
 * 设置 DOM 元素的属性
 * @param el
 * @param key
 * @param value
 * @param isInPre `v-pre` 模式（`isInPre` 为真）
 */
function setAttr(el: Element, key: string, value: any, isInPre?: any) {
  if (isInPre || el.tagName.indexOf('-') > -1) {
    baseSetAttr(el, key, value)
  } else if (isBooleanAttr(key)) {
    // set attribute for blank value
    // e.g. <option disabled>Select one</option>
    if (isFalsyAttrValue(value)) {
      el.removeAttribute(key)
    } else {
      // technically allowfullscreen is a boolean attribute for <iframe>,
      // but Flash expects a value of "true" when used on <embed> tag
      // allowfullscreen 在 <embed> 上需要 "true"，
      // 其他布尔属性直接用属性名
      value = key === 'allowfullscreen' && el.tagName === 'EMBED' ? 'true' : key
      el.setAttribute(key, value)
    }
  } else if (isEnumeratedAttr(key)) {
    el.setAttribute(key, convertEnumeratedValue(key, value))
  } else if (isXlink(key)) {
    if (isFalsyAttrValue(value)) {
      el.removeAttributeNS(xlinkNS, getXlinkProp(key))
    } else {
      el.setAttributeNS(xlinkNS, key, value)
    }
  } else {
    baseSetAttr(el, key, value)
  }
}

/**
 * Vue 2 设置普通属性的基础函数。它会根据属性值决定是**设置**还是**移除**属性
 * @param el
 * @param key
 * @param value
 */
function baseSetAttr(el, key, value) {
  if (isFalsyAttrValue(value)) {
    el.removeAttribute(key)
  } else {
    // #7138: IE10 & 11 fires input event when setting placeholder on
    // <textarea>... block the first input event and remove the blocker
    // immediately.
    /* istanbul ignore if */
    // - 在 IE10 和 IE11 下，给 `<textarea>` 设置 `placeholder` 属性时，会**错误地触发一次 input 事件**。
    // - 为了避免这个 bug，Vue 会**临时加一个 input 事件监听器**，拦截并阻止第一次 input 事件的冒泡，然后立即移除这个监听器。
    // - 用 `el.__ieph` 标记，避免重复添加监听器。
    if (
      isIE &&
      !isIE9 &&
      el.tagName === 'TEXTAREA' &&
      key === 'placeholder' &&
      value !== '' &&
      !el.__ieph
    ) {
      const blocker = e => {
        e.stopImmediatePropagation()
        el.removeEventListener('input', blocker)
      }
      el.addEventListener('input', blocker)
      // $flow-disable-line
      el.__ieph = true /* IE placeholder patched */
    }
    el.setAttribute(key, value)
  }
}

export default {
  create: updateAttrs,
  update: updateAttrs
}
