import { def } from 'core/util/lang'
import { normalizeChildren } from 'core/vdom/helpers/normalize-children'
import { isAsyncPlaceholder } from './is-async-placeholder'
import type VNode from '../vnode'
import { Component } from 'types/component'
import { currentInstance, setCurrentInstance } from 'v3/currentInstance'

/**
 * Vue 2 内部用于**规范化作用域插槽（scoped slots）和普通插槽**的辅助函数
 * - 把编译生成的作用域插槽函数对象（`scopedSlots`），转换成一个结构统一、带有特殊标记的对象，便于后续渲染和 diff。
 * - 兼容普通插槽（`normalSlots`），保证无论父组件用的是普通插槽还是作用域插槽，子组件都能统一访问。
 * - 支持性能优化（缓存、快速路径）。
 * @param ownerVm Vue 组件实例， 当前拥有这些插槽的组件实例（即“拥有者”）。
 * @param scopedSlots 对象，key 是插槽名，value 是作用域插槽的渲染函数， 编译生成的作用域插槽函数对象，通常由父组件通过 `v-slot` 语法传递。
 * @param normalSlots 对象，key 是插槽名，value 是 VNode 数组， 普通插槽对象，通常由父组件通过传统插槽语法传递（如 `<template slot="foo">` 或 `<div slot="bar">`）。
 * @param prevScopedSlots 上一次规范化后的作用域插槽对象（缓存）。用于性能优化。如果插槽结构稳定且 key 没变，可以直接复用上一次的结果，避免重复规范化。
 * @returns
 ```js
 {
   slotName1: function (props) { ... }, // 规范化后的作用域插槽函数
   slotName2: function (props) { ... },
   $stable: true/false,
   $key: xxx,
   $hasNormal: true/false
 }
 ```
 */
export function normalizeScopedSlots(
  ownerVm: Component,
  scopedSlots: { [key: string]: Function } | undefined,
  normalSlots: { [key: string]: VNode[] },
  prevScopedSlots?: { [key: string]: Function }
): any {
  let res
  /** 是否有普通插槽 */
  const hasNormalSlots = Object.keys(normalSlots).length > 0
  /** 作用域插槽结构是否稳定（便于缓存） */
  const isStable = scopedSlots ? !!scopedSlots.$stable : !hasNormalSlots
  /** 作用域插槽的唯一 key（用于缓存） */
  const key = scopedSlots && scopedSlots.$key
  if (!scopedSlots) {
    res = {}
  } else if (scopedSlots._normalized) {
    // fast path 1: child component re-render only, parent did not change
    return scopedSlots._normalized
  } else if (
    isStable &&
    prevScopedSlots &&
    prevScopedSlots !== Object.freeze({}) &&
    key === prevScopedSlots.$key &&
    !hasNormalSlots &&
    !prevScopedSlots.$hasNormal
  ) {
    // 如果插槽结构稳定、key 没变、没有普通插槽，直接复用上一次的 `prevScopedSlots`，避免重复规范化。
    // fast path 2: stable scoped slots w/ no normal slots to proxy,
    // only need to normalize once
    return prevScopedSlots
  } else {
    res = {}
    for (const key in scopedSlots) {
      if (scopedSlots[key] && key[0] !== '$') {
        res[key] = normalizeScopedSlot(
          ownerVm,
          normalSlots,
          key,
          scopedSlots[key]
        )
      }
    }
  }
  // expose normal slots on scopedSlots
  for (const key in normalSlots) {
    // 对于 `normalSlots` 中存在但 `scopedSlots` 中没有的 key，自动生成一个代理函数（`proxyNormalSlot`），保证访问一致。
    if (!(key in res)) {
      res[key] = proxyNormalSlot(normalSlots, key)
    }
  }
  // avoriaz seems to mock a non-extensible $scopedSlots object
  // and when that is passed down this would cause an error
  // 如果 `scopedSlots` 可扩展，把 `_normalized` 属性挂到其上，避免重复规范化。
  if (scopedSlots && Object.isExtensible(scopedSlots)) {
    scopedSlots._normalized = res
  }
  // 给结果对象挂上 `$stable`、`$key`、`$hasNormal` 等特殊属性，便于后续 diff 和优化。
  def(res, '$stable', isStable)
  def(res, '$key', key)
  def(res, '$hasNormal', hasNormalSlots)
  return res
}

/**
 * Vue 内部用于**规范化单个作用域插槽函数**的辅助函数。
 * - 把编译生成的作用域插槽函数（scoped slot function）包装成一个标准的、返回 VNode 数组的函数。
 * - 保证插槽渲染时 this 指向正确的组件实例（ownerVm）。
 * - 兼容插槽函数返回单个 VNode、VNode 数组、对象、undefined、注释节点等各种情况。
 * - 支持 v-slot 无作用域语法的兼容（即把作用域插槽自动暴露到 normalSlots 上）。
 *
 * @param vm 当前组件实例（ownerVm），用于设置 currentInstance，保证插槽渲染时 this 正确。
 * @param normalSlots 普通插槽对象（{ [key: string]: VNode[] }），用于兼容无作用域的 v-slot。
 * @param key 插槽名（字符串）。
 * @param fn 原始的作用域插槽函数（由父组件传递，参数是 props，返回 VNode 或 VNode 数组）。
 * @returns
 */
function normalizeScopedSlot(vm, normalSlots, key, fn) {
  const normalized = function () {
    const cur = currentInstance
    setCurrentInstance(vm)
    let res = arguments.length ? fn.apply(null, arguments) : fn({})
    res =
      res && typeof res === 'object' && !Array.isArray(res)
        ? [res] // single vnode // 如果返回的是单个 VNode 对象，转成数组
        : normalizeChildren(res) // 否则用 normalizeChildren 规范化
    const vnode: VNode | null = res && res[0]
    setCurrentInstance(cur)
    // 如果返回的是注释节点或空节点，返回 undefined，否则返回规范化后的 VNode 数组
    return res &&
      (!vnode ||
        (res.length === 1 && vnode.isComment && !isAsyncPlaceholder(vnode))) // #9658, #10391
      ? undefined
      : res
  }
  // this is a slot using the new v-slot syntax without scope. although it is
  // compiled as a scoped slot, render fn users would expect it to be present
  // on this.$slots because the usage is semantically a normal slot.
  // 兼容 v-slot 无作用域语法，把 normalized 作为 getter 挂到 normalSlots 上
  if (fn.proxy) {
    Object.defineProperty(normalSlots, key, {
      get: normalized,
      enumerable: true,
      configurable: true
    })
  }
  return normalized
}

/**
 *  Vue 内部用于**把普通插槽包装成作用域插槽访问形式**的辅助函数
 *  - 让普通插槽（即传统 slot 语法传递的内容）也能像作用域插槽一样通过函数访问，
 *  - 保证在组件内部访问插槽时（如 `this.$scopedSlots.xxx()`）无论父组件用的是哪种插槽写法都能统一处理。
 * @param slots 普通插槽对象（`{ [key: string]: VNode[] }`），即 `normalSlots`。
 * @param key 插槽名（字符串）。
 * @returns
 */
function proxyNormalSlot(slots, key) {
  return () => slots[key]
}
