/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'
import { ASTAttr, CompilerOptions } from 'types/compiler'

// Regular Expressions for parsing tags and attributes
/**
 * 用于匹配 HTML 标签中的属性的正则表达式。
 *
 * - 第一个捕获组 `([^\s"'<>\/=]+)`：匹配属性名，不能包含空白字符、引号、尖括号、斜杠或等号。
 * - 第二个捕获组 `(=)`：匹配等号，用于分隔属性名和属性值。
 * - 第三个捕获组 `(?:"([^"]*)"+)`：匹配用双引号包裹的属性值。
 * - 第四个捕获组 `|'([^']*)'+`：匹配用单引号包裹的属性值。
 * - 第五个捕获组 `([^\s"'=<>`]+)`：匹配未用引号包裹的属性值，不能包含空白字符、引号、等号、尖括号或反引号。
 *
 * 该正则表达式用于解析 HTML 标签中的属性，支持多种属性值的表示形式。
 */
const attribute =
  /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/**
 * 用于匹配动态参数属性的正则表达式。
 *
 * - 第一个捕获组 `((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)`：匹配动态参数的属性名，
 *   包括 `v-` 指令、事件绑定（`@`）、绑定语法（`:`）或插槽（`#`），并且支持方括号包裹的动态参数。
 * - 第二个捕获组 `(=)`：匹配等号，用于分隔属性名和属性值。
 * - 第三个捕获组 `(?:"([^"]*)"+)`：匹配用双引号包裹的属性值。
 * - 第四个捕获组 `|'([^']*)'+`：匹配用单引号包裹的属性值。
 * - 第五个捕获组 `([^\s"'=<>`]+)`：匹配未用引号包裹的属性值，不能包含空白字符、引号、等号、尖括号或反引号。
 *
 * 该正则表达式用于解析带有动态参数的 HTML 属性。
 */
