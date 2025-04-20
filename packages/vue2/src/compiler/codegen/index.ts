import { genHandlers } from './events'
import baseDirectives from '../directives/index'
import { camelize, no, extend, capitalize } from 'shared/util'
import { baseWarn, pluckModuleFunction } from '../helpers'
import { emptySlotScopeToken } from '../parser/index'
import {
  ASTAttr,
  ASTDirective,
  ASTElement,
  ASTExpression,
  ASTIfConditions,
  ASTNode,
  ASTText,
  CompilerOptions
} from 'types/compiler'
import { BindingMetadata, BindingTypes } from 'sfc/types'

/**
 * 转换函数类型，用于对 AST 元素和代码字符串进行转换。
 * @param el - AST 元素，表示抽象语法树中的一个节点。
 * @param code - 字符串形式的代码，表示需要转换的代码片段。
 * @returns 转换后的代码字符串。
 */
type TransformFunction = (el: ASTElement, code: string) => string
/**
 * 数据生成函数类型，用于生成 AST 元素的字符串形式数据。
 */
type DataGenFunction = (el: ASTElement) => string
/**
 * 表示一个指令函数的类型定义。
 *
 * @param el - 表示抽象语法树中的一个元素节点。
 * @param dir - 表示抽象语法树中的一个指令节点。
 * @param warn - 用于发出警告的函数。
 * @returns 一个布尔值，指示指令函数的执行结果。
 */
type DirectiveFunction = (
  el: ASTElement,
  dir: ASTDirective,
  warn: Function
) => boolean

/**
 * 表示代码生成的状态对象。
 */
export class CodegenState {
  /**
   * 编译器选项。
   */
  options: CompilerOptions

  /**
   * 用于发出警告的函数。
   */
  warn: Function

  /**
   * 转换函数数组，用于对代码进行转换。
   */
  transforms: Array<TransformFunction>

  /**
   * 数据生成函数数组，用于生成元素的数据。
   */
  dataGenFns: Array<DataGenFunction>

  /**
   * 指令函数集合，键为指令名称。
   */
  directives: { [key: string]: DirectiveFunction }

  /**
   * 判断是否为组件的函数。
   */
  maybeComponent: (el: ASTElement) => boolean

  /**
   * 用于生成唯一的 v-once 标识符。
   */
  onceId: number

  /**
   * 静态渲染函数数组。
   */
  staticRenderFns: Array<string>

  /**
   * 当前是否处于 v-pre 模式。
   */
  pre: boolean

  /**
   * 构造函数，初始化代码生成状态对象。
   * @param options 编译器选项。
   */
  constructor(options: CompilerOptions) {
    this.options = options
    this.warn = options.warn || baseWarn
    this.transforms = pluckModuleFunction(options.modules, 'transformCode')
    this.dataGenFns = pluckModuleFunction(options.modules, 'genData')
    this.directives = extend(extend({}, baseDirectives), options.directives)
    const isReservedTag = options.isReservedTag || no
    this.maybeComponent = (el: ASTElement) =>
      !!el.component || !isReservedTag(el.tag)
    this.onceId = 0
    this.staticRenderFns = []
    this.pre = false
  }
}

/**
 * 表示代码生成的结果。
 */
export type CodegenResult = {
  /** 渲染函数的代码字符串 */
  render: string
  /** 静态渲染函数的数组 */
  staticRenderFns: Array<string>
}

/**
 * 生成代码的主函数。
 * @param ast 抽象语法树的根节点。
 * @param options 编译器选项。
 * @returns 返回代码生成的结果，包括渲染函数和静态渲染函数数组。
 */
export function generate(
  ast: ASTElement | void,
  options: CompilerOptions
): CodegenResult {
  /** 代码生成的状态对象 */
  const state = new CodegenState(options)

  // fix #11483, Root level <script> tags should not be rendered.
  /** 根节点的代码字符串 */
  const code = ast
    ? ast.tag === 'script'
      ? 'null' // 修复 #11483，根级别的 <script> 标签不应被渲染。
      : genElement(ast, state)
    : '_c("div")'

  return {
    /** 渲染函数代码 */
    render: `with(this){return ${code}}`,
    /** 静态渲染函数数组 */
    staticRenderFns: state.staticRenderFns
  }
}

