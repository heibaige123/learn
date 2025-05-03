import { addProp } from 'compiler/helpers'
import { ASTDirective, ASTElement } from 'types/compiler'

/**
 * Vue 2 模板编译阶段的一个**指令处理函数**，用于处理 `v-text` 指令。
 * @param el 抽象语法树（AST）中的元素节点对象，代表当前正在处理的 DOM 元素。
 * @param dir 当前指令对象，包含指令名、表达式等信息。
 */
export default function text(el: ASTElement, dir: ASTDirective) {
  if (dir.value) {
    // - `_s` 是模板编译生成的字符串化辅助函数（`_s = toString`），保证输出为字符串。
    // _s定义处： src/core/instance/render-helpers/index.ts
    addProp(el, 'textContent', `_s(${dir.value})`, dir)
  }
}
