import { parseText } from 'compiler/parser/text-parser'
import { getAndRemoveAttr, getBindingAttr, baseWarn } from 'compiler/helpers'
import { ASTElement, CompilerOptions, ModuleOptions } from 'types/compiler'

/**
 * 处理模板元素上的 class 属性，将其转换为 AST（抽象语法树）节点上的特定属性
 * @param el
 * @param options
 */
function transformNode(el: ASTElement, options: CompilerOptions) {
  const warn = options.warn || baseWarn
  const staticClass = getAndRemoveAttr(el, 'class')
  if (__DEV__ && staticClass) {
    const res = parseText(staticClass, options.delimiters)
    if (res) {
      warn(
        `class="${staticClass}": ` +
          'Interpolation inside attributes has been removed. ' +
          'Use v-bind or the colon shorthand instead. For example, ' +
          'instead of <div class="{{ val }}">, use <div :class="val">.',
        el.rawAttrsMap['class']
      )
    }
  }
  if (staticClass) {
    el.staticClass = JSON.stringify(staticClass.replace(/\s+/g, ' ').trim())
  }
  const classBinding = getBindingAttr(el, 'class', false /* getStatic */)
  if (classBinding) {
    el.classBinding = classBinding
  }
}

/**
 * 处理 class 属性的代码生成函数。它负责生成元素的 class 相关数据字符串，这些字符串将被插入到渲染函数中，用于创建虚拟 DOM 节点
 * @param el AST元素节点，包含解析后的模板元素信息
 * @returns 一个字符串，表示元素的 class 相关数据，将被拼接到渲染函数的数据对象中
 */
function genData(el: ASTElement): string {
  let data = ''
  if (el.staticClass) {
    data += `staticClass:${el.staticClass},`
  }
  if (el.classBinding) {
    data += `class:${el.classBinding},`
  }
  return data
}

export default {
  staticKeys: ['staticClass'],
  transformNode,
  genData
} as ModuleOptions
