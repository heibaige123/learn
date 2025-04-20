import { ASTElement, ASTNode } from 'types/compiler'
import { dirRE, onRE } from './parser/index'

/**
 * 表示一个范围的类型，包含可选的开始位置和结束位置。
 * - `start`：范围的起始位置（可选）。
 * - `end`：范围的结束位置（可选）。
 */
type Range = { start?: number; end?: number }

// these keywords should not appear inside expressions, but operators like
// typeof, instanceof and in are allowed
/**
 * 一个正则表达式，用于匹配 JavaScript 中的保留关键字。
 * 这些关键字包括控制流语句（如 if、for、while 等）、声明语句（如 let、const、var 等）、
 * 类相关关键字（如 class、extends、super 等）、模块相关关键字（如 import、export 等）、
 * 以及其他常见的保留字（如 return、function、arguments 等）。
 *
 * 匹配的关键字会以单词边界（\b）为界，确保只匹配完整的关键字，而不会误匹配部分单词。
 */
const prohibitedKeywordRE = new RegExp(
  '\\b' +
    (
      'do,if,for,let,new,try,var,case,else,with,await,break,catch,class,const,' +
      'super,throw,while,yield,delete,export,import,return,switch,default,' +
      'extends,finally,continue,debugger,function,arguments'
    )
      .split(',')
      .join('\\b|\\b') +
    '\\b'
)

// these unary operators should not be used as property/method names
/**
 * 用于匹配一元操作符的正则表达式。
 * 该正则表达式会匹配以下一元操作符：`delete`、`typeof` 和 `void`，
 * 并且它们后面可以跟随一个括号包裹的表达式。
 *
 * 例如：
 * - `delete obj.prop`
 * - `typeof (someVar)`
 * - `void (0)`
 */
const unaryOperatorsRE = new RegExp(
  '\\b' +
    'delete,typeof,void'.split(',').join('\\s*\\([^\\)]*\\)|\\b') +
    '\\s*\\([^\\)]*\\)'
)

// strip strings in expressions
/**
 * 用于匹配和剥离字符串字面量的正则表达式。
 * 支持单引号字符串、双引号字符串、模板字符串（包括嵌套的模板表达式）。
 * - 单引号字符串：如 `'example'`
 * - 双引号字符串：如 `"example"`
 * - 模板字符串：如 `` `example` `` 或包含嵌套表达式的 `` `example ${value}` ``
 *
 * 该正则表达式主要用于在代码分析或处理过程中忽略字符串字面量的内容。
 */