/**
 * 将 AST (抽象语法树) 元素转换为渲染函数所需的字符串代码
 * @param el
 * @param state
 * @returns
 */
export function genElement(el: ASTElement, state: CodegenState): string {
  /** 如果存在父节点，则继承父节点的 pre 属性 */
  if (el.parent) {
    el.pre = el.pre || el.parent.pre
  }

  /** 如果是静态根节点且未处理过，则生成静态节点代码 */
  if (el.staticRoot && !el.staticProcessed) {
    return genStatic(el, state)
  } else if (el.once && !el.onceProcessed) {
    /** 如果是 v-once 且未处理过，则生成 v-once 节点代码 */
    return genOnce(el, state)
  } else if (el.for && !el.forProcessed) {
    /** 如果是 v-for 且未处理过，则生成 v-for 节点代码 */
    return genFor(el, state)
  } else if (el.if && !el.ifProcessed) {
    /** 如果是 v-if 且未处理过，则生成 v-if 节点代码 */
    return genIf(el, state)
  } else if (el.tag === 'template' && !el.slotTarget && !state.pre) {
    /** 如果是 template 标签且没有插槽目标且不在 pre 模式下，则生成子节点代码 */
    return genChildren(el, state) || 'void 0'
  } else if (el.tag === 'slot') {
    /** 如果是 slot 标签，则生成插槽代码 */
    return genSlot(el, state)
  } else {
    /** 如果是组件或普通元素 */
    let code
    if (el.component) {
      /** 如果是组件，则生成组件代码 */
      code = genComponent(el.component, el, state)
    } else {
      let data
      /** 是否可能是组件 */
      const maybeComponent = state.maybeComponent(el)
      /** 如果不是普通元素或在 pre 模式下是组件，则生成数据代码 */
      if (!el.plain || (el.pre && maybeComponent)) {
        data = genData(el, state)
      }

      let tag: string | undefined
      /** 检查是否是 <script setup> 中的组件 */
      const bindings = state.options.bindings
      if (maybeComponent && bindings && bindings.__isScriptSetup !== false) {
        tag = checkBindingType(bindings, el.tag)
      }
      /** 如果未找到绑定类型，则使用标签名 */
      if (!tag) tag = `'${el.tag}'`

      /** 生成子节点代码 */
      const children = el.inlineTemplate ? null : genChildren(el, state, true)
      /** 生成元素代码 */
      code = `_c(${tag}${
        data ? `,${data}` : '' // 数据
      }${
        children ? `,${children}` : '' // 子节点
      })`
    }
    /** 应用模块转换 */
    for (let i = 0; i < state.transforms.length; i++) {
      code = state.transforms[i](el, code)
    }
    return code
  }
}

/**
 * 检查绑定类型的函数。
 *
 * @param bindings - 包含绑定元数据的对象。
 * @param key - 要检查的绑定键。
 * @returns 如果找到匹配的绑定类型，则返回对应的键名；否则返回 `undefined`。
 */
function checkBindingType(bindings: BindingMetadata, key: string) {
  /**
   * 转换后的驼峰命名形式的键名。
   */
  const camelName = camelize(key)

  /**
   * 转换后的帕斯卡命名形式的键名。
   */
  const PascalName = capitalize(camelName)

  /**
   * 检查给定类型是否匹配绑定键。
   *
   * @param type - 要检查的绑定类型。
   * @returns 如果匹配则返回对应的键名；否则返回 `undefined`。
   */
  const checkType = type => {
    if (bindings[key] === type) {
      return key
    }
    if (bindings[camelName] === type) {
      return camelName
    }
    if (bindings[PascalName] === type) {
      return PascalName
    }
  }

  /**
   * 检查是否为常量绑定类型。
   */
  const fromConst =
    checkType(BindingTypes.SETUP_CONST) ||
    checkType(BindingTypes.SETUP_REACTIVE_CONST)
  if (fromConst) {
    return fromConst
  }

  /**
   * 检查是否为可能的引用绑定类型。
   */
  const fromMaybeRef =
    checkType(BindingTypes.SETUP_LET) ||
    checkType(BindingTypes.SETUP_REF) ||
    checkType(BindingTypes.SETUP_MAYBE_REF)
  if (fromMaybeRef) {
    return fromMaybeRef
  }
}

