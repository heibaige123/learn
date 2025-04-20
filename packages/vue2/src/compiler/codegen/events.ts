import { ASTElementHandler, ASTElementHandlers } from 'types/compiler'

/**
 * 用于匹配函数表达式的正则表达式
 * 支持箭头函数和普通函数的定义
 */
const fnExpRE = /^([\w$_]+|\([^)]*?\))\s*=>|^function(?:\s+[\w$]+)?\s*\(/
/**
 * 用于匹配函数调用的正则表达式
 * 匹配形如 foo() 或 foo(bar) 的调用
 */
const fnInvokeRE = /\([^)]*?\);*$/
/**
 * 用于匹配简单路径的正则表达式
 * 支持点号分隔的属性访问、数组索引访问以及字符串键访问
 */
const simplePathRE =
  /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?']|\["[^"]*?"]|\[\d+]|\[[A-Za-z_$][\w$]*])*$/

// KeyboardEvent.keyCode aliases
/**
 * 一个键码映射表，用于将键名映射到对应的键码值。
 * 键名为字符串类型，键码值可以是数字或数字数组。
 * 常见的键名包括：
 * - `esc`：27
 * - `tab`：9
 * - `enter`：13
 * - `space`：32
 * - `up`：38
 * - `left`：37
 * - `right`：39
 * - `down`：40
 * - `delete`：包含两个键码 [8, 46]
 */
const keyCodes: { [key: string]: number | Array<number> } = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  up: 38,
  left: 37,
  right: 39,
  down: 40,
  delete: [8, 46]
}

// KeyboardEvent.key aliases
/**
 * 一个键名映射表，用于将键名映射到对应的键值。
 * 键名为字符串类型，键值可以是字符串或字符串数组。
 * 常见的键名包括：
 * - `esc`：['Esc', 'Escape']
 * - `tab`：'Tab'
 * - `enter`：'Enter'
 * - `space`：[' ', 'Spacebar']
 * - `up`：['Up', 'ArrowUp']
 * - `left`：['Left', 'ArrowLeft']
 * - `right`：['Right', 'ArrowRight']
 * - `down`：['Down', 'ArrowDown']
 * - `delete`：['Backspace', 'Delete', 'Del']
 */
const keyNames: { [key: string]: string | Array<string> } = {
  // #7880: IE11 and Edge use `Esc` for Escape key name.
  esc: ['Esc', 'Escape'],
  tab: 'Tab',
  enter: 'Enter',
  // #9112: IE11 uses `Spacebar` for Space key name.
  space: [' ', 'Spacebar'],
  // #7806: IE11 uses key names without `Arrow` prefix for arrow keys.
  up: ['Up', 'ArrowUp'],
  left: ['Left', 'ArrowLeft'],
  right: ['Right', 'ArrowRight'],
  down: ['Down', 'ArrowDown'],
  // #9112: IE11 uses `Del` for Delete key name.
  delete: ['Backspace', 'Delete', 'Del']
}

// #4868: modifiers that prevent the execution of the listener
// need to explicitly return null so that we can determine whether to remove
// the listener for .once
/**
 * 生成一个条件守卫函数，用于在满足指定条件时返回 null。
 *
 * @param condition 条件表达式，表示当条件为真时返回 null。
 * @returns 返回一个字符串形式的条件守卫代码。
 */
const genGuard = condition => `if(${condition})return null;`

/**
 * 一个修饰符代码映射表，用于生成特定修饰符的事件处理代码。
 * 键名为修饰符名称，值为对应的代码字符串。
 * 常见的修饰符包括：
 * - `stop`：调用 $event.stopPropagation() 阻止事件冒泡。
 * - `prevent`：调用 $event.preventDefault() 阻止默认行为。
 * - `self`：仅当事件目标是当前元素时触发。
 * - `ctrl`：仅当按下 Ctrl 键时触发。
 * - `shift`：仅当按下 Shift 键时触发。
 * - `alt`：仅当按下 Alt 键时触发。
 * - `meta`：仅当按下 Meta 键（如 Command 键）时触发。
 * - `left`：仅当鼠标左键点击时触发。
 * - `middle`：仅当鼠标中键点击时触发。
 * - `right`：仅当鼠标右键点击时触发。
 */
const modifierCode: { [key: string]: string } = {
  stop: '$event.stopPropagation();',
  prevent: '$event.preventDefault();',
  self: genGuard(`$event.target !== $event.currentTarget`),
  ctrl: genGuard(`!$event.ctrlKey`),
  shift: genGuard(`!$event.shiftKey`),
  alt: genGuard(`!$event.altKey`),
  meta: genGuard(`!$event.metaKey`),
  left: genGuard(`'button' in $event && $event.button !== 0`),
  middle: genGuard(`'button' in $event && $event.button !== 1`),
  right: genGuard(`'button' in $event && $event.button !== 2`)
}

/**
 * 根据事件生成处理程序代码。
 * @param events - 包含事件处理程序的对象。
 * @param isNative - 是否为原生事件。
 * @returns 生成的事件处理程序代码字符串。
 */
export function genHandlers(
  events: ASTElementHandlers,
  isNative: boolean
): string {
  /**
   * 事件处理程序的前缀，`nativeOn:` 表示原生事件，`on:` 表示普通事件。
   */
  const prefix = isNative ? 'nativeOn:' : 'on:'

  /**
   * 静态事件处理程序的字符串表示形式。
   */
  let staticHandlers = ``

  /**
   * 动态事件处理程序的字符串表示形式。
   */
  let dynamicHandlers = ``
  for (const name in events) {
    const handlerCode = genHandler(events[name])
    //@ts-expect-error
    if (events[name] && events[name].dynamic) {
      dynamicHandlers += `${name},${handlerCode},`
    } else {
      staticHandlers += `"${name}":${handlerCode},`
    }
  }
  staticHandlers = `{${staticHandlers.slice(0, -1)}}`
  if (dynamicHandlers) {
    return prefix + `_d(${staticHandlers},[${dynamicHandlers.slice(0, -1)}])`
  } else {
    return prefix + staticHandlers
  }
}

