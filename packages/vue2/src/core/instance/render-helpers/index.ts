import { toNumber, toString, looseEqual, looseIndexOf } from 'shared/util'
import { createTextVNode, createEmptyVNode } from 'core/vdom/vnode'
import { renderList } from './render-list'
import { renderSlot } from './render-slot'
import { resolveFilter } from './resolve-filter'
import { checkKeyCodes } from './check-keycodes'
import { bindObjectProps } from './bind-object-props'
import { renderStatic, markOnce } from './render-static'
import { bindObjectListeners } from './bind-object-listeners'
import { resolveScopedSlots } from './resolve-scoped-slots'
import { bindDynamicKeys, prependModifier } from './bind-dynamic-keys'

/**
 * - 把一系列运行时渲染辅助方法（render helpers）挂载到 Vue.prototype._renderProxy 或 Vue.prototype 上
 * - 把所有模板运行时需要的辅助方法批量挂到 Vue 实例原型上，让 render 函数可以直接通过 `this._xxx` 调用这些方法，保证模板渲染的正常运行
 * @param target
 */
export function installRenderHelpers(target: any) {
  target._o = markOnce
  target._n = toNumber
  // toString，字符串化
  target._s = toString
  // v-for 列表渲染
  target._l = renderList
  // 插槽渲染
  target._t = renderSlot
  // looseEqual 判断
  target._q = looseEqual
  // looseIndexOf
  target._i = looseIndexOf
  // 静态树渲染
  target._m = renderStatic
  // 过滤器
  target._f = resolveFilter
  // 按键码判断
  target._k = checkKeyCodes
  // v-bind 合并属性
  target._b = bindObjectProps
  // 创建文本节点
  target._v = createTextVNode
  // 创建空节点
  target._e = createEmptyVNode
  // resolveScopedSlots
  target._u = resolveScopedSlots
  target._g = bindObjectListeners
  target._d = bindDynamicKeys
  target._p = prependModifier
}
