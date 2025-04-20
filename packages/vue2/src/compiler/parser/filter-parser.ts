/**
 * 用于匹配有效的除法字符
 * 包括字母、数字、下划线、圆括号、点号、加号、减号和方括号
 */
const validDivisionCharRE = /[\w).+\-_$\]]/

/**
 * 解析表达式中的过滤器
 * @param exp 表达式字符串
 * @returns 解析后的表达式
 *
 * @example

        <template>
          <div>
            <p>{{ message | capitalize }}</p>
          </div>
        </template>

        <script>
        export default {
          data() {
            return {
              message: 'hello world'
            }
          },
          filters: {
            capitalize(value) {
              if (!value) return ''
              return value.toString().charAt(0).toUpperCase() + value.slice(1)
            }
          }
        }
        </script>

 */
export function parseFilters(exp: string): string {
  /** 表示当前是否在单引号字符串中 */
  let inSingle = false

  /** 表示当前是否在双引号字符串中 */
  let inDouble = false

  /** 表示当前是否在模板字符串中 */
  let inTemplateString = false

  /** 表示当前是否在正则表达式中 */
  let inRegex = false

  /** 当前大括号的嵌套层级 */
  let curly = 0

  /** 当前方括号的嵌套层级 */
  let square = 0

  /** 当前圆括号的嵌套层级 */
  let paren = 0

  /** 上一个过滤器的起始索引 */
  let lastFilterIndex = 0

  /** 当前字符的 ASCII 编码 */
  let c

  /** 前一个字符的 ASCII 编码 */
  let prev

  /** 当前遍历的索引 */
  let i

  /** 表达式部分的字符串 */
  let expression

  /** 过滤器数组 */
  let filters

  for (i = 0; i < exp.length; i++) {
    prev = c
    c = exp.charCodeAt(i)
    /**
        0x22: 双引号 (")
        0x5c: 反斜杠 (\)
        0x60: 反引号 (`)
        0x7c: 竖线 (|)
        0x27: 单引号 (')
        0x2f: 斜杠 (/)
     */
    if (inSingle) {
      // 检测单引号字符串结束
      if (c === 0x27 && prev !== 0x5c) inSingle = false
    } else if (inDouble) {
      if (c === 0x22 && prev !== 0x5c) inDouble = false
    } else if (inTemplateString) {
      if (c === 0x60 && prev !== 0x5c) inTemplateString = false
    } else if (inRegex) {
      if (c === 0x2f && prev !== 0x5c) inRegex = false
    } else if (
      c === 0x7c && // pipe
      exp.charCodeAt(i + 1) !== 0x7c &&
      exp.charCodeAt(i - 1) !== 0x7c &&
      !curly &&
      !square &&
      !paren
    ) {
      if (expression === undefined) {
        // first filter, end of expression
        lastFilterIndex = i + 1
        expression = exp.slice(0, i).trim()
      } else {
        pushFilter()
      }
    } else {
      switch (c) {
        case 0x22:
          inDouble = true
          break // "
        case 0x27:
          inSingle = true
          break // '
        case 0x60:
          inTemplateString = true
          break // `
        case 0x28:
          paren++
          break // (
        case 0x29:
          paren--
          break // )
        case 0x5b:
          square++
          break // [
        case 0x5d:
          square--
          break // ]
        case 0x7b:
          curly++
          break // {
        case 0x7d:
          curly--
          break // }
      }
      if (c === 0x2f) {
        // /
        let j = i - 1
        let p
        // find first non-whitespace prev char
        for (; j >= 0; j--) {
          p = exp.charAt(j)
          if (p !== ' ') break
        }
        if (!p || !validDivisionCharRE.test(p)) {
          inRegex = true
        }
      }
    }
  }

  /** 如果表达式尚未定义 */
  if (expression === undefined) {
    /** 截取当前索引之前的字符串作为表达式 */
    expression = exp.slice(0, i).trim()
  } else if (lastFilterIndex !== 0) {
    /** 如果存在上一个过滤器，推入过滤器数组 */
    pushFilter()
  }

  /**
   * 将当前解析的过滤器表达式推入过滤器数组中。
   * 如果过滤器数组尚未初始化，则会创建一个新的数组。
   * 更新 `lastFilterIndex` 为当前过滤器的结束位置加 1。
   */
  function pushFilter() {
    ;(filters || (filters = [])).push(exp.slice(lastFilterIndex, i).trim())
    lastFilterIndex = i + 1
  }

  if (filters) {
    for (i = 0; i < filters.length; i++) {
      expression = wrapFilter(expression, filters[i])
    }
  }

  return expression
}

/**
 * 包装过滤器表达式，将表达式和过滤器组合成调用过滤器函数的字符串。
 *
 * @param exp 表达式字符串，表示需要传递给过滤器的值。
 * @param filter 过滤器字符串，可以包含过滤器名称和参数。
 * @returns 返回一个字符串，表示调用过滤器函数的表达式。
 */
function wrapFilter(exp: string, filter: string): string {
  const i = filter.indexOf('(')
  if (i < 0) {
    // _f: resolveFilter
    return `_f("${filter}")(${exp})`
  } else {
    const name = filter.slice(0, i)
    const args = filter.slice(i + 1)
    return `_f("${name}")(${exp}${args !== ')' ? ',' + args : args}`
  }
}
