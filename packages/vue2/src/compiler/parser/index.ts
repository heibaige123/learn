import he from 'he'
import { parseHTML } from './html-parser'
import { parseText } from './text-parser'
import { parseFilters } from './filter-parser'
import { genAssignmentCode } from '../directives/model'
import { extend, cached, no, camelize, hyphenate } from 'shared/util'
import { isIE, isEdge, isServerRendering } from 'core/util/env'

import {
  addProp,
  addAttr,
  baseWarn,
  addHandler,
  addDirective,
  getBindingAttr,
  getAndRemoveAttr,
  getRawBindingAttr,
  pluckModuleFunction,
  getAndRemoveAttrByRegex
} from '../helpers'

import {
  ASTAttr,
  ASTElement,
  ASTIfCondition,
  ASTNode,
  ASTText,
  CompilerOptions
} from 'types/compiler'

/** 匹配以 @ 或 v-on: 开头的事件绑定 */
export const onRE = /^@|^v-on:/
/**
 * 一个正则表达式，用于匹配 Vue 指令的前缀。
 * 如果环境变量 `VBIND_PROP_SHORTHAND` 被设置，则支持 `.prop` 的简写语法。
 * 匹配的前缀包括：
 * - `v-`：Vue 指令的标准前缀
 * - `@`：事件绑定
 * - `:`：属性绑定
 * - `.`：属性绑定的 `.prop` 简写（仅在 `VBIND_PROP_SHORTHAND` 启用时）
 * - `#`：插槽绑定
 */
export const dirRE = process.env.VBIND_PROP_SHORTHAND
  ? /^v-|^@|^:|^\.|^#/
  : /^v-|^@|^:|^#/
/**
 * 一个正则表达式，用于匹配 v-for 指令中的别名和迭代目标。
 * 它会捕获别名部分和 in/of 后的迭代目标部分。
 */
export const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
/**
 * 匹配 v-for 指令中的迭代器部分。
 * 捕获两个可能的迭代器变量。
 */
export const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/

/**
 * 匹配并移除括号的正则表达式。
 * 用于去除表达式中的括号。
 */
const stripParensRE = /^\(|\)$/g

/**
 * 匹配动态参数的正则表达式。
 * 动态参数以方括号包裹，例如：[key]。
 */
const dynamicArgRE = /^\[.*\]$/

/**
 * 匹配指令参数的正则表达式。
 * 用于提取冒号后面的部分。
 */
const argRE = /:(.*)$/

/**
 * 匹配 v-bind 指令的正则表达式。
 * 包括 :、. 和 v-bind: 的形式。
 */
export const bindRE = /^:|^\.|^v-bind:/

/**
 * 匹配 .prop 修饰符的正则表达式。
 * 用于检测属性绑定的 .prop 简写。
 */
const propBindRE = /^\./

/**
 * 匹配修饰符的正则表达式。
 * 修饰符以 . 开头，后接非 . 或 ] 的字符。
 */
const modifierRE = /\.[^.\]]+(?=[^\]]*$)/g

/**
 * 匹配 v-slot 指令的正则表达式。
 * 包括 v-slot: 和 # 的形式。
 */
export const slotRE = /^v-slot(:|$)|^#/

/**
 * 匹配换行符的正则表达式。
 * 用于检测文本中的换行符。
 */
const lineBreakRE = /[\r\n]/

/**
 * 匹配空白字符的正则表达式。
 * 包括空格、制表符、换行符等。
 */
const whitespaceRE = /[ \f\t\r\n]+/g

/**
 * 匹配无效属性名的正则表达式。
 * 无效属性名包含空格、引号、尖括号、斜杠或等号。
 */