// hoist static sub-trees out
function genStatic(el: ASTElement, state: CodegenState): string {
  /**
   * 标记当前元素已处理为静态节点。
   */
  el.staticProcessed = true
  // Some elements (templates) need to behave differently inside of a v-pre
  // node.  All pre nodes are static roots, so we can use this as a location to
  // wrap a state change and reset it upon exiting the pre node.
  /**
   * 原始的 `pre` 状态，用于在退出 `pre` 节点时恢复状态。
   */
  const originalPreState = state.pre

  /**
   * 如果当前元素是 `pre` 节点，则更新状态为 `pre`。
   */
  if (el.pre) {
    state.pre = el.pre
  }

  /**
   * 将静态渲染函数添加到 `staticRenderFns` 数组中。
   * 使用 `with` 语法生成静态节点的渲染函数。
   */
  state.staticRenderFns.push(`with(this){return ${genElement(el, state)}}`)

  /**
   * 恢复原始的 `pre` 状态。
   */
  state.pre = originalPreState

  /**
   * 返回静态节点的渲染函数调用字符串。
   * 如果静态节点在 `v-for` 内，则添加第二个参数 `true`。
   */
  return `_m(${state.staticRenderFns.length - 1}${
    el.staticInFor ? ',true' : ''
  })`
}

// v-once
/**
 * 处理带有 `v-once` 指令的 AST 元素。
 *
 * @param el - 当前的 AST 元素。
 * @param state - 当前的代码生成状态。
 * @returns 生成的代码字符串。
 *
 * - 如果元素同时具有 `v-if` 指令且尚未处理，则调用 `genIf` 处理。
 * - 如果元素在 `v-for` 循环中且具有静态属性，则生成 `_o` 包裹的代码。
 * - 否则，生成静态内容的代码。
 */
function genOnce(el: ASTElement, state: CodegenState): string {
  el.onceProcessed = true
  if (el.if && !el.ifProcessed) {
    return genIf(el, state)
  } else if (el.staticInFor) {
    let key = ''
    let parent = el.parent
    while (parent) {
      if (parent.for) {
        key = parent.key!
        break
      }
      parent = parent.parent
    }
    if (!key) {
      __DEV__ &&
        state.warn(
          `v-once can only be used inside v-for that is keyed. `,
          el.rawAttrsMap['v-once']
        )
      return genElement(el, state)
    }
    return `_o(${genElement(el, state)},${state.onceId++},${key})`
  } else {
    return genStatic(el, state)
  }
}

/**
 * 生成带条件渲染逻辑代码
 * @param el 表示当前处理的 AST 元素节点。
 * @param state 是代码生成的状态对象，包含了生成代码所需的上下文信息。
 * @param altGen 是一个可选的自定义代码生成函数，用于替代默认的生成逻辑。
 * @param altEmpty 是一个可选的字符串，用于在条件为空时生成的占位内容。
 * @returns
 */
export function genIf(
  el: any,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  // 标记当前元素的 v-if 已处理，避免递归处理
  el.ifProcessed = true
  // 处理 if 条件数组（包含 v-if、v-else-if、v-else）
  return genIfConditions(el.ifConditions.slice(), state, altGen, altEmpty)
}

/**
 * 生成 v-if 条件的代码字符串。
 * @param conditions 条件数组，包含 v-if、v-else-if 和 v-else 的条件块。
 * @param state 当前代码生成的状态对象。
 * @param altGen 可选的自定义代码生成函数，用于替代默认的生成逻辑。
 * @param altEmpty 可选的字符串，用于在条件为空时生成的占位内容。
 * @returns 返回生成的代码字符串。
 */
function genIfConditions(
  conditions: ASTIfConditions,
  state: CodegenState,
  altGen?: Function,
  altEmpty?: string
): string {
  /** 如果条件数组为空，返回占位内容或空节点代码 */
  if (!conditions.length) {
    return altEmpty || '_e()'
  }

  /** 当前条件块 */
  const condition = conditions.shift()!
  /** 如果存在条件表达式，生成三元表达式代码 */
  if (condition.exp) {
    return `(${condition.exp})?${genTernaryExp(
      condition.block
    )}:${genIfConditions(conditions, state, altGen, altEmpty)}`
  } else {
    /** 否则直接生成当前条件块的代码 */
    return `${genTernaryExp(condition.block)}`
  }

  /**
   * 生成三元表达式的代码。
   * @param el 当前条件块的 AST 元素。
   * @returns 返回生成的代码字符串。
   */
  function genTernaryExp(el) {
    return altGen
      ? altGen(el, state)
      : el.once
      ? genOnce(el, state)
      : genElement(el, state)
  }
}

