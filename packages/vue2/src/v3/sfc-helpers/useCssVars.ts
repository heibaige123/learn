import { watchPostEffect } from '../'
import { inBrowser, warn } from 'core/util'
import { currentInstance } from '../currentInstance'

/**
 * Runtime helper for SFC's CSS variable injection feature.
 * @private
 */
/**
 * SFC (单文件组件) CSS 变量注入功能的运行时辅助函数。
 * 这个函数主要由 Vue 编译器在处理 <style vars> 语法时在生成的渲染函数代码中调用。
 * 函数逻辑 (Function Logic):
 * @private
 * @param getter - 一个函数，用于从组件实例和 setup 代理中计算出需要注入的 CSS 变量。
 *                 - 参数 (getter's Parameters):
 *                     - vm: Record<string, any> - 当前组件实例的公共属性 (类似于 `this` 在选项式 API 中的访问)。
 *                     - setupProxy: Record<string, any> - setup 函数返回的响应式对象代理。
 *                 - 返回值 (getter's Return Value): Record<string, string> - 一个对象，键是 CSS 变量名 (不带 '--')，值是对应的 CSS 变量值。
 */
export function useCssVars(
  // 函数返回一个 CSS 变量名到值的映射
  getter: (
    // vm: 组件实例的公共属性
    vm: Record<string, any>,
    // setup 函数返回的代理对象
    setupProxy: Record<string, any>
  ) => Record<string, string>
) {
  if (!inBrowser && !__TEST__) return

  const instance = currentInstance
  if (!instance) {
    __DEV__ &&
      warn(`useCssVars is called without current active component instance.`)
    return
  }

  // watchPostEffect 会在组件更新之后 (DOM 更新后) 执行回调，并且会自动追踪回调中使用的响应式依赖。
  // 当依赖变化时，回调会重新执行。
  watchPostEffect(() => {
    // 存储组件实例的根 DOM 元素
    const el = instance.$el
    const vars = getter(instance, instance._setupProxy!)
    // 元素节点 (nodeType === 1)
    if (el && el.nodeType === 1) {
      const style = (el as HTMLElement).style
      for (const key in vars) {
        style.setProperty(`--${key}`, vars[key])
      }
    }
  })
}