const invalidAttributeRE = /[\s"'<>\/=]/

/**
 * 缓存 HTML 解码结果的函数。
 * 使用 he 库解码 HTML 实体。
 */
const decodeHTMLCached = cached(he.decode)

/**
 * 空的插槽作用域标记。
 * 用于标记没有作用域的插槽。
 */
export const emptySlotScopeToken = `_empty_`

// configurable state
/** 警告函数，用于输出警告信息 */
export let warn: any

/** 分隔符，用于解析文本中的插值表达式 */
let delimiters

/** 转换节点的函数数组 */
let transforms

/** 预处理节点的函数数组 */
let preTransforms

/** 后处理节点的函数数组 */
let postTransforms

/** 判断是否为 pre 标签的函数 */
let platformIsPreTag

/** 判断是否必须使用 prop 绑定的函数 */
let platformMustUseProp

/** 获取标签命名空间的函数 */
let platformGetTagNamespace

/** 判断是否为组件的函数 */
let maybeComponent

/**
 * 创建一个抽象语法树（AST）元素
 * @param tag 标签名称
 * @param attrs 属性列表
 * @param parent 父级 AST 元素
 * @returns AST 元素对象
 */
export function createASTElement(
  tag: string,
  attrs: Array<ASTAttr>,
  parent: ASTElement | void
): ASTElement {
  /** 元素类型，1 表示普通元素 */
  const type = 1

  /** 属性映射表，将属性列表转换为键值对形式 */
  const attrsMap = makeAttrsMap(attrs)

  /** 原始属性映射表，初始化为空对象 */
  const rawAttrsMap = {}

  /** 子节点列表，初始化为空数组 */
  const children: ASTNode[] = []

  return {
    type,
    tag,
    attrsList: attrs,
    attrsMap,
    rawAttrsMap,
    parent,
    children
  }
}

/**
 * Convert HTML string to AST.
 */
/**
 * 将 HTML 字符串解析为抽象语法树（AST）。
 * @param template HTML 模板字符串
 * @param options 编译器选项
 * @returns AST 根元素
 */
export function parse(template: string, options: CompilerOptions): ASTElement {
  /** 警告函数 */
  warn = options.warn || baseWarn

  /** 判断是否为 pre 标签的函数 */
  platformIsPreTag = options.isPreTag || no
  /** 判断是否必须使用 prop 绑定的函数 */
  platformMustUseProp = options.mustUseProp || no
  /** 获取标签命名空间的函数 */
  platformGetTagNamespace = options.getTagNamespace || no
  /** 判断是否为保留标签的函数 */
  const isReservedTag = options.isReservedTag || no
  /** 判断是否为组件的函数 */
  maybeComponent = (el: ASTElement) =>
    !!(
      el.component ||
      el.attrsMap[':is'] ||
      el.attrsMap['v-bind:is'] ||
      !(el.attrsMap.is ? isReservedTag(el.attrsMap.is) : isReservedTag(el.tag))
    )
  /** 转换节点的函数数组 */
  transforms = pluckModuleFunction(options.modules, 'transformNode')
  /** 预处理节点的函数数组 */
  preTransforms = pluckModuleFunction(options.modules, 'preTransformNode')
  /** 后处理节点的函数数组 */
  postTransforms = pluckModuleFunction(options.modules, 'postTransformNode')

  /** 分隔符，用于解析文本中的插值表达式 */
  delimiters = options.delimiters

  /** 节点栈 */
  const stack: any[] = []
  /** 是否保留空白字符 */
  const preserveWhitespace = options.preserveWhitespace !== false
  /** 空白字符处理选项 */
  const whitespaceOption = options.whitespace
  /** AST 根节点 */
  let root
  /** 当前父节点 */
  let currentParent
  /** 是否在 v-pre 指令中 */
  let inVPre = false
  /** 是否在 pre 标签中 */
  let inPre = false
  /** 是否已发出警告 */
  let warned = false

  /**
   * 发出一次性警告
   * @param msg 警告信息
   * @param range 警告范围
   */
  function warnOnce(msg, range) {
    if (!warned) {
      warned = true
      warn(msg, range)
    }
  }

  /**
   * 关闭元素
   * @param element 要关闭的元素
   */
  function closeElement(element) {
    trimEndingWhitespace(element)
    if (!inVPre && !element.processed) {
      element = processElement(element, options)
    }
    // 树结构管理
    if (!stack.length && element !== root) {
      // 允许根元素使用 v-if、v-else-if 和 v-else
      if (root.if && (element.elseif || element.else)) {
        if (__DEV__) {
          checkRootConstraints(element)
        }
        addIfCondition(root, {
          exp: element.elseif,
          block: element
        })
      } else if (__DEV__) {
        warnOnce(
          `组件模板应包含一个根元素。如果在多个元素上使用 v-if，请使用 v-else-if 将它们链接起来。`,
          { start: element.start }
        )
      }
    }
    if (currentParent && !element.forbidden) {
      if (element.elseif || element.else) {
        processIfConditions(element, currentParent)
      } else {
        if (element.slotScope) {
          // 作用域插槽
          const name = element.slotTarget || '"default"'
          ;(currentParent.scopedSlots || (currentParent.scopedSlots = {}))[
            name
          ] = element
        }
        currentParent.children.push(element)
        element.parent = currentParent
      }
    }

    // 清理子节点
    element.children = element.children.filter(c => !c.slotScope)
    trimEndingWhitespace(element)

    // 检查 pre 状态
    if (element.pre) {
      inVPre = false
    }
    if (platformIsPreTag(element.tag)) {
      inPre = false
    }
    // 应用后处理函数
    for (let i = 0; i < postTransforms.length; i++) {
      postTransforms[i](element, options)
    }
  }

  /**
   * 修剪元素末尾的空白字符
   * @param el 要修剪的元素
   */
  function trimEndingWhitespace(el) {
    if (!inPre) {
      let lastNode
      while (
        (lastNode = el.children[el.children.length - 1]) &&
        lastNode.type === 3 &&
        lastNode.text === ' '
      ) {
        el.children.pop()
      }
    }
  }

  /**
   * 检查根节点的约束条件
   * @param el 根节点
   */
  function checkRootConstraints(el) {
    if (el.tag === 'slot' || el.tag === 'template') {
      warnOnce(
        `不能使用 <${el.tag}> 作为组件根元素，因为它可能包含多个节点。`,
        { start: el.start }
      )
    }
    if (el.attrsMap.hasOwnProperty('v-for')) {
      warnOnce(
        '不能在有状态组件的根元素上使用 v-for，因为它会渲染多个元素。',
        el.rawAttrsMap['v-for']
      )
    }
  }

  /** 解析 HTML 字符串 */
  parseHTML(template, {
    /** 警告函数 */
    warn,
    /** 是否期望 HTML 格式 */
    expectHTML: options.expectHTML,
    /** 判断是否为一元标签的函数 */
    isUnaryTag: options.isUnaryTag,
    /** 判断标签是否可以省略闭合标签的函数 */
    canBeLeftOpenTag: options.canBeLeftOpenTag,
    /** 是否需要解码换行符 */
    shouldDecodeNewlines: options.shouldDecodeNewlines,
    /** 是否需要为 href 解码换行符 */
    shouldDecodeNewlinesForHref: options.shouldDecodeNewlinesForHref,
    /** 是否保留注释 */
    shouldKeepComment: options.comments,
    /** 是否输出源码范围 */
    outputSourceRange: options.outputSourceRange,
    start(tag, attrs, unary, start, end) {
      /** 当前命名空间 */
      const ns =
        (currentParent && currentParent.ns) || platformGetTagNamespace(tag)

      // 处理 IE SVG 问题
      /* istanbul ignore if */
      if (isIE && ns === 'svg') {
        attrs = guardIESVGBug(attrs)
      }

      /** 当前元素 */
      let element: ASTElement = createASTElement(tag, attrs, currentParent)
      if (ns) {
        element.ns = ns
      }

      if (__DEV__) {
        if (options.outputSourceRange) {
          element.start = start
          element.end = end
          element.rawAttrsMap = element.attrsList.reduce((cumulated, attr) => {
            cumulated[attr.name] = attr
            return cumulated
          }, {})
        }
        attrs.forEach(attr => {
          if (invalidAttributeRE.test(attr.name)) {
            warn(
              `无效的动态参数表达式：属性名不能包含空格、引号、<、>、/ 或 =。`,
              options.outputSourceRange
                ? {
                    start: attr.start! + attr.name.indexOf(`[`),
                    end: attr.start! + attr.name.length
                  }
                : undefined
            )
          }
        })
      }

      if (isForbiddenTag(element) && !isServerRendering()) {
        element.forbidden = true
        __DEV__ &&
          warn(
            '模板应仅负责将状态映射到 UI。避免在模板中放置具有副作用的标签，例如 ' +
              `<${tag}>` +
              '，因为它们不会被解析。',
            { start: element.start }
          )
      }

      // 应用预处理函数
      for (let i = 0; i < preTransforms.length; i++) {
        element = preTransforms[i](element, options) || element
      }

      if (!inVPre) {
        processPre(element)
        if (element.pre) {
          inVPre = true
        }
      }
      if (platformIsPreTag(element.tag)) {
        inPre = true
      }
      if (inVPre) {
        processRawAttrs(element)
      } else if (!element.processed) {
        // 结构性指令
        processFor(element)
        processIf(element)
        processOnce(element)
      }

      if (!root) {
        root = element
        if (__DEV__) {
          checkRootConstraints(root)
        }
      }

      if (!unary) {
        currentParent = element
        stack.push(element)
      } else {
        closeElement(element)
      }
    },

    /**
     * 结束标签的处理函数。
     *
     * @param tag - 结束的标签名称。
     * @param start - 结束标签的起始位置。
     * @param end - 结束标签的结束位置。
     */
    end(tag, start, end) {
      const element = stack[stack.length - 1]
      // 弹出栈
      stack.length -= 1
      currentParent = stack[stack.length - 1]
      if (__DEV__ && options.outputSourceRange) {
        element.end = end
      }
      closeElement(element)
    },

    /**
     * 处理文本节点的内容。
     *
     * @param text 文本内容。
     * @param start 文本在模板中的起始位置（可选）。
     * @param end 文本在模板中的结束位置（可选）。
     *
     * 如果当前没有父节点（`currentParent`），会根据开发环境输出警告信息。
     * 对于 IE 浏览器中的 `textarea` 占位符问题，会直接返回。
     * 根据上下文环境（如 `inPre`、`whitespaceOption` 等），对文本进行处理。
     * 如果文本有效，会创建一个 AST 节点并添加到父节点的子节点列表中。
     */
    chars(text: string, start?: number, end?: number) {
      if (!currentParent) {
        if (__DEV__) {
          if (text === template) {
            warnOnce('组件模板需要一个根元素，而不是仅仅是文本。', { start })
          } else if ((text = text.trim())) {
            warnOnce(`文本 "${text}" 在根元素外部将被忽略。`, {
              start
            })
          }
        }
        return
      }
      // IE textarea 占位符问题
      /* istanbul ignore if */
      if (
        isIE &&
        currentParent.tag === 'textarea' &&
        currentParent.attrsMap.placeholder === text
      ) {
        return
      }
      const children = currentParent.children
      if (inPre || text.trim()) {
        text = isTextTag(currentParent)
          ? text
          : (decodeHTMLCached(text) as string)
      } else if (!children.length) {
        // 删除开标签后的仅空白节点
        text = ''
      } else if (whitespaceOption) {
        if (whitespaceOption === 'condense') {
          // 在压缩模式下，如果包含换行符则删除空白节点，否则压缩为单个空格
          text = lineBreakRE.test(text) ? '' : ' '
        } else {
          text = ' '
        }
      } else {
        text = preserveWhitespace ? ' ' : ''
      }
      if (text) {
        if (!inPre && whitespaceOption === 'condense') {
          // 将连续的空白字符压缩为单个空格
          text = text.replace(whitespaceRE, ' ')
        }
        let res
        let child: ASTNode | undefined
        if (!inVPre && text !== ' ' && (res = parseText(text, delimiters))) {
          child = {
            type: 2,
            expression: res.expression,
            tokens: res.tokens,
            text
          }
        } else if (
          text !== ' ' ||
          !children.length ||
          children[children.length - 1].text !== ' '
        ) {
          child = {
            type: 3,
            text
          }
        }
        if (child) {
          if (__DEV__ && options.outputSourceRange) {
            child.start = start
            child.end = end
          }
          children.push(child)
        }
      }
    },

    /**
     *
     * @param text 表示一个注释节点的文本内容
     * @param start 注释节点的起始位置
     * @param end  注释节点的结束位置
     */
    comment(text: string, start, end) {
      // 禁止将任何内容作为根节点的兄弟节点
      // 注释仍然应该被允许，但会被忽略
      if (currentParent) {
        /**
         * 表示一个注释节点的 AST 对象
         */
        const child: ASTText = {
          type: 3,
          text,
          isComment: true
        }
        if (__DEV__ && options.outputSourceRange) {
          /**
           * 注释节点的起始位置
           */
          child.start = start
          /**
           * 注释节点的结束位置
           */
          child.end = end
        }
        currentParent.children.push(child)
      }
    }
  })
  return root
}

/**
 * 处理元素的 `v-pre` 属性。
 * 如果元素存在 `v-pre` 属性，则从元素中移除该属性并将 `el.pre` 设置为 `true`。
 *
 * @param el - 当前正在处理的元素对象
 */
function processPre(el) {
  if (getAndRemoveAttr(el, 'v-pre') != null) {
    el.pre = true
  }
}

/**
 * 处理原始属性列表，将其转换为 AST 属性数组。
 * @param el 当前正在处理的元素对象
 */
function processRawAttrs(el) {
  /** 属性列表 */
  const list = el.attrsList
  /** 属性列表的长度 */
  const len = list.length
  if (len) {
    /** 转换后的 AST 属性数组 */
    const attrs: Array<ASTAttr> = (el.attrs = new Array(len))
    for (let i = 0; i < len; i++) {
      attrs[i] = {
        /** 属性名称 */
        name: list[i].name,
        /** 属性值，转换为 JSON 字符串 */
        value: JSON.stringify(list[i].value)
      }
      if (list[i].start != null) {
        /** 属性的起始位置 */
        attrs[i].start = list[i].start
        /** 属性的结束位置 */
        attrs[i].end = list[i].end
      }
    }
  } else if (!el.pre) {
    /** 如果不是 pre 块中的根节点且没有属性，则标记为普通元素 */
    el.plain = true
  }
}

/**
 * 处理 AST 元素的主要方法。
 *
 * @param element - AST 元素对象，表示模板中的一个节点。
 * @param options - 编译器选项，用于控制编译行为。
 * @returns 处理后的 AST 元素。
 */
export function processElement(element: ASTElement, options: CompilerOptions) {
  processKey(element)
  /**
   * 标记是否为普通元素。
   * 如果没有 `key`、作用域插槽或属性列表为空，则认为是普通元素。
   */
  element.plain =
    !element.key && !element.scopedSlots && !element.attrsList.length

  // 处理元素的引用属性
  processRef(element)

  // 处理插槽内容
  processSlotContent(element)

  // 处理插槽出口
  processSlotOutlet(element)

  // 处理组件相关属性
  processComponent(element)

  /**
   * 遍历并应用所有的转换函数。
   * 每个转换函数可以修改元素并返回新的元素。
   */
  for (let i = 0; i < transforms.length; i++) {
    element = transforms[i](element, options) || element
  }

  // 处理元素的普通属性
  processAttrs(element)

  return element
}

/**
 * 处理元素的 `key` 属性。
 *
 * @param el - 当前处理的元素对象。
 *
 * - 如果 `key` 存在：
 *   - 在开发环境下：
 *     - 如果元素是 `<template>`，会发出警告，提示不能为 `<template>` 设置 `key`。
 *     - 如果元素使用了 `v-for` 并且 `key` 是迭代器变量，同时父元素是 `<transition-group>`，会发出警告，提示不要使用 `v-for` 的索引作为 `<transition-group>` 子元素的 `key`。
 *   - 将 `key` 的值赋给元素对象的 `key` 属性。
 */
function processKey(el) {
  const exp = getBindingAttr(el, 'key')
  if (exp) {
    if (__DEV__) {
      if (el.tag === 'template') {
        warn(
          `<template> cannot be keyed. Place the key on real elements instead.`,
          getRawBindingAttr(el, 'key')
        )
      }
      if (el.for) {
        const iterator = el.iterator2 || el.iterator1
        const parent = el.parent
        if (
          iterator &&
          iterator === exp &&
          parent &&
          parent.tag === 'transition-group'
        ) {
          warn(
            `Do not use v-for index as key on <transition-group> children, ` +
              `this is the same as not using keys.`,
            getRawBindingAttr(el, 'key'),
            true /* tip */
          )
        }
      }
    }
    el.key = exp
  }
}

/**
 * 处理元素的 `ref` 属性。
 * @param el - 当前处理的元素对象。
 */
function processRef(el) {
  /** 元素的 `ref` 属性值 */
  const ref = getBindingAttr(el, 'ref')
  if (ref) {
    /** 将 `ref` 属性值赋给元素对象的 `ref` 属性 */
    el.ref = ref
    /** 检查 `ref` 是否在 `v-for` 循环中 */
    el.refInFor = checkInFor(el)
  }
}

/**
 * 处理元素的 v-for 指令。
 * @param el - 当前处理的 AST 元素。
 */
export function processFor(el: ASTElement) {
  /** v-for 指令的表达式 */
  let exp
  if ((exp = getAndRemoveAttr(el, 'v-for'))) {
    /** 解析 v-for 表达式的结果 */
    const res = parseFor(exp)
    if (res) {
      /** 将解析结果扩展到元素对象上 */
      extend(el, res)
    } else if (__DEV__) {
      /** 如果解析失败，在开发环境中发出警告 */
      warn(`Invalid v-for expression: ${exp}`, el.rawAttrsMap['v-for'])
    }
  }
}

/**
 * 表示解析 `v-for` 指令的结果。
 * @property for 包含循环的目标表达式。
 * @property alias 表示循环中每次迭代的别名。
 * @property iterator1 可选，表示第一个迭代器变量（如索引）。
 * @property iterator2 可选，表示第二个迭代器变量（如键值对中的键）。
 */
type ForParseResult = {
  for: string
  alias: string
  iterator1?: string
  iterator2?: string
}

/**
 * 解析表达式中的循环结构。
 * @param exp 表达式字符串。
 * @returns 如果匹配成功，返回解析结果对象；否则返回 undefined。
 */
export function parseFor(exp: string): ForParseResult | undefined {
  /**
   * 匹配 `in` 或 `of` 的正则表达式结果。
   */
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return

  /**
   * 解析结果对象。
   */
  const res: any = {}

  /**
   * 循环目标，例如 `item in items` 中的 `items`。
   */
  res.for = inMatch[2].trim()

  /**
   * 别名，例如 `item in items` 中的 `item`。
   */
  const alias = inMatch[1].trim().replace(stripParensRE, '')

  /**
   * 匹配迭代器的正则表达式结果。
   */
  const iteratorMatch = alias.match(forIteratorRE)
  if (iteratorMatch) {
    /**
     * 主别名，例如 `(item, index) in items` 中的 `item`。
     */
    res.alias = alias.replace(forIteratorRE, '').trim()

    /**
     * 第一个迭代器，例如 `(item, index) in items` 中的 `index`。
     */
    res.iterator1 = iteratorMatch[1].trim()

    if (iteratorMatch[2]) {
      /**
       * 第二个迭代器，例如 `(value, key, index) in items` 中的 `key`。
       */
      res.iterator2 = iteratorMatch[2].trim()
    }
  } else {
    res.alias = alias
  }
  return res
}

/**
 * 处理元素的 `v-if` 指令。
 *
 * @param el - 当前正在处理的元素对象。
 *
 * - 如果元素包含 `v-if` 指令，则提取其表达式并将其赋值给 `el.if`，
 *   同时调用 `addIfCondition` 方法为该元素添加条件块。
 * - 如果元素包含 `v-else` 指令，则将 `el.else` 设置为 `true`。
 * - 如果元素包含 `v-else-if` 指令，则提取其表达式并将其赋值给 `el.elseif`。
 */
function processIf(el) {
  const exp = getAndRemoveAttr(el, 'v-if')
  if (exp) {
    el.if = exp
    addIfCondition(el, {
      exp: exp,
      block: el
    })
  } else {
    if (getAndRemoveAttr(el, 'v-else') != null) {
      el.else = true
    }
    const elseif = getAndRemoveAttr(el, 'v-else-if')
    if (elseif) {
      el.elseif = elseif
    }
  }
}

/**
 * 处理 v-if 条件的辅助方法。
 *
 * @param el - 当前元素节点，包含 `elseif` 或 `else` 的信息。
 * @param parent - 父级节点，包含当前元素的兄弟节点。
 *
 * - 如果父级节点中存在前一个元素且其包含 `v-if`，则将当前元素的条件添加到前一个元素的条件中。
 * - 如果在开发环境中（`__DEV__`），且未找到对应的 `v-if`，会发出警告。
 */
function processIfConditions(el, parent) {
  const prev = findPrevElement(parent.children)
  if (prev && prev.if) {
    addIfCondition(prev, {
      exp: el.elseif,
      block: el
    })
  } else if (__DEV__) {
    warn(
      `v-${el.elseif ? 'else-if="' + el.elseif + '"' : 'else'} ` +
        `used on element <${el.tag}> without corresponding v-if.`,
      el.rawAttrsMap[el.elseif ? 'v-else-if' : 'v-else']
    )
  }
}

/**
 * 查找子节点数组中最后一个类型为 1 的元素（ASTElement）。
 * 如果遇到非空白文本节点（text 不等于 ' '），在开发环境下会发出警告，
 * 并从子节点数组中移除该节点。
 *
 * @param children 子节点数组，包含多个节点对象。
 * @returns 返回最后一个类型为 1 的元素（ASTElement），如果未找到则返回 void。
 */
function findPrevElement(children: Array<any>): ASTElement | void {
  let i = children.length
  while (i--) {
    if (children[i].type === 1) {
      return children[i]
    } else {
      if (__DEV__ && children[i].text !== ' ') {
        warn(
          `text "${children[i].text.trim()}" between v-if and v-else(-if) ` +
            `will be ignored.`,
          children[i]
        )
      }
      children.pop()
    }
  }
}

/**
 * 为指定的 AST 元素添加一个条件。
 *
 * @param el - 目标 AST 元素。
 * @param condition - 要添加的条件，包含表达式和块信息。
 */
export function addIfCondition(el: ASTElement, condition: ASTIfCondition) {
  if (!el.ifConditions) {
    el.ifConditions = []
  }
  el.ifConditions.push(condition)
}

/**
 * 处理元素的 `v-once` 属性。
 * 如果元素存在 `v-once` 属性，则将其从属性列表中移除，并在元素对象上设置 `once` 标志为 `true`。
 *
 * @param el - 当前正在处理的元素对象
 */
function processOnce(el) {
  const once = getAndRemoveAttr(el, 'v-once')
  if (once != null) {
    el.once = true
  }
}

// handle content being passed to a component as slot,
// e.g. <template slot="xxx">, <div slot-scope="xxx">
function processSlotContent(el) {
  let slotScope
  if (el.tag === 'template') {
    slotScope = getAndRemoveAttr(el, 'scope')
    /* istanbul ignore if */
    if (__DEV__ && slotScope) {
      warn(
        `the "scope" attribute for scoped slots have been deprecated and ` +
          `replaced by "slot-scope" since 2.5. The new "slot-scope" attribute ` +
          `can also be used on plain elements in addition to <template> to ` +
          `denote scoped slots.`,
        el.rawAttrsMap['scope'],
        true
      )
    }
    el.slotScope = slotScope || getAndRemoveAttr(el, 'slot-scope')
  } else if ((slotScope = getAndRemoveAttr(el, 'slot-scope'))) {
    /* istanbul ignore if */
    if (__DEV__ && el.attrsMap['v-for']) {
      warn(
        `Ambiguous combined usage of slot-scope and v-for on <${el.tag}> ` +
          `(v-for takes higher priority). Use a wrapper <template> for the ` +
          `scoped slot to make it clearer.`,
        el.rawAttrsMap['slot-scope'],
        true
      )
    }
    el.slotScope = slotScope
  }

  // slot="xxx"
  const slotTarget = getBindingAttr(el, 'slot')
  if (slotTarget) {
    el.slotTarget = slotTarget === '""' ? '"default"' : slotTarget
    el.slotTargetDynamic = !!(
      el.attrsMap[':slot'] || el.attrsMap['v-bind:slot']
    )
    // preserve slot as an attribute for native shadow DOM compat
    // only for non-scoped slots.
    if (el.tag !== 'template' && !el.slotScope) {
      addAttr(el, 'slot', slotTarget, getRawBindingAttr(el, 'slot'))
    }
  }

  // 2.6 v-slot syntax
  if (process.env.NEW_SLOT_SYNTAX) {
    if (el.tag === 'template') {
      // v-slot on <template>
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) {
        if (__DEV__) {
          if (el.slotTarget || el.slotScope) {
            warn(`Unexpected mixed usage of different slot syntaxes.`, el)
          }
          if (el.parent && !maybeComponent(el.parent)) {
            warn(
              `<template v-slot> can only appear at the root level inside ` +
                `the receiving component`,
              el
            )
          }
        }
        const { name, dynamic } = getSlotName(slotBinding)
        el.slotTarget = name
        el.slotTargetDynamic = dynamic
        el.slotScope = slotBinding.value || emptySlotScopeToken // force it into a scoped slot for perf
      }
    } else {
      // v-slot on component, denotes default slot
      const slotBinding = getAndRemoveAttrByRegex(el, slotRE)
      if (slotBinding) {
        if (__DEV__) {
          if (!maybeComponent(el)) {
            warn(
              `v-slot can only be used on components or <template>.`,
              slotBinding
            )
          }
          if (el.slotScope || el.slotTarget) {
            warn(`Unexpected mixed usage of different slot syntaxes.`, el)
          }
          if (el.scopedSlots) {
            warn(
              `To avoid scope ambiguity, the default slot should also use ` +
                `<template> syntax when there are other named slots.`,
              slotBinding
            )
          }
        }
        // add the component's children to its default slot
        const slots = el.scopedSlots || (el.scopedSlots = {})
        const { name, dynamic } = getSlotName(slotBinding)
        const slotContainer = (slots[name] = createASTElement(
          'template',
          [],
          el
        ))
        slotContainer.slotTarget = name
        slotContainer.slotTargetDynamic = dynamic
        slotContainer.children = el.children.filter((c: any) => {
          if (!c.slotScope) {
            c.parent = slotContainer
            return true
          }
        })
        slotContainer.slotScope = slotBinding.value || emptySlotScopeToken
        // remove children as they are returned from scopedSlots now
        el.children = []
        // mark el non-plain so data gets generated
        el.plain = false
      }
    }
  }
}