/**
 * 生成列表渲染代码，将模板中的 v-for 指令转换为可执行的 JavaScript 渲染函数代码
 * @param el 带有 v-for 指令的 AST 元素
 * @param state 代码生成状态
 * @param altGen 可选的替代元素生成函数
 * @param altHelper 可选的替代助手函数名称
 * @returns
 */
export function genFor(
  el: any,
  state: CodegenState,
  altGen?: Function,
  altHelper?: string
): string {
  /**
   * `el.for` 表示 v-for 指令的表达式，例如 `item in items` 中的 `items`。
   */
  const exp = el.for

  /**
   * `el.alias` 表示 v-for 指令中定义的别名，例如 `item in items` 中的 `item`。
   */
  const alias = el.alias

  /**
   * `el.iterator1` 表示 v-for 指令中第一个迭代器的别名（如果存在）。
   * 如果存在，则以 `,` 开头拼接到字符串中。
   */
  const iterator1 = el.iterator1 ? `,${el.iterator1}` : ''

  /**
   * `el.iterator2` 表示 v-for 指令中第二个迭代器的别名（如果存在）。
   * 如果存在，则以 `,` 开头拼接到字符串中。
   */
  const iterator2 = el.iterator2 ? `,${el.iterator2}` : ''
  if (
    __DEV__ &&
    state.maybeComponent(el) &&
    el.tag !== 'slot' &&
    el.tag !== 'template' &&
    !el.key
  ) {
    state.warn(
      `<${el.tag} v-for="${alias} in ${exp}">: component lists rendered with ` +
        `v-for should have explicit keys. ` +
        `See https://v2.vuejs.org/v2/guide/list.html#key for more info.`,
      el.rawAttrsMap['v-for'],
      true /* tip */
    )
  }

  el.forProcessed = true // avoid recursion
  return (
    `${altHelper || '_l'}((${exp}),` +
    `function(${alias}${iterator1}${iterator2}){` +
    `return ${(altGen || genElement)(el, state)}` +
    '})'
  )
}

/**
 * 生成元素的数据字符串
 * @param el 当前的 AST 元素
 * @param state 当前的代码生成状态
 * @returns 返回生成的数据字符串
 */
export function genData(el: ASTElement, state: CodegenState): string {
  /** 存储生成的数据字符串 */
  let data = '{'

  // directives first.
  // directives may mutate the el's other properties before they are generated.
  /** 指令生成的代码 */
  const dirs = genDirectives(el, state)
  if (dirs) data += dirs + ','

  /** 元素的 key 属性 */
  if (el.key) {
    data += `key:${el.key},`
  }

  /** 元素的 ref 属性 */
  if (el.ref) {
    data += `ref:${el.ref},`
  }

  /** 是否在 v-for 中使用了 ref */
  if (el.refInFor) {
    data += `refInFor:true,`
  }

  /** 是否是 v-pre 指令 */
  if (el.pre) {
    data += `pre:true,`
  }

  /** 记录组件使用 "is" 属性的原始标签名 */
  if (el.component) {
    data += `tag:"${el.tag}",`
  }

  /** 模块数据生成函数 */
  for (let i = 0; i < state.dataGenFns.length; i++) {
    data += state.dataGenFns[i](el)
  }

  /** 静态属性 */
  if (el.attrs) {
    data += `attrs:${genProps(el.attrs)},`
  }

  /** DOM 属性 */
  if (el.props) {
    data += `domProps:${genProps(el.props)},`
  }

  /** 事件处理函数 */
  if (el.events) {
    data += `${genHandlers(el.events, false)},`
  }

  /** 原生事件处理函数 */
  if (el.nativeEvents) {
    data += `${genHandlers(el.nativeEvents, true)},`
  }

  // slot target
  // only for non-scoped slots
  /** 插槽目标（仅非作用域插槽） */
  if (el.slotTarget && !el.slotScope) {
    data += `slot:${el.slotTarget},`
  }

  /** 作用域插槽 */
  if (el.scopedSlots) {
    data += `${genScopedSlots(el, el.scopedSlots, state)},`
  }

  /** 组件的 v-model */
  if (el.model) {
    data += `model:{value:${el.model.value},callback:${el.model.callback},expression:${el.model.expression}},`
  }

  /** 内联模板 */
  if (el.inlineTemplate) {
    const inlineTemplate = genInlineTemplate(el, state)
    if (inlineTemplate) {
      data += `${inlineTemplate},`
    }
  }

  /** 去掉末尾的逗号并闭合对象 */
  data = data.replace(/,$/, '') + '}'

  // v-bind dynamic argument wrap
  // v-bind with dynamic arguments must be applied using the same v-bind object
  // merge helper so that class/style/mustUseProp attrs are handled correctly.

  /** 动态属性的 v-bind 包裹 */
  if (el.dynamicAttrs) {
    data = `_b(${data},"${el.tag}",${genProps(el.dynamicAttrs)})`
  }

  /** v-bind 数据包裹 */
  if (el.wrapData) {
    data = el.wrapData(data)
  }

  /** v-on 数据包裹 */
  if (el.wrapListeners) {
    data = el.wrapListeners(data)
  }

  return data
}