const dynamicArgAttribute =
  /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/**
 * 表示一个匹配 XML/HTML 标签名称的正则表达式。
 * 标签名称必须以字母或下划线开头，可以包含连字符、点、数字、下划线、字母以及 Unicode 字符。
 */
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`
/**
 * 捕获合格名称的正则表达式。
 *
 * - 第一个捕获组 `((?:${ncname}\\:)?${ncname})`：
 *   匹配一个可选的命名空间前缀（由 `:` 分隔），
 *   后跟一个标签名称。
 *
 * 该正则表达式用于解析 XML/HTML 标签的名称，
 * 支持命名空间的语法。
 */
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
/**
 * 用于匹配 HTML 起始标签的正则表达式。
 *
 * - 捕获组 `^<${qnameCapture}`：匹配以 `<` 开头的标签名称，
 *   标签名称可以包含命名空间前缀（由 `:` 分隔）。
 */
const startTagOpen = new RegExp(`^<${qnameCapture}`)
/**
 * 用于匹配 HTML 起始标签的结束部分的正则表达式。
 *
 * - 捕获组 `^\s*(\/?)>`：匹配可选的斜杠 `/`（表示自闭合标签），
 *   后跟右尖括号 `>`。
 */
const startTagClose = /^\s*(\/?)>/
/**
 * 用于匹配 HTML 结束标签的正则表达式。
 *
 * - 捕获组 `^<\\/${qnameCapture}[^>]*>`：匹配以 `</` 开头的标签名称，
 *   标签名称可以包含命名空间前缀（由 `:` 分隔），后跟任意非 `>` 的字符，直到 `>` 结束。
 */
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
/**
 * 用于匹配 HTML 文档类型声明的正则表达式。
 *
 * - 匹配以 `<!DOCTYPE` 开头，后跟任意非 `>` 的字符，直到 `>` 结束。
 * - 不区分大小写。
 */
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
/**
 * 用于匹配 HTML 注释的正则表达式。
 * 它以 `<!` 开头，后跟两个连字符 `--`。
 */
const comment = /^<!\--/
/**
 * 用于匹配条件注释的正则表达式。
 * 条件注释是以 `<![` 开头的特殊注释，通常用于在 HTML 中为特定版本的 Internet Explorer 提供条件代码。
 */
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
/**
 * 判断一个元素是否为纯文本元素。
 * 纯文本元素包括：`<script>`、`<style>` 和 `<textarea>`。
 *
 * @constant
 * @param {string} key - 要检查的元素标签名。
 * @returns {boolean} 如果元素是纯文本元素，则返回 `true`，否则返回 `false`。
 */
export const isPlainTextElement = makeMap('script,style,textarea', true)
/**
 * 用于缓存正则表达式的对象。
 * 键为正则表达式的字符串形式，值为对应的正则表达式实例。
 * 通过缓存避免重复创建相同的正则表达式，提高性能。
 */
const reCache = {}

/**
 * 解码 HTML 实体的映射表。
 * 键为 HTML 实体字符串，值为对应的解码字符。
 */
const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
/**
 * 匹配 HTML 实体编码的正则表达式。
 * 该正则用于匹配以下几种常见的 HTML 实体：
 * - `&lt;` 表示小于号 `<`
 * - `&gt;` 表示大于号 `>`
 * - `&quot;` 表示双引号 `"`
 * - `&amp;` 表示符号 `&`
 * - `&#39;` 表示单引号 `'`
 */
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
/**
 * 匹配 HTML 实体编码的正则表达式，包括换行符和制表符。
 * 该正则用于匹配以下几种常见的 HTML 实体：
 * - `&lt;` 表示小于号 `<`
 * - `&gt;` 表示大于号 `>`
 * - `&quot;` 表示双引号 `"`
 * - `&amp;` 表示符号 `&`
 * - `&#39;` 表示单引号 `'`
 * - `&#10;` 表示换行符 `\n`
 * - `&#9;` 表示制表符 `\t`
 */
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
/**
 * 一个用于判断标签是否应忽略换行符的映射函数。
 *
 * 该函数通过 `makeMap` 创建，包含了需要忽略换行符的标签名称。
 * 当前支持的标签包括 `pre` 和 `textarea`。
 *
 * @example
 * isIgnoreNewlineTag('pre') // true
 * isIgnoreNewlineTag('div') // false
 */
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
/**
 * 判断是否应忽略 HTML 字符串中的第一个换行符。
 *
 * @param tag - HTML 标签名称。
 * @param html - HTML 字符串。
 * @returns 如果标签是忽略换行符的标签且 HTML 字符串以换行符开头，则返回 true；否则返回 false。
 */
const shouldIgnoreFirstNewline = (tag, html) =>
  tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

/**
 * 解码 HTML 属性值的工具函数。
 *
 * @param value - 需要解码的字符串值。
 * @param shouldDecodeNewlines - 一个布尔值，指示是否需要解码换行符。
 *   - 如果为 `true`，则会解码换行符。
 *   - 如果为 `false`，则不会解码换行符。
 * @returns 解码后的字符串。
 */
function decodeAttr(value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

/**
 * HTML解析器的选项接口，继承自CompilerOptions。
 */
export interface HTMLParserOptions extends CompilerOptions {
  /**
   * 当解析到一个开始标签时的回调函数。
   * @param tag 标签名称
   * @param attrs 标签的属性数组
   * @param unary 是否是自闭合标签
   * @param start 标签的起始位置
   * @param end 标签的结束位置
   */
  start?: (
    tag: string,
    attrs: ASTAttr[],
    unary: boolean,
    start: number,
    end: number
  ) => void

  /**
   * 当解析到一个结束标签时的回调函数。
   * @param tag 标签名称
   * @param start 标签的起始位置
   * @param end 标签的结束位置
   */
  end?: (tag: string, start: number, end: number) => void

  /**
   * 当解析到文本内容时的回调函数。
   * @param text 文本内容
   * @param start 文本的起始位置（可选）
   * @param end 文本的结束位置（可选）
   */
  chars?: (text: string, start?: number, end?: number) => void

  /**
   * 当解析到注释内容时的回调函数。
   * @param content 注释内容
   * @param start 注释的起始位置
   * @param end 注释的结束位置
   */
  comment?: (content: string, start: number, end: number) => void
}

export function parseHTML(html, options: HTMLParserOptions) {
  const stack: any[] = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      if (textEnd === 0) {
        // Comment:
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment && options.comment) {
              options.comment(
                html.substring(4, commentEnd),
                index,
                index + commentEnd + 3
              )
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // https://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag:
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            advance(1)
          }
          continue
        }
      }

      let text, rest, next
      if (textEnd >= 0) {
        rest = html.slice(textEnd)
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    } else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag =
        reCache[stackedTag] ||
        (reCache[stackedTag] = new RegExp(
          '([\\s\\S]*?)(</' + stackedTag + '[^>]*>)',
          'i'
        ))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (__DEV__ && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, {
          start: index + html.length
        })
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  function advance(n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag() {
    const start = html.match(startTagOpen)
    if (start) {
      const match: any = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      while (
        !(end = html.match(startTagClose)) &&
        (attr = html.match(dynamicArgAttribute) || html.match(attribute))
      ) {
        attr.start = index
        advance(attr[0].length)
        attr.end = index
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function handleStartTag(match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs: ASTAttr[] = new Array(l)
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      const value = args[3] || args[4] || args[5] || ''
      const shouldDecodeNewlines =
        tagName === 'a' && args[1] === 'href'
          ? options.shouldDecodeNewlinesForHref
          : options.shouldDecodeNewlines
      attrs[i] = {
        name: args[1],
        value: decodeAttr(value, shouldDecodeNewlines)
      }
      if (__DEV__ && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    if (!unary) {
      stack.push({
        tag: tagName,
        lowerCasedTag: tagName.toLowerCase(),
        attrs: attrs,
        start: match.start,
        end: match.end
      })
      lastTag = tagName
    }

    if (options.start) {
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag(tagName?: any, start?: any, end?: any) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        if (__DEV__ && (i > pos || !tagName) && options.warn) {
          options.warn(`tag <${stack[i].tag}> has no matching end tag.`, {
            start: stack[i].start,
            end: stack[i].end
          })
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
