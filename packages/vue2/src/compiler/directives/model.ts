import { ASTElement, ASTModifiers } from 'types/compiler'

/**
 * Cross-platform code generation for component v-model
 */
/**
 * 生成组件的 v-model 代码
 * @param el 抽象语法树元素
 * @param value v-model 绑定的值
 * @param modifiers 修饰符
 */
export function genComponentModel(
  el: ASTElement,
  value: string,
  modifiers: ASTModifiers | null
): void {
  /** 是否有 number 修饰符 */
  const { number, trim } = modifiers || {}

  /** 基础值表达式 */
  const baseValueExpression = '$$v'
  /** 最终值表达式 */
  let valueExpression = baseValueExpression
  if (trim) {
    /** 如果有 trim 修饰符，去除字符串两端空格 */
    valueExpression =
      `(typeof ${baseValueExpression} === 'string'` +
      `? ${baseValueExpression}.trim()` +
      `: ${baseValueExpression})`
  }
  if (number) {
    /** 如果有 number 修饰符，将值转换为数字 */
    valueExpression = `_n(${valueExpression})`
  }
  /** 生成赋值代码 */
  const assignment = genAssignmentCode(value, valueExpression)

  /** 为元素添加 model 属性 */
  el.model = {
    /** v-model 绑定的值 */
    value: `(${value})`,
    /** 表达式字符串 */
    expression: JSON.stringify(value),
    /** 回调函数 */
    callback: `function (${baseValueExpression}) {${assignment}}`
  }
}

/**
 * Cross-platform codegen helper for generating v-model value assignment code.
 */
/**
 * 生成 v-model 值的赋值代码
 * @param value v-model 绑定的值
 * @param assignment 赋值表达式
 * @returns 生成的赋值代码字符串
 */
export function genAssignmentCode(value: string, assignment: string): string {
  /** 解析 v-model 表达式的结果 */
  const res = parseModel(value)
  if (res.key === null) {
    /** 如果没有 key，直接生成赋值表达式 */
    return `${value}=${assignment}`
  } else {
    /** 如果有 key，使用 $set 方法生成赋值代码 */
    return `$set(${res.exp}, ${res.key}, ${assignment})`
  }
}

/**
 * Parse a v-model expression into a base path and a final key segment.
 * Handles both dot-path and possible square brackets.
 *
 * Possible cases:
 *
 * - test
 * - test[key]
 * - test[test1[key]]
 * - test["a"][key]
 * - xxx.test[a[a].test1[key]]
 * - test.xxx.a["asa"][test1[key]]
 *
 */

/** 表达式的长度 */
let len: number

/** 表达式的字符串 */
let str: string

/** 当前字符 */
let chr: number

/** 当前索引 */
let index: number

/** 表达式的起始位置 */
let expressionPos: number

/** 表达式的结束位置 */
let expressionEndPos: number

/**
 * v-model 表达式解析结果的类型
 */
type ModelParseResult = {
  /** 表达式的基础路径 */
  exp: string
  /** 表达式的最终键段，可以为 null */
  key: string | null
}

/**
 * 解析 v-model 表达式
 * @param val v-model 表达式字符串
 * @returns 解析结果，包含基础路径和最终键段
 */
export function parseModel(val: string): ModelParseResult {
  /** 去除表达式两端的空格 */
  val = val.trim()
  /** 表达式的长度 */
  len = val.length

  /** 如果表达式中没有方括号，或者方括号不在末尾 */
  if (val.indexOf('[') < 0 || val.lastIndexOf(']') < len - 1) {
    /** 最后一个点号的索引 */
    index = val.lastIndexOf('.')
    if (index > -1) {
      /** 返回基础路径和键段 */
      return {
        /** 基础路径 */
        exp: val.slice(0, index),
        /** 键段 */
        key: '"' + val.slice(index + 1) + '"'
      }
    } else {
      /** 如果没有点号，返回整个表达式作为基础路径 */
      return {
        /** 基础路径 */
        exp: val,
        /** 键段为空 */
        key: null
      }
    }
  }

  /** 表达式字符串 */
  str = val
  /** 初始化索引和位置 */
  index = expressionPos = expressionEndPos = 0

  /** 遍历表达式字符串 */
  while (!eof()) {
    /** 当前字符 */
    chr = next()
    /** 如果是字符串的开始 */
    if (isStringStart(chr)) {
      parseString(chr)
    } else if (chr === 0x5b) {
      /** 如果是方括号的开始 */
      parseBracket(chr)
    }
  }

  /** 返回解析结果 */
  return {
    /** 基础路径 */
    exp: val.slice(0, expressionPos),
    /** 键段 */
    key: val.slice(expressionPos + 1, expressionEndPos)
  }
}

/**
 * 获取下一个字符的 Unicode 编码
 * @returns 当前字符的 Unicode 编码
 */
function next(): number {
  /** 当前索引位置的字符 */
  return str.charCodeAt(++index)
}

/**
 * 检查是否已到达输入的末尾。
 * @returns 如果当前索引已达到或超过输入的长度，则返回 true；否则返回 false。
 */
function eof(): boolean {
  return index >= len
}

/**
 * 检查字符是否为字符串的起始字符
 * @param chr 当前字符的 Unicode 编码
 * @returns 如果是双引号或单引号，则返回 true；否则返回 false
 */
function isStringStart(chr: number): boolean {
  /** 双引号或单引号的 Unicode 编码 */
  return chr === 0x22 || chr === 0x27
}

/**
 * 解析方括号表达式
 * @param chr 当前字符的 Unicode 编码
 */
function parseBracket(chr: number): void {
  /** 方括号嵌套层级 */
  let inBracket = 1
  /** 表达式的起始位置 */
  expressionPos = index
  while (!eof()) {
    /** 当前字符的 Unicode 编码 */
    chr = next()
    if (isStringStart(chr)) {
      parseString(chr)
      continue
    }
    if (chr === 0x5b) inBracket++
    if (chr === 0x5d) inBracket--
    if (inBracket === 0) {
      /** 表达式的结束位置 */
      expressionEndPos = index
      break
    }
  }
}

/**
 * 解析字符串
 * @param chr 当前字符的 Unicode 编码
 */
function parseString(chr: number): void {
  /** 字符串的引号类型 */
  const stringQuote = chr
  while (!eof()) {
    /** 当前字符的 Unicode 编码 */
    chr = next()
    if (chr === stringQuote) {
      break
    }
  }
}
