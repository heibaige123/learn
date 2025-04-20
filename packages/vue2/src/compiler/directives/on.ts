import { warn } from 'core/util/index'
import { ASTDirective, ASTElement } from 'types/compiler'

/**
 * 处理 v-on 指令的编译逻辑。
 *
 * @param el - 抽象语法树 (AST) 的元素节点。
 * @param dir - 抽象语法树 (AST) 的指令节点，表示 v-on 指令。
 *
 * 如果在开发环境中检测到 v-on 指令没有参数但包含修饰符，会发出警告。
 * 该方法还会为元素节点添加 `wrapListeners` 方法，用于包装事件监听器代码。
 */
export default function on(el: ASTElement, dir: ASTDirective) {
  if (__DEV__ && dir.modifiers) {
    warn(`v-on without argument does not support modifiers.`)
  }
  el.wrapListeners = (code: string) => `_g(${code},${dir.value})`
}
