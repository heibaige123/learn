import {
  remove,
  isDef,
  hasOwn,
  isArray,
  isFunction,
  invokeWithErrorHandling,
  warn
} from 'core/util'
import type { VNodeWithData } from 'types/vnode'
import { Component } from 'types/component'
import { isRef } from 'v3'

export default {
  /**
   * - 在 VNode 创建（插入 DOM）时调用。
   * - 调用 `registerRef(vnode)`，把当前节点的 ref 注册到组件实例的 `$refs` 或 `<script setup>` 变量上。
   * @param _
   * @param vnode
   */
  create(_: any, vnode: VNodeWithData) {
    registerRef(vnode)
  },

  /**
   * - 在 VNode 更新时调用。
   * - 只有当 ref 名称发生变化时才处理（比如 `<div :ref="foo">`，foo 变了）。
   * - 先移除旧 ref（`registerRef(oldVnode, true)`），再注册新 ref（`registerRef(vnode)`）。
   * - 保证 `$refs` 或 `<script setup>` 变量始终和模板中的 ref 保持同步。
   * @param oldVnode
   * @param vnode
   */
  update(oldVnode: VNodeWithData, vnode: VNodeWithData) {
    if (oldVnode.data.ref !== vnode.data.ref) {
      registerRef(oldVnode, true)
      registerRef(vnode)
    }
  },

  /**
   * - 在 VNode 销毁（移除 DOM）时调用。
   * - 调用 `registerRef(vnode, true)`，把对应的 ref 从 `$refs` 或 `<script setup>` 变量中移除/清空。
   * @param vnode
   */
  destroy(vnode: VNodeWithData) {
    registerRef(vnode, true)
  }
}

/**
 * 管理模板 ref 的注册和销毁，会在 VNode 的 create、update、destroy 阶段被调用，负责把模板中的 `ref` 绑定到组件实例的 `$refs` 对象上，并支持 `<script setup>` 语法下的自动赋值、函数式 ref、ref-in-for、ref 是 ref 对象等多种场景。
 * @param vnode 当前 VNode 节点（包含 ref 信息）。
 * @param isRemoval 表示是否是移除（销毁）ref。默认为 `false`，表示注册；为 `true` 时表示移除。
 * @returns
 */
export function registerRef(vnode: VNodeWithData, isRemoval?: boolean) {
  /** 模板中声明的 ref，可以是字符串、数字、ref 对象、函数。 */
  const ref = vnode.data.ref
  if (!isDef(ref)) return

  /** 当前组件实例。 */
  const vm = vnode.context
  /** 要赋值的内容，优先是组件实例，否则是 DOM 元素。 */
  const refValue = vnode.componentInstance || vnode.elm
  /** 注册时为 refValue，移除时为 null。 */
  const value = isRemoval ? null : refValue
  /** 注册时为 refValue，移除时为 undefined。 */
  const $refsValue = isRemoval ? undefined : refValue

  if (isFunction(ref)) {
    // 如果 ref 是函数，直接调用它，参数为 value（注册时为实例/DOM，移除时为 null）。
    // 这是 Vue 2.2+ 支持的函数式 ref 语法。
    invokeWithErrorHandling(ref, vm, [value], vm, `template ref function`)
    return
  }

  /** 是否在 v-for 里（即 ref-in-for）。 */
  const isFor = vnode.data.refInFor
  // ref 是否为字符串或数字。
  const _isString = typeof ref === 'string' || typeof ref === 'number'
  // ref 是否为 ref 对象（Vue 3/2.7+ Composition API）。
  const _isRef = isRef(ref)
  const refs = vm.$refs

  if (_isString || _isRef) {
    if (isFor) {
      // v-for 下的 ref 会变成数组，收集所有同名 ref 的实例/DOM。
      const existing = _isString ? refs[ref] : ref.value
      if (isRemoval) {
        // 移除时，如果是数组，则 remove。
        isArray(existing) && remove(existing, refValue)
      } else {
        // 注册时，如果还不是数组，先变成数组；如果已是数组且不包含当前值，则 push
        if (!isArray(existing)) {
          if (_isString) {
            refs[ref] = [refValue]
            setSetupRef(vm, ref, refs[ref])
          } else {
            ref.value = [refValue]
          }
        } else if (!existing.includes(refValue)) {
          existing.push(refValue)
        }
      }
    } else if (_isString) {
      if (isRemoval && refs[ref] !== refValue) {
        // 移除时，只有当前值等于 refValue 才清空，防止误删。
        return
      }
      // 注册时，直接赋值到 `$refs[ref]`。
      refs[ref] = $refsValue
      setSetupRef(vm, ref, value)
    } else if (_isRef) {
      if (isRemoval && ref.value !== refValue) {
        // 移除时，只有当前值等于 refValue 才清空。
        return
      }
      // 注册时，直接赋值到 ref.value。
      ref.value = value
    } else if (__DEV__) {
      warn(`Invalid template ref type: ${typeof ref}`)
    }
  }
}

/**
* 当在 `<script setup>` 中用 `ref` 声明了一个变量，并在模板里用 `ref="xxx"` 绑定时，
  自动把对应的 DOM 或组件实例赋值给 `<script setup>` 里的变量
* @param param0 组件实例，解构出 `_setupState`，这是 `<script setup>` 变量的存储对象。
* @param key ref 名称（字符串或数字）。
* @param val 要赋的值（通常是 DOM 元素或组件实例）。

#### 场景举例

```vue
<script setup>
import { ref } from 'vue'
const myDiv = ref(null)
const myComp = ref(null)
</script>

<template>
  <div ref="myDiv"></div>
  <MyComp ref="myComp" />
</template>
```

- 渲染时，`setSetupRef` 会自动把真实 DOM 或组件实例赋值给 `myDiv.value` 和 `myComp.value`。

*/
function setSetupRef(
  { _setupState }: Component,
  key: string | number,
  val: any
) {
  if (_setupState && hasOwn(_setupState, key as string)) {
    if (isRef(_setupState[key])) {
      _setupState[key].value = val
    } else {
      _setupState[key] = val
    }
  }
}