/**
 * 生成指令的代码字符串。
 * @param el 当前的 AST 元素。
 * @param state 当前的代码生成状态。
 * @returns 返回生成的指令代码字符串或 undefined。
 */
function genDirectives(el: ASTElement, state: CodegenState): string | void {
  /** 当前元素的指令数组 */
  const dirs = el.directives
  if (!dirs) return

  /** 存储生成的指令代码字符串 */
  let res = 'directives:['

  /** 是否存在运行时指令 */
  let hasRuntime = false

  /** 循环变量 */
  let i, l, dir, needRuntime

  for (i = 0, l = dirs.length; i < l; i++) {
    /** 当前指令 */
    dir = dirs[i]

    /** 是否需要运行时支持 */
    needRuntime = true

    /** 当前指令的生成函数 */
    const gen: DirectiveFunction = state.directives[dir.name]

    if (gen) {
      // compile-time directive that manipulates AST.
      // returns true if it also needs a runtime counterpart.
      // 编译时指令会操作 AST。
      // 如果需要运行时支持，则返回 true。
      needRuntime = !!gen(el, dir, state.warn)
    }

    if (needRuntime) {
      hasRuntime = true
      res += `{name:"${dir.name}",rawName:"${dir.rawName}"${
        dir.value
          ? `,value:(${dir.value}),expression:${JSON.stringify(dir.value)}`
          : ''
      }${dir.arg ? `,arg:${dir.isDynamicArg ? dir.arg : `"${dir.arg}"`}` : ''}${
        dir.modifiers ? `,modifiers:${JSON.stringify(dir.modifiers)}` : ''
      }},`
    }
  }

  if (hasRuntime) {
    return res.slice(0, -1) + ']'
  }
}

/**
 * 生成内联模板的代码。
 *
 * @param el - 抽象语法树 (AST) 的元素节点。
 * @param state - 代码生成的状态对象，包含生成器选项和警告方法。
 * @returns 如果成功生成内联模板，则返回内联模板的字符串；否则返回 `undefined`。
 */
function genInlineTemplate(
  el: ASTElement,
  state: CodegenState
): string | undefined {
  const ast = el.children[0]
  if (__DEV__ && (el.children.length !== 1 || ast.type !== 1)) {
    state.warn(
      'Inline-template components must have exactly one child element.',
      { start: el.start }
    )
  }
  if (ast && ast.type === 1) {
    const inlineRenderFns = generate(ast, state.options)
    return `inlineTemplate:{render:function(){${
      inlineRenderFns.render
    }},staticRenderFns:[${inlineRenderFns.staticRenderFns
      .map(code => `function(){${code}}`)
      .join(',')}]}`
  }
}

/**
 * 负责生成作用域插槽（scoped slots）代码的关键函数。它将模板中声明的作用域插槽转换为渲染函数中的代码表示
 * @param el 当前元素
 * @param slots 插槽映射对象
 * @param state 代码生成状态
 * @returns
 */
