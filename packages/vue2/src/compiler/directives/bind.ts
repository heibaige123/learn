import { ASTDirective, ASTElement } from 'types/compiler'

/**
 * 包装元素的 `wrapData` 方法，用于生成绑定指令的代码。
 *
 * @param el - 抽象语法树中的元素节点。
 * @param dir - 抽象语法树中的指令节点。
 */
export default function bind(el: ASTElement, dir: ASTDirective) {
  el.wrapData = (code: string) => {
    return `_b(${code},'${el.tag}',${dir.value},${
      dir.modifiers && dir.modifiers.prop ? 'true' : 'false'
    }${dir.modifiers && dir.modifiers.sync ? ',true' : ''})`
  }
}
