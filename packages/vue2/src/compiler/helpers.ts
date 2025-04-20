import { emptyObject } from 'shared/util'
import { ASTElement, ASTModifiers } from 'types/compiler'
import { parseFilters } from './parser/filter-parser'

/**
 * 表示一个范围的类型，包含可选的开始位置和结束位置。
 * - `start`：范围的起始位置（可选）。
 * - `end`：范围的结束位置（可选）。
 */
type Range = { start?: number; end?: number }

/**
 * 基础警告函数，用于在编译器中输出警告信息
 * @param msg 警告信息
 * @param range 可选的范围对象，包含起始和结束位置
 */
/* eslint-disable no-unused-vars */
export function baseWarn(msg: string, range?: Range) {
  console.error(`[Vue compiler]: ${msg}`)
}
/* eslint-enable no-unused-vars */

/**
 * 从模块数组中提取指定键的函数，并过滤掉未定义的值。
 * @param modules 模块数组，包含需要提取函数的模块
 * @param key 模块中需要提取的键
 * @returns 提取的函数数组，过滤掉了未定义的值
 */
export function pluckModuleFunction<T, K extends keyof T>(
  modules: Array<T> | undefined,
  key: K
): Array<Exclude<T[K], undefined>> {
  return modules ? (modules.map(m => m[key]).filter(_ => _) as any) : []
}

/**
 * 向指定的 AST 元素添加属性。
 * @param el - AST 元素对象。
 * @param name - 属性的名称。
 * @param value - 属性的值。
 * @param range - 可选，属性的范围信息。
 * @param dynamic - 可选，指示属性是否为动态属性。
 */
export function addProp(
  el: ASTElement,
  name: string,
  value: string,
  range?: Range,
  dynamic?: boolean
) {
  ;(el.props || (el.props = [])).push(
    rangeSetItem({ name, value, dynamic }, range)
  )
  el.plain = false
}

/**
 * 添加属性到元素的属性列表中。
 *
 * @param el - AST 元素对象。
 * @param name - 属性的名称。
 * @param value - 属性的值。
 * @param range - 可选，属性的范围信息。
 * @param dynamic - 可选，是否为动态属性。
 */
export function addAttr(
  /**
   * AST 元素对象。
   */
  el: ASTElement,
  /**
   * 属性的名称。
   */
  name: string,
  /**
   * 属性的值。
   */
  value: any,
  /**
   * 可选，属性的范围信息。
   */
  range?: Range,
  /**
   * 可选，是否为动态属性。
   */
  dynamic?: boolean
) {
  const attrs = dynamic
    ? el.dynamicAttrs || (el.dynamicAttrs = [])
    : el.attrs || (el.attrs = [])
  attrs.push(rangeSetItem({ name, value, dynamic }, range))
  el.plain = false
}

// add a raw attr (use this in preTransforms)
/**
 * 将原始属性添加到元素的属性映射表中。
 * @param el - AST 元素对象。
 * @param name - 属性的名称。
 * @param value - 属性的值。
 * @param range - 可选，表示属性范围的对象。
 */
export function addRawAttr(
  /** AST 元素对象 */
  el: ASTElement,
  /** 属性的名称 */
  name: string,
  /** 属性的值 */
  value: any,
  /** 可选，表示属性范围的对象 */
  range?: Range
) {
  el.attrsMap[name] = value
  el.attrsList.push(rangeSetItem({ name, value }, range))
}

/**
 * 为指定的 AST 元素添加指令。
 * @param el - AST 元素对象。
 * @param name - 指令的名称。
 * @param rawName - 指令的原始名称。
 * @param value - 指令的值。
 * @param arg - （可选）指令的参数。
 * @param isDynamicArg - （可选）指示参数是否为动态的布尔值。
 * @param modifiers - （可选）指令的修饰符对象。
 * @param range - （可选）指令的范围信息。
 */
export function addDirective(
  el: ASTElement,
  name: string,
  rawName: string,
  value: string,
  arg?: string,
  isDynamicArg?: boolean,
  modifiers?: ASTModifiers,
  range?: Range
) {
  ;(el.directives || (el.directives = [])).push(
    rangeSetItem(
      {
        name,
        rawName,
        value,
        arg,
        isDynamicArg,
        modifiers
      },
      range
    )
  )
  el.plain = false
}

/**
 * @param symbol 符号，用于标记修饰符。
 * @param name 名称，表示事件或属性的名称。
 * @param dynamic 是否为动态标记，如果为 true，则生成动态标记。
 * @returns 返回带有修饰符标记的字符串。
 */
function prependModifierMarker(
  symbol: string,
  name: string,
  dynamic?: boolean
): string {
  return dynamic ? `_p(${name},"${symbol}")` : symbol + name // mark the event as captured
}

/**
 * 为指定的 AST 元素添加事件处理程序。
 *
 * @param el - AST 元素对象。
 * @param name - 事件名称。
 * @param value - 事件处理程序的代码字符串。
 * @param modifiers - 可选的修饰符对象。
 * @param important - 可选，是否将处理程序放在事件队列的开头。
 * @param warn - 可选，警告函数，用于在开发环境中发出警告。
 * @param range - 可选，表示代码范围的对象。
 * @param dynamic - 可选，是否为动态事件名称。
 */