function genScopedSlots(
  el: ASTElement,
  slots: { [key: string]: ASTElement },
  state: CodegenState
): string {
  // by default scoped slots are considered "stable", this allows child
  // components with only scoped slots to skip forced updates from parent.
  // but in some cases we have to bail-out of this optimization
  // for example if the slot contains dynamic names, has v-if or v-for on them...
  let needsForceUpdate =
    el.for ||
    Object.keys(slots).some(key => {
      const slot = slots[key]
      return (
        slot.slotTargetDynamic || slot.if || slot.for || containsSlotChild(slot) // is passing down slot from parent which may be dynamic
      )
    })

  // #9534: if a component with scoped slots is inside a conditional branch,
  // it's possible for the same component to be reused but with different
  // compiled slot content. To avoid that, we generate a unique key based on
  // the generated code of all the slot contents.
  let needsKey = !!el.if

  // OR when it is inside another scoped slot or v-for (the reactivity may be
  // disconnected due to the intermediate scope variable)
  // #9438, #9506
  // TODO: this can be further optimized by properly analyzing in-scope bindings
  // and skip force updating ones that do not actually use scope variables.
  if (!needsForceUpdate) {
    let parent = el.parent
    while (parent) {
      if (
        (parent.slotScope && parent.slotScope !== emptySlotScopeToken) ||
        parent.for
      ) {
        needsForceUpdate = true
        break
      }
      if (parent.if) {
        needsKey = true
      }
      parent = parent.parent
    }
  }

  const generatedSlots = Object.keys(slots)
    .map(key => genScopedSlot(slots[key], state))
    .join(',')

  return `scopedSlots:_u([${generatedSlots}]${
    needsForceUpdate ? `,null,true` : ``
  }${
    !needsForceUpdate && needsKey ? `,null,false,${hash(generatedSlots)}` : ``
  })`
}

/**
 * 计算字符串的哈希值。
 * 使用了 DJB2 哈希算法。
 *
 * @param str 要计算哈希值的字符串
 * @returns 计算得到的无符号整数哈希值
 */
function hash(str) {
  let hash = 5381
  let i = str.length
  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i)
  }
  return hash >>> 0
}

/**
 * 检查是否包含插槽子节点
 * @param el 抽象语法树 (AST) 节点
 * @returns 如果包含插槽子节点则返回 true，否则返回 false
 */
function containsSlotChild(el: ASTNode): boolean {
  if (el.type === 1) {
    /** 如果当前节点是插槽节点 */
    if (el.tag === 'slot') {
      return true
    }
    /** 遍历子节点递归检查是否包含插槽子节点 */
    return el.children.some(containsSlotChild)
  }
  /** 非元素节点直接返回 false */
  return false
}

/**
 * 生成作用域插槽的代码字符串。
 *
 * @param el - 抽象语法树 (AST) 中的元素节点。
 * @param state - 当前代码生成的状态对象。
 * @returns 表示作用域插槽的代码字符串。
 */
function genScopedSlot(el: ASTElement, state: CodegenState): string {
  const isLegacySyntax = el.attrsMap['slot-scope']
  if (el.if && !el.ifProcessed && !isLegacySyntax) {
    return genIf(el, state, genScopedSlot, `null`)
  }
  if (el.for && !el.forProcessed) {
    return genFor(el, state, genScopedSlot)
  }
  /**
   * 插槽的作用域，若为空则使用默认值。
   */
  const slotScope =
    el.slotScope === emptySlotScopeToken ? `` : String(el.slotScope)
  /**
   * 插槽的渲染函数。
   */
  const fn =
    `function(${slotScope}){` +
    `return ${
      el.tag === 'template'
        ? el.if && isLegacySyntax
          ? `(${el.if})?${genChildren(el, state) || 'undefined'}:undefined`
          : genChildren(el, state) || 'undefined'
        : genElement(el, state)
    }}`
  /**
   * 反向代理未定义作用域的 v-slot 到 this.$slots。
   */
  const reverseProxy = slotScope ? `` : `,proxy:true`
  return `{key:${el.slotTarget || `"default"`},fn:${fn}${reverseProxy}}`
}

