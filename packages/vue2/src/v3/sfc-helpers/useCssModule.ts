import { emptyObject, warn } from '../../core/util'
import { currentInstance } from '../currentInstance'

/**
 * 在组件的 setup 函数中获取 CSS Modules 对象。
 *
 * @param {string} [name='$style'] - CSS Modules 在组件实例上注入的名称。
 *                                  在 <style module> 或 <style module="customName"> 中定义。
 *                                  默认为 '$style'。
 *
 * @returns {Record<string, string>} - CSS Modules 对象，其中键是原始类名，值是编译后的、带作用域的类名。
 *                                    如果在 setup() 之外调用、找不到指定名称的模块或在全局构建中，则返回一个空对象。
 */
export function useCssModule(name = '$style'): Record<string, string> {
  /* istanbul ignore else */
  if (!__GLOBAL__) {
    if (!currentInstance) {
      __DEV__ && warn(`useCssModule must be called inside setup()`)
      return emptyObject
    }
    // 尝试从当前组件实例 (currentInstance) 上获取名为 'name' (默认为 '$style') 的属性
    // 这个属性是由 Vue 的 <style module="name"> 编译时注入的 CSS Modules 对象
    const mod = currentInstance[name]
    if (!mod) {
      __DEV__ &&
        warn(`Current instance does not have CSS module named "${name}".`)
      return emptyObject
    }
    return mod as Record<string, string>
  } else {
    if (__DEV__) {
      warn(`useCssModule() is not supported in the global build.`)
    }
    return emptyObject
  }
}