/**
 * 获取插槽名称。
 * @param binding - 包含插槽绑定信息的对象。
 * @returns 一个对象，包含插槽名称和是否为动态名称的标志。
 * 如果名称是动态的，则返回的对象格式为 `{ name: string, dynamic: true }`；
 * 如果名称是静态的，则返回的对象格式为 `{ name: string, dynamic: false }`。
 */
function getSlotName(binding) {
  let name = binding.name.replace(slotRE, '')
  if (!name) {
    if (binding.name[0] !== '#') {
      name = 'default'
    } else if (__DEV__) {
      warn(`v-slot shorthand syntax requires a slot name.`, binding)
    }
  }
  return dynamicArgRE.test(name)
    ? // dynamic [name]
      { name: name.slice(1, -1), dynamic: true }
    : // static name
      { name: `"${name}"`, dynamic: false }
}

// handle <slot/> outlets
/**
 * 处理插槽出口的函数。
 *
 * @param el - 表示当前元素的对象。
 *
 * 如果元素的标签名为 'slot'，则会为其添加 `slotName` 属性，
 * 该属性的值通过调用 `getBindingAttr` 方法获取。
 *
 * 如果在开发环境中检测到该元素存在 `key` 属性，会发出警告，
 * 提示 `key` 属性不能用于 `<slot>` 元素，因为插槽是抽象出口，
 * 可能会扩展为多个元素。建议将 `key` 属性放置在包裹元素上。
 */
