import { Component } from 'types/component'

/**
 * 用于存储当前正在处理的组件实例。它的主要作用是与 Vue 3 的 `getCurrentInstance` API 保持兼容，同时为某些工具（如 VueUse）提供支持。
 */
export let currentInstance: Component | null = null

/**
 * 获取当前的组件实例
 *
 * This is exposed for compatibility with v3 (e.g. some functions in VueUse
 * relies on it). Do not use this internally, just use `currentInstance`.
 *
 * @internal this function needs manual type declaration because it relies
 * on previously manually authored types from Vue 2
 */
export function getCurrentInstance(): { proxy: Component } | null {
  return currentInstance && { proxy: currentInstance }
}

/**
 * 设置 `currentInstance` 的值。
 * 在组件的初始化、渲染、销毁等阶段，动态设置或清除 `currentInstance`。
 * 确保在任何时刻，`currentInstance` 都指向当前正在处理的组件实例。
 * @internal
 */
export function setCurrentInstance(vm: Component | null = null) {
  // 如果传入的 `vm` 为 `null`，表示清除当前实例
  // 调用 `currentInstance._scope.off()`，关闭当前实例的 `EffectScope`（响应式作用域）。
  if (!vm) currentInstance && currentInstance._scope.off()
  currentInstance = vm
  vm && vm._scope.on()
}