export function addHandler(
  el: ASTElement,
  name: string,
  value: string,
  modifiers?: ASTModifiers | null,
  important?: boolean,
  warn?: Function,
  range?: Range,
  dynamic?: boolean
) {
  modifiers = modifiers || emptyObject
  // warn prevent and passive modifier
  /* istanbul ignore if */
  if (__DEV__ && warn && modifiers.prevent && modifiers.passive) {
    warn(
      "passive and prevent can't be used together. " +
        "Passive handler can't prevent default event.",
      range
    )
  }

  // normalize click.right and click.middle since they don't actually fire
  // this is technically browser-specific, but at least for now browsers are
  // the only target envs that have right/middle clicks.
  if (modifiers.right) {
    if (dynamic) {
      name = `(${name})==='click'?'contextmenu':(${name})`
    } else if (name === 'click') {
      name = 'contextmenu'
      delete modifiers.right
    }
  } else if (modifiers.middle) {
    if (dynamic) {
      name = `(${name})==='click'?'mouseup':(${name})`
    } else if (name === 'click') {
      name = 'mouseup'
    }
  }

  // check capture modifier
  if (modifiers.capture) {
    delete modifiers.capture
    name = prependModifierMarker('!', name, dynamic)
  }
  if (modifiers.once) {
    delete modifiers.once
    name = prependModifierMarker('~', name, dynamic)
  }
  /* istanbul ignore if */
  if (modifiers.passive) {
    delete modifiers.passive
    name = prependModifierMarker('&', name, dynamic)
  }

  let events
  if (modifiers.native) {
    delete modifiers.native
    events = el.nativeEvents || (el.nativeEvents = {})
  } else {
    events = el.events || (el.events = {})
  }

  const newHandler: any = rangeSetItem({ value: value.trim(), dynamic }, range)
  if (modifiers !== emptyObject) {
    newHandler.modifiers = modifiers
  }

  const handlers = events[name]
  /* istanbul ignore if */
  if (Array.isArray(handlers)) {
    important ? handlers.unshift(newHandler) : handlers.push(newHandler)
  } else if (handlers) {
    events[name] = important ? [newHandler, handlers] : [handlers, newHandler]
  } else {
    events[name] = newHandler
  }

  el.plain = false
}

/**
 * 获取指定元素的原始绑定属性值。
 *
 * @param el - 抽象语法树中的元素对象。
 * @param name - 属性名称。
 * @returns 返回匹配的原始绑定属性值，如果未找到则返回 undefined。
 */
export function getRawBindingAttr(el: ASTElement, name: string) {
  return (
    el.rawAttrsMap[':' + name] ||
    el.rawAttrsMap['v-bind:' + name] ||
    el.rawAttrsMap[name]
  )
}

/**
 * 获取绑定属性的动态值或静态值。
 * @param el - 抽象语法树元素。
 * @param name - 属性名称。
 * @param getStatic - 是否获取静态值，默认为 true。
 * @returns 返回解析后的动态值或静态值，如果不存在则返回 undefined。
 */
export function getBindingAttr(
  el: ASTElement,
  name: string,
  getStatic?: boolean
): string | undefined {
  const dynamicValue =
    getAndRemoveAttr(el, ':' + name) || getAndRemoveAttr(el, 'v-bind:' + name)
  if (dynamicValue != null) {
    return parseFilters(dynamicValue)
  } else if (getStatic !== false) {
    const staticValue = getAndRemoveAttr(el, name)
    if (staticValue != null) {
      return JSON.stringify(staticValue)
    }
  }
}

// note: this only removes the attr from the Array (attrsList) so that it
// doesn't get processed by processAttrs.
// By default it does NOT remove it from the map (attrsMap) because the map is
// needed during codegen.
/**
 * 从元素的属性映射中获取指定名称的属性值，并根据需要从属性列表和映射中移除该属性。
 * @param el - 包含属性映射和属性列表的 AST 元素。
 * @param name - 要获取和移除的属性名称。
 * @param removeFromMap - 是否从属性映射中移除该属性。
 * @returns 返回获取的属性值，如果属性不存在则返回 undefined。
 */
export function getAndRemoveAttr(
  el: ASTElement,
  name: string,
  removeFromMap?: boolean
): string | undefined {
  let val
  if ((val = el.attrsMap[name]) != null) {
    const list = el.attrsList
    for (let i = 0, l = list.length; i < l; i++) {
      if (list[i].name === name) {
        list.splice(i, 1)
        break
      }
    }
  }
  if (removeFromMap) {
    delete el.attrsMap[name]
  }
  return val
}

/**
 * 根据正则表达式从元素的属性列表中获取并移除匹配的属性。
 * @param el - 包含属性列表的 AST 元素。
 * @param name - 用于匹配属性名称的正则表达式。
 * @returns 匹配的属性对象，如果没有匹配则返回 undefined。
 */
export function getAndRemoveAttrByRegex(el: ASTElement, name: RegExp) {
  const list = el.attrsList
  for (let i = 0, l = list.length; i < l; i++) {
    const attr = list[i]
    if (name.test(attr.name)) {
      list.splice(i, 1)
      return attr
    }
  }
}

/**
 * 设置项的范围信息。
 *
 * @param item - 要设置范围的项。
 * @param range - 可选的范围对象，包含 `start` 和 `end` 属性。
 *   - `start` - 范围的起始位置（可选）。
 *   - `end` - 范围的结束位置（可选）。
 * @returns 返回带有范围信息的项。
 */
function rangeSetItem(item: any, range?: { start?: number; end?: number }) {
  if (range) {
    if (range.start != null) {
      item.start = range.start
    }
    if (range.end != null) {
      item.end = range.end
    }
  }
  return item
}