/**
 * 将事件处理器（ASTElementHandler）转换为可执行的渲染函数
 * @param handler 事件处理器
 *
 * @example

1. 方法处理器 v-on:click="handleClick"
// 生成代码:
"handleClick"

2. 内联语句 v-on:click="count++"
// 生成代码:
"function($event){count++}"

3. 带修饰符的处理器 v-on:click.stop.prevent="handleClick"
// 生成代码:
"function($event){$event.stopPropagation();$event.preventDefault();return handleClick.apply(null, arguments)}"

4. 键盘事件修饰符 v-on:keyup.enter="submit"
// 生成代码:
"function($event){if(!$event.type.indexOf('key')&&_k($event.keyCode,\"enter\",13,$event.key,\"Enter\"))return null;return submit.apply(null, arguments)}"
 */
function genHandler(
  handler: ASTElementHandler | Array<ASTElementHandler>
): string {
  // 处理空处理器
  if (!handler) {
    return 'function(){}'
  }

  // 处理数组形式的处理器
  if (Array.isArray(handler)) {
    return `[${handler.map(handler => genHandler(handler)).join(',')}]`
  }

  // 判断处理器的值的类型
  const isMethodPath = simplePathRE.test(handler.value)
  const isFunctionExpression = fnExpRE.test(handler.value)
  const isFunctionInvocation = simplePathRE.test(
    handler.value.replace(fnInvokeRE, '')
  )

  // 无修饰符的处理器
  if (!handler.modifiers) {
    if (isMethodPath || isFunctionExpression) {
      return handler.value
    }
    return `function($event){${
      isFunctionInvocation ? `return ${handler.value}` : handler.value
    }}` // inline statement
  } else {
    let code = ''
    let genModifierCode = ''
    const keys: string[] = []
    // 生成修饰符代码
    for (const key in handler.modifiers) {
      if (modifierCode[key]) {
        genModifierCode += modifierCode[key]
        // left/right
        // 如果修饰符也是键码（例如 left/right），加入键列表
        if (keyCodes[key]) {
          keys.push(key)
        }
      } else if (key === 'exact') {
        // 特殊处理 .exact 修饰符
        const modifiers = handler.modifiers
        genModifierCode += genGuard(
          ['ctrl', 'shift', 'alt', 'meta']
            .filter(keyModifier => !modifiers[keyModifier])
            .map(keyModifier => `$event.${keyModifier}Key`)
            .join('||')
        )
      } else {
        // 其他按键修饰符
        keys.push(key)
      }
    }
    // 处理键盘事件过滤器
    if (keys.length) {
      code += genKeyFilter(keys)
    }
    // Make sure modifiers like prevent and stop get executed after key filtering
    // 确保修饰符代码在键过滤后执行
    if (genModifierCode) {
      code += genModifierCode
    }
    // 生成处理器代码
    const handlerCode = isMethodPath
      ? `return ${handler.value}.apply(null, arguments)`
      : isFunctionExpression
      ? `return (${handler.value}).apply(null, arguments)`
      : isFunctionInvocation
      ? `return ${handler.value}`
      : handler.value
    // 组合最终的函数代码
    return `function($event){${code}${handlerCode}}`
  }
}

/**
 * 生成键盘事件的键过滤器代码。
 *
 * 此函数确保键过滤器仅适用于键盘事件（KeyboardEvents）。
 *
 * 注意：
 * - 过滤器会检查事件类型是否包含 'key'，以确保只处理键盘事件。
 * - 修复了 #9441 问题：不能在 $event 中使用 'keyCode'，因为 Chrome 的自动填充会触发没有 keyCode 属性的伪造键事件。
 *
 * @param keys 键名数组，用于生成过滤器代码。
 * @returns 一个字符串形式的过滤器代码，用于在事件处理程序中过滤特定键。
 */
function genKeyFilter(keys: Array<string>): string {
  return (
    // make sure the key filters only apply to KeyboardEvents
    // #9441: can't use 'keyCode' in $event because Chrome autofill fires fake
    // key events that do not have keyCode property...
    `if(!$event.type.indexOf('key')&&` +
    `${keys.map(genFilterCode).join('&&')})return null;`
  )
}

/**
 * 生成过滤代码的方法。
 *
 * @param key - 表示键值的字符串，可以是键名或键码。
 * @returns 返回一个字符串，用于在事件处理程序中过滤特定的键事件。
 *
 * - 如果 `key` 是一个数字字符串，则返回一个检查 `$event.keyCode` 是否不等于该数字的代码片段。
 * - 如果 `key` 是一个键名，则返回一个调用 `_k` 方法的代码片段，用于检查键码或键名是否匹配。
 */
function genFilterCode(key: string): string {
  const keyVal = parseInt(key, 10)
  if (keyVal) {
    return `$event.keyCode!==${keyVal}`
  }
  const keyCode = keyCodes[key]
  const keyName = keyNames[key]
  return (
    `_k($event.keyCode,` +
    `${JSON.stringify(key)},` +
    `${JSON.stringify(keyCode)},` +
    `$event.key,` +
    `${JSON.stringify(keyName)}` +
    `)`
  )
}
