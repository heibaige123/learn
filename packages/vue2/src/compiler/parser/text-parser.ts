import { cached } from 'shared/util'
import { parseFilters } from './filter-parser'

/**
 * 默认的模板语法正则表达式，用于匹配双大括号语法（如 {{ expression }}）。
 * - `\{\{` 和 `\}\}`：匹配双大括号的起始和结束部分。
 * - `((?:.|\r?\n)+?)`：匹配大括号中的内容，支持任意字符，包括换行符。
 * - `g`：全局匹配标志，表示会匹配所有符合条件的内容。
 */
const defaultTagRE = /\{\{((?:.|\r?\n)+?)\}\}/g
/**
 * 用于匹配需要在正则表达式中转义的特殊字符的正则表达式。
 * 包括以下字符：- . * + ? ^ $ { } ( ) | [ ] / \
 */
const regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g

/**
 * 构建一个正则表达式，用于匹配指定分隔符之间的内容。
 * @param delimiters 分隔符数组，其中第一个元素是起始分隔符，第二个元素是结束分隔符。
 * @returns 一个正则表达式，用于匹配分隔符之间的内容。
 */
const buildRegex = cached(delimiters => {
  const open = delimiters[0].replace(regexEscapeRE, '\\$&')
  const close = delimiters[1].replace(regexEscapeRE, '\\$&')
  return new RegExp(open + '((?:.|\\n)+?)' + close, 'g')
})

/**
 * 表示文本解析的结果。
 *
 * @property expression 表达式字符串，表示解析后的文本内容。
 * @property tokens 一个数组，包含字符串或对象，表示解析后的文本片段。
 * 对象形式的片段中，`@binding` 表示绑定的表达式。
 */
type TextParseResult = {
  expression: string
  tokens: Array<string | { '@binding': string }>
}

/**
 * 文本解析函数，用于解析带有分隔符的文本。
 * @param text 输入的文本字符串
 * @param delimiters 可选的分隔符数组，包含起始和结束分隔符
 * @returns 如果文本中包含分隔符，返回解析结果；否则返回 void
 */
export function parseText(
  /**
   * 输入的文本字符串
   */
  text: string,
  /**
   * 可选的分隔符数组，包含起始和结束分隔符
   */
  delimiters?: [string, string]
): TextParseResult | void {
  //@ts-expect-error
  const tagRE = delimiters ? buildRegex(delimiters) : defaultTagRE
  if (!tagRE.test(text)) {
    return
  }
  /**
   * 存储解析后的文本令牌
   */
  const tokens: string[] = []
  /**
   * 存储原始的文本令牌
   */
  const rawTokens: any[] = []
  /**
   * 上一次匹配结束的索引
   */
  let lastIndex = (tagRE.lastIndex = 0)
  let match, index, tokenValue
  while ((match = tagRE.exec(text))) {
    index = match.index
    // push text token
    if (index > lastIndex) {
      rawTokens.push((tokenValue = text.slice(lastIndex, index)))
      tokens.push(JSON.stringify(tokenValue))
    }
    // tag token
    /**
     * 解析过滤器表达式
     */
    const exp = parseFilters(match[1].trim())
    tokens.push(`_s(${exp})`)
    rawTokens.push({ '@binding': exp })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    rawTokens.push((tokenValue = text.slice(lastIndex)))
    tokens.push(JSON.stringify(tokenValue))
  }
  return {
    /**
     * 表达式字符串，由解析后的令牌拼接而成
     */
    expression: tokens.join('+'),
    /**
     * 包含原始令牌和绑定信息的数组
     */
    tokens: rawTokens
  }
}