/**
 * 生成子节点的代码字符串。
 * @param el 当前的 AST 元素。
 * @param state 当前的代码生成状态。
 * @param checkSkip 是否检查跳过规范化。
 * @param altGenElement 可选的替代元素生成函数。
 * @param altGenNode 可选的替代节点生成函数。
 * @returns 返回生成的子节点代码字符串或 undefined。
 */
export function genChildren(
  el: ASTElement,
  state: CodegenState,
  checkSkip?: boolean,
  altGenElement?: Function,
  altGenNode?: Function
): string | void {
  /** 子节点数组 */
  const children = el.children
  if (children.length) {
    /** 第一个子节点 */
    const el: any = children[0]
    // 优化单个 v-for 的情况
    if (
      children.length === 1 &&
      el.for &&
      el.tag !== 'template' &&
      el.tag !== 'slot'
    ) {
      /** 规范化类型 */
      const normalizationType = checkSkip
        ? state.maybeComponent(el)
          ? `,1`
          : `,0`
        : ``
      return `${(altGenElement || genElement)(el, state)}${normalizationType}`
    }
    /** 规范化类型 */
    const normalizationType = checkSkip
      ? getNormalizationType(children, state.maybeComponent)
      : 0
    /** 节点生成函数 */
    const gen = altGenNode || genNode
    return `[${children.map(c => gen(c, state)).join(',')}]${
      normalizationType ? `,${normalizationType}` : ''
    }`
  }
}

// determine the normalization needed for the children array.
// 0: no normalization needed
// 1: simple normalization needed (possible 1-level deep nested array)
// 2: full normalization needed
/**
 * 确定子节点数组所需的规范化类型。
 * @param children 子节点数组。
 * @param maybeComponent 判断是否为组件的函数。
 * @returns 返回规范化类型：
 * - 0：不需要规范化。
 * - 1：需要简单规范化（可能存在一层嵌套数组）。
 * - 2：需要完全规范化。
 */
function getNormalizationType(
  children: Array<ASTNode>,
  maybeComponent: (el: ASTElement) => boolean
): number {
  /** 存储规范化类型的结果 */
  let res = 0
  for (let i = 0; i < children.length; i++) {
    /** 当前子节点 */
    const el: ASTNode = children[i]
    if (el.type !== 1) {
      continue
    }
    if (
      needsNormalization(el) ||
      (el.ifConditions &&
        el.ifConditions.some(c => needsNormalization(c.block)))
    ) {
      res = 2
      break
    }
    if (
      maybeComponent(el) ||
      (el.ifConditions && el.ifConditions.some(c => maybeComponent(c.block)))
    ) {
      res = 1
    }
  }
  return res
}

/**
 * 判断一个 AST 元素是否需要标准化处理。
 *
 * 标准化处理的条件包括：
 * - 元素存在 `for` 属性（表示是一个循环节点）。
 * - 元素的标签是 `template`（表示是一个模板节点）。
 * - 元素的标签是 `slot`（表示是一个插槽节点）。
 *
 * @param el - 要检查的 AST 元素。
 * @returns 如果需要标准化处理，则返回 `true`，否则返回 `false`。
 */
function needsNormalization(el: ASTElement): boolean {
  return el.for !== undefined || el.tag === 'template' || el.tag === 'slot'
}

/**
 * 根据节点类型生成对应的代码字符串。
 * @param node - 抽象语法树节点，包含节点的类型和其他相关信息。
 * @param state - 代码生成状态对象，包含生成代码时所需的上下文信息。
 * @returns 生成的代码字符串。
 */
function genNode(node: ASTNode, state: CodegenState): string {
  if (node.type === 1) {
    return genElement(node, state)
  } else if (node.type === 3 && node.isComment) {
    return genComment(node)
  } else {
    return genText(node)
  }
}

/**
 * 生成文本节点的代码字符串。
 * @param text - 文本节点对象，可以是 `ASTText` 或 `ASTExpression`。
 *   - 如果 `text.type` 为 2，则表示是表达式，直接返回 `text.expression`。
 *   - 否则，将文本内容通过 `JSON.stringify` 转换后，处理特殊换行符。
 * @returns 返回生成的代码字符串，格式为 `_v(...)`。
 */
