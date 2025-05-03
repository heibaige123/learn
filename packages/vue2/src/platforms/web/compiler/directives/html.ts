import { addProp } from 'compiler/helpers'
import { ASTDirective, ASTElement } from 'types/compiler'

/**
 * 把 `v-html` 指令编译为设置元素 `innerHTML` 属性的代码
 * @param el 抽象语法树（AST）中的元素节点对象，代表当前正在处理的 DOM 元素。
 * @param dir 当前指令对象，包含指令名、表达式等信息。
 */
export default function html(el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    addProp(el, 'innerHTML', `_s(${dir.value})`, dir)
  }
}
