import { BindingMetadata } from 'sfc/types'

/**
 * 编译器选项的类型定义
 */
export type CompilerOptions = {
  /** 自定义警告函数 */
  warn?: Function
  /** 平台特定的模块数组，例如样式、类 */
  modules?: Array<ModuleOptions>
  /** 平台特定的指令集合 */
  directives?: { [key: string]: Function }
  /** 用于优化的静态 AST 属性列表 */
  staticKeys?: string
  /** 检查标签是否为一元标签 */
  isUnaryTag?: (tag: string) => boolean | undefined
  /** 检查标签是否可以省略闭合 */
  canBeLeftOpenTag?: (tag: string) => boolean | undefined
  /** 检查标签是否为平台保留标签 */
  isReservedTag?: (tag: string) => boolean | undefined
  /** 是否保留元素之间的空格（已废弃） */
  preserveWhitespace?: boolean
  /** 空白字符处理策略 */
  whitespace?: 'preserve' | 'condense'
  /** 是否优化静态内容 */
  optimize?: boolean

  // web 特定选项
  /** 检查属性是否应绑定为属性 */
  mustUseProp?: (tag: string, type: string | null, name: string) => boolean
  /** 检查标签是否需要保留空格 */
  isPreTag?: (attr: string) => boolean | null
  /** 检查标签的命名空间 */
  getTagNamespace?: (tag: string) => string | undefined
  /** 是否仅针对 HTML 构建 */
  expectHTML?: boolean
  /** 是否来自 DOM */
  isFromDOM?: boolean
  /** 是否解码标签 */
  shouldDecodeTags?: boolean
  /** 是否解码换行符 */
  shouldDecodeNewlines?: boolean
  /** 是否为 href 解码换行符 */
  shouldDecodeNewlinesForHref?: boolean
  /** 是否输出源码范围 */
  outputSourceRange?: boolean
  /** 是否保留模板中的注释 */
  shouldKeepComment?: boolean

  // 运行时用户可配置选项
  /** 模板分隔符 */
  delimiters?: [string, string]
  /** 是否保留模板中的注释 */
  comments?: boolean

  // 用于 SSR 优化的编译器选项
  /** 作用域 ID */
  scopeId?: string

  // 从 `compileScript()` 分析的 SFC 脚本绑定
  /** 脚本绑定元数据 */
  bindings?: BindingMetadata
}

/**
 * 警告信息对象，包含警告的消息和可选的起始与结束位置。
 */
export type WarningMessage = {
  /**
   * 警告的消息内容。
   */
  msg: string
  /**
   * 警告的起始位置（可选）。
   */
  start?: number
  /**
   * 警告的结束位置（可选）。
   */
  end?: number
}

/**
 * 编译结果的抽象表示
 */
export type CompiledResult = {
  /** 抽象语法树的根节点 */
  ast: ASTElement | null
  /** 渲染函数的字符串表示 */
  render: string
  /** 静态渲染函数的数组 */
  staticRenderFns: Array<string>
  /** 字符串渲染函数的数组（可选） */
  stringRenderFns?: Array<string>
  /** 编译过程中产生的错误信息数组（可选） */
  errors?: Array<string | WarningMessage>
  /** 编译过程中产生的提示信息数组（可选） */
  tips?: Array<string | WarningMessage>
}

/**
 * 模块选项类型定义
 */
export type ModuleOptions = {
  /**
   * 在处理任何属性之前转换 AST 节点
   * 返回一个 ASTElement 替换当前元素
   */
  preTransformNode?: (el: ASTElement) => ASTElement | null | void

  /**
   * 在处理内置指令（如 v-if、v-for）之后转换 AST 节点
   * 返回一个 ASTElement 替换当前元素
   */
  transformNode?: (el: ASTElement) => ASTElement | null | void

  /**
   * 在子节点处理完成后转换 AST 节点
   * 不能在 postTransform 中返回替换节点，因为树已经最终确定
   */
  postTransformNode?: (el: ASTElement) => void

  /**
   * 为元素生成额外的数据字符串
   */
  genData?: (el: ASTElement) => string

  /**
   * 进一步转换为元素生成的代码
   */
  transformCode?: (el: ASTElement, code: string) => string

  /**
   * 被视为静态的 AST 属性列表
   */
  staticKeys?: Array<string>
}

/**
 * AST 修饰符的类型定义。
 * 键是字符串类型，表示修饰符的名称。
 * 值是布尔类型，表示修饰符是否启用。
 */
