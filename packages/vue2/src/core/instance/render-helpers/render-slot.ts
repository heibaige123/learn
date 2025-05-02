/*
## 插槽系统概念

1. **普通插槽 vs 作用域插槽**
   - 普通插槽: 在父组件编译时静态解析，存储在`$slots`中
   - 作用域插槽: 在父组件运行时调用，存储在`$scopedSlots`中，可接收子组件传递的数据

2. **后备内容**
   - 当插槽未被父组件填充时渲染的内容
   - 在template中是`<slot>默认内容</slot>`中的子节点

3. **具名插槽**
   - 通过name属性区分的插槽
   - 允许多个插槽在同一组件中共存


## 实际应用示例

当 Vue 编译以下模板时：
```html
<div>
  <slot name="header" :user="user">默认标题</slot>
</div>
```

会生成类似下面的渲染函数调用：
```js
_c('div', [
  renderSlot(
    "header",                        // 插槽名称
    [_v("默认标题")],                 // 后备内容
    { user: this.user },             // 传递给作用域插槽的数据
    null                             // 没有 v-bind 对象
  )
])
```
*/

import { extend, warn, isObject, isFunction } from 'core/util/index'
import VNode from 'core/vdom/vnode'

/**
 * Runtime helper for rendering <slot>
 */
/**
 * 渲染组件中的插槽内容，是`<slot>`标签在运行时的实现。它处理普通插槽和作用域插槽，并提供后备内容
 * @param name
 * @param fallbackRender
 * @param props
 * @param bindObject
 * @returns
 */
export function renderSlot(
  name: string,
  fallbackRender: ((() => Array<VNode>) | Array<VNode>) | null,
  props: Record<string, any> | null,
  bindObject: object | null
): Array<VNode> | null {
  // 检查组件的`$scopedSlots`中是否有对应名称的作用域插槽
  const scopedSlotFn = this.$scopedSlots[name]
  let nodes
  if (scopedSlotFn) {
    // 处理作用域插槽
    // scoped slot
    props = props || {}
    if (bindObject) {
      if (__DEV__ && !isObject(bindObject)) {
        warn('slot v-bind without argument expects an Object', this)
      }
      props = extend(extend({}, bindObject), props)
    }
    nodes =
      scopedSlotFn(props) ||
      (isFunction(fallbackRender) ? fallbackRender() : fallbackRender)
  } else {
    // 处理普通插槽
    nodes =
      this.$slots[name] ||
      (isFunction(fallbackRender) ? fallbackRender() : fallbackRender)
  }
  // 处理具名插槽的目标
  const target = props && props.slot
  if (target) {
    return this.$createElement('template', { slot: target }, nodes)
  } else {
    return nodes
  }
}