function processSlotOutlet(el) {
  // 方法体保持不变
  if (el.tag === 'slot') {
    el.slotName = getBindingAttr(el, 'name')
    if (__DEV__ && el.key) {
      warn(
        `\`key\` does not work on <slot> because slots are abstract outlets ` +
          `and can possibly expand into multiple elements. ` +
          `Use the key on a wrapping element instead.`,
        getRawBindingAttr(el, 'key')
      )
    }
  }
}

/**
 * `processComponent` 方法用于处理组件相关的属性。
 * 如果元素存在 `is` 属性，则将其值赋给 `el.component`。
 * 如果元素存在 `inline-template` 属性，则将 `el.inlineTemplate` 设置为 `true`。
 *
 * @param el - 当前处理的元素对象
 */
function processComponent(el) {
  /**
   * `binding` 用于存储通过 `getBindingAttr` 方法获取的 `is` 属性值。
   */
  let binding

  if ((binding = getBindingAttr(el, 'is'))) {
    el.component = binding
  }
  if (getAndRemoveAttr(el, 'inline-template') != null) {
    el.inlineTemplate = true
  }
}

/**
 * 处理元素的属性列表，将其解析为指令、绑定或普通属性。
 * @param el - 当前处理的 AST 元素。
 */
function processAttrs(el) {
  /** 属性列表 */
  const list = el.attrsList
  /** 循环索引 */
  let i
  /** 属性列表长度 */
  let l
  /** 属性名称 */
  let name
  /** 原始属性名称 */
  let rawName
  /** 属性值 */
  let value
  /** 修饰符对象 */
  let modifiers
  /** 同步生成器代码 */
  let syncGen
  /** 是否为动态属性 */
  let isDynamic

  for (i = 0, l = list.length; i < l; i++) {
    name = rawName = list[i].name
    value = list[i].value
    if (dirRE.test(name)) {
      // 标记元素为动态
      el.hasBindings = true
      // 解析修饰符
      modifiers = parseModifiers(name.replace(dirRE, ''))
      // 支持 .foo 的简写语法，用于 .prop 修饰符
      if (process.env.VBIND_PROP_SHORTHAND && propBindRE.test(name)) {
        ;(modifiers || (modifiers = {})).prop = true
        name = `.` + name.slice(1).replace(modifierRE, '')
      } else if (modifiers) {
        name = name.replace(modifierRE, '')
      }
      if (bindRE.test(name)) {
        // 处理 v-bind
        name = name.replace(bindRE, '')
        value = parseFilters(value)
        isDynamic = dynamicArgRE.test(name)
        if (isDynamic) {
          name = name.slice(1, -1)
        }
        if (__DEV__ && value.trim().length === 0) {
          warn(
            `The value for a v-bind expression cannot be empty. Found in "v-bind:${name}"`
          )
        }
        if (modifiers) {
          if (modifiers.prop && !isDynamic) {
            name = camelize(name)
            if (name === 'innerHtml') name = 'innerHTML'
          }
          if (modifiers.camel && !isDynamic) {
            name = camelize(name)
          }
          if (modifiers.sync) {
            syncGen = genAssignmentCode(value, `$event`)
            if (!isDynamic) {
              addHandler(
                el,
                `update:${camelize(name)}`,
                syncGen,
                null,
                false,
                warn,
                list[i]
              )
              if (hyphenate(name) !== camelize(name)) {
                addHandler(
                  el,
                  `update:${hyphenate(name)}`,
                  syncGen,
                  null,
                  false,
                  warn,
                  list[i]
                )
              }
            } else {
              // 动态事件名称的处理
              addHandler(
                el,
                `"update:"+(${name})`,
                syncGen,
                null,
                false,
                warn,
                list[i],
                true // 动态
              )
            }
          }
        }
        if (
          (modifiers && modifiers.prop) ||
          (!el.component && platformMustUseProp(el.tag, el.attrsMap.type, name))
        ) {
          addProp(el, name, value, list[i], isDynamic)
        } else {
          addAttr(el, name, value, list[i], isDynamic)
        }
      } else if (onRE.test(name)) {
        // 处理 v-on
        name = name.replace(onRE, '')
        isDynamic = dynamicArgRE.test(name)
        if (isDynamic) {
          name = name.slice(1, -1)
        }
        addHandler(el, name, value, modifiers, false, warn, list[i], isDynamic)
      } else {
        // 普通指令
        name = name.replace(dirRE, '')
        // 解析参数
        const argMatch = name.match(argRE)
        /** 指令参数 */
        let arg = argMatch && argMatch[1]
        isDynamic = false
        if (arg) {
          name = name.slice(0, -(arg.length + 1))
          if (dynamicArgRE.test(arg)) {
            arg = arg.slice(1, -1)
            isDynamic = true
          }
        }
        addDirective(
          el,
          name,
          rawName,
          value,
          arg,
          isDynamic,
          modifiers,
          list[i]
        )
        if (__DEV__ && name === 'model') {
          checkForAliasModel(el, value)
        }
      }
    } else {
      // 文字属性
      if (__DEV__) {
        const res = parseText(value, delimiters)
        if (res) {
          warn(
            `${name}="${value}": ` +
              'Interpolation inside attributes has been removed. ' +
              'Use v-bind or the colon shorthand instead. For example, ' +
              'instead of <div id="{{ val }}">, use <div :id="val">.',
            list[i]
          )
        }
      }
      addAttr(el, name, JSON.stringify(value), list[i])
      // #6887 Firefox 不会更新通过属性设置的 muted 状态
      // 即使是在元素创建后立即设置
      if (
        !el.component &&
        name === 'muted' &&
        platformMustUseProp(el.tag, el.attrsMap.type, name)
      ) {
        addProp(el, name, 'true', list[i])
      }
    }
  }
}