export function genText(text: ASTText | ASTExpression): string {
  return `_v(${
    text.type === 2
      ? text.expression // no need for () because already wrapped in _s()
      : transformSpecialNewlines(JSON.stringify(text.text))
  })`
}

/**
 * 生成注释节点的代码字符串。
 * @param comment 注释节点对象。
 * @returns 返回生成的注释代码字符串。
 */
export function genComment(comment: ASTText): string {
  return `_e(${JSON.stringify(comment.text)})`
}

/**
 * 生成插槽的渲染代码，是 Vue 2 模板编译器中将模板中的 <slot> 标签转换为可执行 JavaScript 代码的关键部分
 * @param el 插槽元素的 AST 节点对象
 * @param state 代码生成的状态对象，包含编译选项和上下文
 * @returns
 */
function genSlot(el: ASTElement, state: CodegenState): string {
  /**
   * 生成插槽的名称，默认为 "default"
   */
  const slotName = el.slotName || '"default"'

  /**
   * 生成插槽的子节点代码
   */
  const children = genChildren(el, state)

  /**
   * 插槽的代码字符串，包含插槽名称和子节点
   */
  let res = `_t(${slotName}${children ? `,function(){return ${children}}` : ''}`

  /**
   * 插槽的属性，包含静态和动态属性，属性名会被驼峰化
   */
  const attrs =
    el.attrs || el.dynamicAttrs
      ? genProps(
          (el.attrs || []).concat(el.dynamicAttrs || []).map(attr => ({
            // 插槽属性名会被驼峰化
            name: camelize(attr.name),
            value: attr.value,
            dynamic: attr.dynamic
          }))
        )
      : null

  /**
   * 插槽的绑定属性，来自 v-bind
   */
  const bind = el.attrsMap['v-bind']
  if ((attrs || bind) && !children) {
    res += `,null`
  }
  if (attrs) {
    res += `,${attrs}`
  }
  if (bind) {
    res += `${attrs ? '' : ',null'},${bind}`
  }
  return res + ')'
}

// componentName is el.component, take it as argument to shun flow's pessimistic refinement
/**
 * 生成组件的代码字符串。
 * @param componentName 组件的名称。
 * @param el 抽象语法树 (AST) 元素，表示组件的节点。
 * @param state 当前代码生成的状态对象。
 * @returns 返回生成的组件代码字符串。
 */
function genComponent(
  /**
   * 组件的名称。
   */
  componentName: string,
  /**
   * 抽象语法树 (AST) 元素，表示组件的节点。
   */
  el: ASTElement,
  /**
   * 当前代码生成的状态对象。
   */
  state: CodegenState
): string {
  const children = el.inlineTemplate ? null : genChildren(el, state, true)
  return `_c(${componentName},${genData(el, state)}${
    children ? `,${children}` : ''
  })`
}

/**
 * 根据传入的属性数组生成属性字符串。
 * @param props 属性数组，每个元素包含属性的名称和值。
 * @returns 返回生成的属性字符串。如果存在动态属性，则返回动态属性和静态属性的组合；否则仅返回静态属性。
 */
function genProps(props: Array<ASTAttr>): string {
  /**
   * 静态属性字符串，用于存储非动态的属性键值对。
   */
  let staticProps = ``

  /**
   * 动态属性字符串，用于存储动态的属性键值对。
   */
  let dynamicProps = ``
  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    const value = transformSpecialNewlines(prop.value)
    if (prop.dynamic) {
      dynamicProps += `${prop.name},${value},`
    } else {
      staticProps += `"${prop.name}":${value},`
    }
  }
  staticProps = `{${staticProps.slice(0, -1)}}`
  if (dynamicProps) {
    return `_d(${staticProps},[${dynamicProps.slice(0, -1)}])`
  } else {
    return staticProps
  }
}

// #3895, #4268
/**
 * 转换特殊的换行符为对应的转义字符。
 *
 * 该函数会将字符串中的 Unicode 特殊换行符 `\u2028` 和段分隔符 `\u2029`
 * 替换为其对应的转义形式 `\\u2028` 和 `\\u2029`。
 *
 * @param text 要处理的字符串。
 * @returns 转换后的字符串，其中的特殊换行符已被替换为转义字符。
 */
function transformSpecialNewlines(text: string): string {
  return text.replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}