export type ASTModifiers = { [key: string]: boolean }
/**
 * 表示一个条件分支的结构。
 * @property exp 条件表达式，可以为字符串或 null。
 * @property block 对应的 AST 元素块。
 */
export type ASTIfCondition = { exp: string | null; block: ASTElement }
/**
 * 表示 AST 中的条件数组，每个条件由 ASTIfCondition 类型定义。
 */
export type ASTIfConditions = Array<ASTIfCondition>

/**
 * HTML 元素属性的抽象语法树节点类型
 * @example

      // id="app" 属性
      {
        name: "id",
        value: "app",
        start: 5,
        end: 13
      }

      // :class="dynamicClass" 属性
      {
        name: "class",
        value: "dynamicClass",
        dynamic: true,
        start: 14,
        end: 34
      }
 */
export type ASTAttr = {
  /**
   * 属性的名称
   */
  name: string

  /**
   * 属性的值
   */
  value: any

  /**
   * 是否为动态属性
   */
  dynamic?: boolean

  /**
   * 属性的起始位置
   */
  start?: number

  /**
   * 属性的结束位置
   */
  end?: number
}

/**
 * 表示 AST 元素处理程序的类型定义
 *
 * @example
    {
      value: "handleClick($event, 'param')",
      modifiers: { stop: true },
      params: ["$event", "'param'"],
      start: 15,
      end: 48
    }
 */
export type ASTElementHandler = {
  /** 处理程序的值 */
  value: string
  /** 处理程序的参数数组（可选） */
  params?: Array<any>
  /** 修饰符对象，表示处理程序的修饰符集合 */
  modifiers: ASTModifiers | null
  /** 是否为动态处理程序（可选） */
  dynamic?: boolean
  /** 处理程序的起始位置（可选） */
  start?: number
  /** 处理程序的结束位置（可选） */
  end?: number
}

/**
 * AST元素的事件处理程序集合。
 * 键是事件名称，值可以是单个事件处理程序或事件处理程序数组。
 */
export type ASTElementHandlers = {
  [key: string]: ASTElementHandler | Array<ASTElementHandler>
}

/**
 *
 * @example
      <div v-if="isVisible">内容</div>
      {
        name: "if",
        rawName: "v-if",
        value: "isVisible",
        arg: null,
        isDynamicArg: false,
        modifiers: null,
        start: 5,
        end: 22
      }


    <div v-bind:class="myClass">内容</div>
      {
        name: "bind",
        rawName: "v-bind:class",
        value: "myClass",
        arg: "class",
        isDynamicArg: false,
        modifiers: null,
        start: 5,
        end: 27
      }
 */
export type ASTDirective = {
  /**
   * 指令的名称，例如 v-if 中的 "if"
   */
  name: string

  /**
   * 指令的原始名称，例如 v-if 中的 "v-if"
   */
  rawName: string

  /**
   * 指令的值，例如 v-if="condition" 中的 "condition"
   */
  value: string

  /**
   * 指令的参数，例如 v-bind:prop 中的 "prop"，如果没有参数则为 null
   */
  arg: string | null

  /**
   * 指令参数是否是动态的，例如 v-bind:[prop] 中的参数是动态的
   */
  isDynamicArg: boolean

  /**
   * 指令的修饰符，例如 v-on:click.stop 中的 { stop: true }
   */
  modifiers: ASTModifiers | null

  /**
   * 指令在模板字符串中的起始位置（可选）
   */
  start?: number

  /**
   * 指令在模板字符串中的结束位置（可选）
   */
  end?: number
}

/**
 * ASTNode 类型表示抽象语法树中的节点。
 */
export type ASTNode = ASTElement | ASTText | ASTExpression

/**
 * AST 元素的类型定义
 */