/**
 * 检查当前元素或其父元素是否包含 `for` 属性。
 *
 * @param el - 要检查的 AST 元素
 * @returns 如果当前元素或其父元素包含 `for` 属性，则返回 `true`，否则返回 `false`
 */
function checkInFor(el: ASTElement): boolean {
  let parent: ASTElement | void = el
  while (parent) {
    if (parent.for !== undefined) {
      return true
    }
    parent = parent.parent
  }
  return false
}

/**
 * 解析修饰符的函数。
 * @param name - 包含修饰符的字符串。
 * @returns 如果匹配到修饰符，返回一个对象，其中键为修饰符名称，值为 `true`；否则返回 `void`。
 */
function parseModifiers(name: string): Object | void {
  const match = name.match(modifierRE)
  if (match) {
    const ret = {}
    match.forEach(m => {
      ret[m.slice(1)] = true
    })
    return ret
  }
}

/**
 * 将属性数组转换为属性映射表。
 * @param attrs - 属性数组，每个属性是一个包含 `name` 和 `value` 的对象。
 * @returns 一个键值对形式的对象，其中键是属性名，值是属性值。
 */
function makeAttrsMap(attrs: Array<Record<string, any>>): Record<string, any> {
  const map = {}
  for (let i = 0, l = attrs.length; i < l; i++) {
    if (__DEV__ && map[attrs[i].name] && !isIE && !isEdge) {
      warn('duplicate attribute: ' + attrs[i].name, attrs[i])
    }
    map[attrs[i].name] = attrs[i].value
  }
  return map
}