const stripStringRE =
  /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`/g

// detect problematic expressions in a template
/**
 * 检测抽象语法树 (AST) 中的错误。
 *
 * @param ast - 抽象语法树的根节点，可能为未定义。
 * @param warn - 用于记录警告信息的回调函数。
 */
export function detectErrors(ast: ASTNode | undefined, warn: Function) {
  if (ast) {
    checkNode(ast, warn)
  }
}

/**
 * 检查 AST 节点的属性和表达式是否符合预期规则。
 *
 * @param node - 当前需要检查的 AST 节点。
 * @param warn - 用于报告警告的函数。
 */
function checkNode(node: ASTNode, warn: Function) {
  /**
   * 如果节点类型为 1（元素节点），则检查其属性。
   */
  if (node.type === 1) {
    /**
     * 遍历节点的属性映射表，检查是否包含指令。
     */
    for (const name in node.attrsMap) {
      /**
       * 如果属性名匹配指令正则表达式，则进一步检查其值。
       */
      if (dirRE.test(name)) {
        const value = node.attrsMap[name]
        if (value) {
          const range = node.rawAttrsMap[name]
          /**
           * 检查 v-for 指令。
           */
          if (name === 'v-for') {
            checkFor(node, `v-for="${value}"`, warn, range)
          }
          /**
           * 检查 v-slot 或 # 开头的指令。
           */
          else if (name === 'v-slot' || name[0] === '#') {
            checkFunctionParameterExpression(
              value,
              `${name}="${value}"`,
              warn,
              range
            )
          }
          /**
           * 检查事件绑定指令。
           */
          else if (onRE.test(name)) {
            checkEvent(value, `${name}="${value}"`, warn, range)
          }
          /**
           * 检查普通表达式。
           */
          else {
            checkExpression(value, `${name}="${value}"`, warn, range)
          }
        }
      }
    }
    /**
     * 如果节点有子节点，则递归检查子节点。
     */
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        checkNode(node.children[i], warn)
      }
    }
  }
  /**
   * 如果节点类型为 2（表达式节点），则检查其表达式。
   */
  else if (node.type === 2) {
    checkExpression(node.expression, node.text, warn, node)
  }
}

/**
 * 检查事件表达式是否包含不合法的 JavaScript 一元操作符作为属性名。
 *
 * @param exp 表达式字符串，需要检查的事件表达式。
 * @param text 原始文本字符串，用于在警告信息中提供上下文。
 * @param warn 警告函数，用于输出警告信息。
 * @param range 可选参数，表示表达式的范围，用于提供更精确的警告信息。
 */
function checkEvent(exp: string, text: string, warn: Function, range?: Range) {
  const stripped = exp.replace(stripStringRE, '')
  const keywordMatch: any = stripped.match(unaryOperatorsRE)
  if (keywordMatch && stripped.charAt(keywordMatch.index - 1) !== '$') {
    warn(
      `avoid using JavaScript unary operator as property name: ` +
        `"${keywordMatch[0]}" in expression ${text.trim()}`,
      range
    )
  }
  checkExpression(exp, text, warn, range)
}

/**
 * 检查 v-for 表达式的合法性。
 * @param node AST 节点，包含 v-for 的相关信息。
 * @param text 当前处理的模板字符串。
 * @param warn 用于报告警告的函数。
 * @param range 可选参数，表示模板中 v-for 的范围。
 */
function checkFor(
  /** AST 节点，包含 v-for 的相关信息。 */
  node: ASTElement,
  /** 当前处理的模板字符串。 */
  text: string,
  /** 用于报告警告的函数。 */
  warn: Function,
  /** 可选参数，表示模板中 v-for 的范围。 */
  range?: Range
) {
  checkExpression(node.for || '', text, warn, range)
  checkIdentifier(node.alias, 'v-for alias', text, warn, range)
  checkIdentifier(node.iterator1, 'v-for iterator', text, warn, range)
  checkIdentifier(node.iterator2, 'v-for iterator', text, warn, range)
}

/**
 * 检查标识符是否合法。
 * @param ident 标识符字符串，可以为 null 或 undefined。
 */
function checkIdentifier(
  ident: string | null | undefined,
  /**
   * 标识符的类型，用于描述标识符的用途。
   */
  type: string,
  /**
   * 表达式的文本内容，用于提供上下文信息。
   */
  text: string,
  /**
   * 警告函数，用于报告无效标识符。
   */
  warn: Function,
  /**
   * 可选的范围对象，用于标识错误的具体位置。
   */
  range?: Range
) {
  if (typeof ident === 'string') {
    try {
      new Function(`var ${ident}=_`)
    } catch (e: any) {
      warn(`invalid ${type} "${ident}" in expression: ${text.trim()}`, range)
    }
  }
}

/**
 * 检查表达式的合法性。
 *
 * @param exp 表达式字符串，需要检查的内容。
 * @param text 原始文本字符串，用于在警告信息中提供上下文。
 * @param warn 警告函数，用于输出警告信息。
 * @param range 可选参数，表示表达式的范围，用于提供更精确的警告信息。
 */
function checkExpression(
  /** 表达式字符串，需要检查的内容。 */
  exp: string,
  /** 原始文本字符串，用于在警告信息中提供上下文。 */
  text: string,
  /** 警告函数，用于输出警告信息。 */
  warn: Function,
  /** 可选参数，表示表达式的范围，用于提供更精确的警告信息。 */
  range?: Range
) {
  try {
    new Function(`return ${exp}`)
  } catch (e: any) {
    const keywordMatch = exp
      .replace(stripStringRE, '')
      .match(prohibitedKeywordRE)
    if (keywordMatch) {
      warn(
        `avoid using JavaScript keyword as property name: ` +
          `"${keywordMatch[0]}"\n  Raw expression: ${text.trim()}`,
        range
      )
    } else {
      warn(
        `invalid expression: ${e.message} in\n\n` +
          `    ${exp}\n\n` +
          `  Raw expression: ${text.trim()}\n`,
        range
      )
    }
  }
}

/**
 * @param exp 表达式字符串，用于创建函数的参数部分。
 * @param text 原始表达式字符串，用于在警告信息中显示。
 * @param warn 警告函数，用于输出错误信息。
 * @param range 可选参数，表示错误发生的范围。
 */
function checkFunctionParameterExpression(
  exp: string,
  text: string,
  warn: Function,
  range?: Range
) {
  try {
    new Function(exp, '')
  } catch (e: any) {
    warn(
      `invalid function parameter expression: ${e.message} in\n\n` +
        `    ${exp}\n\n` +
        `  Raw expression: ${text.trim()}\n`,
      range
    )
  }
}