export type ASTElement = {
  /** 节点类型，固定为 1 */
  type: 1
  /** 标签名称 */
  tag: string
  /** 属性列表 */
  attrsList: Array<ASTAttr>
  /** 属性映射表 */
  attrsMap: { [key: string]: any }
  /** 原始属性映射表 */
  rawAttrsMap: { [key: string]: ASTAttr }
  /** 父节点 */
  parent: ASTElement | void
  /** 子节点数组 */
  children: Array<ASTNode>

  /** 节点的起始位置 */
  start?: number
  /** 节点的结束位置 */
  end?: number

  /** 是否已处理 */
  processed?: true

  /** 是否为静态节点 */
  static?: boolean
  /** 是否为静态根节点 */
  staticRoot?: boolean
  /** 是否在 v-for 中为静态节点 */
  staticInFor?: boolean
  /** 静态节点是否已处理 */
  staticProcessed?: boolean
  /** 是否包含绑定 */
  hasBindings?: boolean

  /** 文本内容 */
  text?: string
  /** 属性数组 */
  attrs?: Array<ASTAttr>
  /** 动态属性数组 */
  dynamicAttrs?: Array<ASTAttr>
  /** 属性绑定数组 */
  props?: Array<ASTAttr>
  /** 是否为普通节点 */
  plain?: boolean
  /** 是否为 v-pre 节点 */
  pre?: true
  /** 命名空间 */
  ns?: string

  /** 组件名称 */
  component?: string
  /** 是否为内联模板 */
  inlineTemplate?: true
  /** 过渡模式 */
  transitionMode?: string | null
  /** 插槽名称 */
  slotName?: string | null
  /** 插槽目标 */
  slotTarget?: string | null
  /** 插槽目标是否为动态 */
  slotTargetDynamic?: boolean
  /** 插槽作用域 */
  slotScope?: string | null
  /** 作用域插槽集合 */
  scopedSlots?: { [name: string]: ASTElement }

  /** 引用名称 */
  ref?: string
  /** 引用是否在 v-for 中 */
  refInFor?: boolean

  /** v-if 表达式 */
  if?: string
  /** v-if 是否已处理 */
  ifProcessed?: boolean
  /** v-else-if 表达式 */
  elseif?: string
  /** 是否为 v-else 节点 */
  else?: true
  /** 条件分支数组 */
  ifConditions?: ASTIfConditions

  /** v-for 表达式 */
  for?: string
  /** v-for 是否已处理 */
  forProcessed?: boolean
  /** v-for 的 key */
  key?: string
  /** v-for 的别名 */
  alias?: string
  /** v-for 的第一个迭代器 */
  iterator1?: string
  /** v-for 的第二个迭代器 */
  iterator2?: string

  /** 静态类名 */
  staticClass?: string
  /** 动态类名绑定 */
  classBinding?: string
  /** 静态样式 */
  staticStyle?: string
  /** 动态样式绑定 */
  styleBinding?: string
  /** 事件处理程序集合 */
  events?: ASTElementHandlers
  /** 原生事件处理程序集合 */
  nativeEvents?: ASTElementHandlers

  /** 过渡名称 */
  transition?: string | true
  /** 是否在出现时触发过渡 */
  transitionOnAppear?: boolean

  /** v-model 的数据模型 */
  model?: {
    /** 模型的值 */
    value: string
    /** 模型的回调函数 */
    callback: string
    /** 模型的表达式 */
    expression: string
  }

  /** 指令数组 */
  directives?: Array<ASTDirective>

  /** 是否为禁止的节点 */
  forbidden?: true
  /** 是否为 v-once 节点 */
  once?: true
  /** v-once 是否已处理 */
  onceProcessed?: boolean
  /** 包装数据的函数 */
  wrapData?: (code: string) => string
  /** 包装事件监听器的函数 */
  wrapListeners?: (code: string) => string

  /** 服务端渲染优化级别 */
  ssrOptimizability?: number
}

export type ASTExpression = {
  /**
   * 表达式的类型，固定为 2
   */
  type: 2

  /**
   * 表达式的字符串形式
   */
  expression: string

  /**
   * 表达式的文本内容
   */
  text: string

  /**
   * 表达式的令牌数组，可以是字符串或对象
   */
  tokens: Array<string | Object>

  /**
   * 是否为静态表达式（可选）
   */
  static?: boolean

  /**
   * 用于 SSR 优化的标识（可选）
   */
  ssrOptimizability?: number

  /**
   * 表达式的起始位置（可选）
   */
  start?: number

  /**
   * 表达式的结束位置（可选）
   */
  end?: number
}

export type ASTText = {
  /**
   * 文本节点的类型标识，固定为 3
   */
  type: 3

  /**
   * 文本节点的内容
   */
  text: string

  /**
   * 是否为静态文本
   */
  static?: boolean

  /**
   * 是否为注释节点
   */
  isComment?: boolean

  /**
   * 服务端渲染优化级别
   * @since 2.4
   */
  ssrOptimizability?: number

  /**
   * 文本节点的起始位置
   */
  start?: number

  /**
   * 文本节点的结束位置
   */
  end?: number
}
