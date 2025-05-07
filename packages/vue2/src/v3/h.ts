import { createElement } from '../core/vdom/create-element'
import { currentInstance } from './currentInstance'
import { warn } from 'core/util'

/**
 * @internal
 * 渲染函数 h 的实现（Vue 2 兼容版）。
 * 该函数用于在组合式 API 或渲染函数中创建 VNode。
 * 需要手动声明类型，因为依赖于 Vue 2 的手动类型定义。
 *
 * @param type    组件类型或标签名（如 'div'、组件对象等）
 * @param props   属性对象（可选），如 class、style、onClick 等
 * @param children 子节点（可选），可以是字符串、VNode、VNode 数组等
 * @returns       返回一个 VNode 实例
 */
export function h(type: any, props?: any, children?: any) {
  // 检查当前是否有激活的组件实例
  if (!currentInstance) {
    // 如果没有，开发环境下给出警告
    __DEV__ &&
      warn(
        `globally imported h() can only be invoked when there is an active ` +
          `component instance, e.g. synchronously in a component's render or setup function.`
      )
  }
  // 调用底层 createElement 方法创建 VNode
  // 参数说明：
  //   currentInstance! ：当前组件实例（非空断言）
  //   type            ：标签名或组件类型
  //   props           ：属性对象
  //   children        ：子节点
  //   2               ：patchFlag，2 表示用户编写的 vnode
  //   true            ：alwaysNormalize，始终规范化 children
  return createElement(currentInstance!, type, props, children, 2, true)
}