// for script (e.g. type="x/template") or style, do not decode content
/**
 * 判断给定的元素是否是文本标签。
 *
 * @param el - 要检查的元素对象。
 * @returns 如果元素的标签是 'script' 或 'style'，则返回 true；否则返回 false。
 */
function isTextTag(el): boolean {
  return el.tag === 'script' || el.tag === 'style'
}

/**
 * 检查是否为禁止的标签
 * @param el - 当前的 AST 元素节点
 * @returns 如果标签是 'style' 或 'script' 且类型为 'text/javascript' 或未定义，则返回 true
 */
function isForbiddenTag(el): boolean {
  return (
    el.tag === 'style' ||
    (el.tag === 'script' &&
      (!el.attrsMap.type || el.attrsMap.type === 'text/javascript'))
  )
}

/**
 * 用于匹配以 `xmlns:NS` 开头并紧跟数字的字符串的正则表达式。
 * 主要用于检测命名空间相关的 XML 属性。
 */
const ieNSBug = /^xmlns:NS\d+/
/**
 * 用于匹配以 `NS` 开头并紧跟数字的字符串的正则表达式。
 * 主要用于检测命名空间相关的前缀。
 */
const ieNSPrefix = /^NS\d+:/

/* istanbul ignore next */
/**
 * 修复 IE 浏览器中 SVG 命名空间的 Bug。
 * 遍历传入的属性数组，移除属性名中与命名空间相关的前缀，并过滤掉匹配特定正则表达式的属性。
 *
 * @param attrs 属性数组，包含需要处理的属性对象。
 * @returns 处理后的属性数组，移除了命名空间前缀并过滤了无效属性。
 */
function guardIESVGBug(attrs) {
  const res: any[] = []
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i]
    if (!ieNSBug.test(attr.name)) {
      attr.name = attr.name.replace(ieNSPrefix, '')
      res.push(attr)
    }
  }
  return res
}

/**
 * 检查当前元素或其父元素是否在 v-for 循环中直接绑定了 v-model 到迭代别名。
 *
 * @param el - 当前的 AST 元素节点。
 * @param value - v-model 绑定的值。
 */
function checkForAliasModel(el, value) {
  let _el = el
  while (_el) {
    /**
     * 当前元素是否存在 v-for 属性。
     */
    if (_el.for && _el.alias === value) {
      warn(
        `<${el.tag} v-model="${value}">: ` +
          `You are binding v-model directly to a v-for iteration alias. ` +
          `This will not be able to modify the v-for source array because ` +
          `writing to the alias is like modifying a function local variable. ` +
          `Consider using an array of objects and use v-model on an object property instead.`,
        el.rawAttrsMap['v-model']
      )
    }
    /**
     * 继续检查父元素。
     */
    _el = _el.parent
  }
}
