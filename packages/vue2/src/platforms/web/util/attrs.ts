import { makeMap } from 'shared/util'

/**
 * 定义保留属性集合。
 * 这些属性在模板编译期间会被直接移除。
 */
export const isReservedAttr = makeMap('style,class')

/**
 * 定义接受 `value` 属性的标签集合。
 * 这些标签在绑定 `value` 属性时需要使用 prop。
 */
const acceptValue = makeMap('input,textarea,option,select,progress')
/**
 * 判断是否必须使用 prop 绑定的属性
 *
 * 该函数用于确定某些属性是否需要通过 prop 绑定，而不是普通的 attribute。
 * 例如，对于 `value` 属性，如果标签是 `input`、`textarea` 等，并且类型不是 `button`，
 * 则需要使用 prop 绑定。
 *
 * @param tag - 标签名，例如 'input'、'textarea' 等。
 * @param type - 可选，标签的类型属性值，例如 'text'、'button' 等。
 * @param attr - 可选，属性名，例如 'value'、'selected' 等。
 * @returns 如果属性需要使用 prop 绑定，则返回 true；否则返回 false。
 */
export const mustUseProp = (
  tag: string,
  type?: string | null,
  attr?: string
): boolean => {
  return (
    (attr === 'value' && acceptValue(tag) && type !== 'button') ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
}

/**
 * 判断是否为枚举属性
 *
 * 该函数通过 `makeMap` 工具函数生成一个映射，用于快速判断属性名是否为
 * `contenteditable`、`draggable` 或 `spellcheck`。
 */
export const isEnumeratedAttr = makeMap('contenteditable,draggable,spellcheck')

/**
 * 用于检查给定的值是否是有效的 contenteditable 属性值。
 * 有效值包括：'events', 'caret', 'typing', 'plaintext-only'。
 */
const isValidContentEditableValue = makeMap(
  'events,caret,typing,plaintext-only'
)

/**
 * 将枚举值转换为字符串表示形式。
 *
 * @param key - 属性的键名。
 * @param value - 属性的值，可以是任意类型。
 * @returns 如果值为假值或字符串 'false'，返回 'false'；
 *          如果键名为 'contenteditable' 且值为有效的 contenteditable 值，返回原值；
 *          否则返回 'true'。
 */
export const convertEnumeratedValue = (key: string, value: any) => {
  return isFalsyAttrValue(value) || value === 'false'
    ? 'false'
    : // allow arbitrary string value for contenteditable
    key === 'contenteditable' && isValidContentEditableValue(value)
    ? value
    : 'true'
}

/**
 * 定义布尔属性的集合。
 * 布尔属性是指其存在与否决定了其值的属性，
 * 通常用于 HTML 元素中。
 */
export const isBooleanAttr = makeMap(
  'allowfullscreen,async,autofocus,autoplay,checked,compact,controls,declare,' +
    'default,defaultchecked,defaultmuted,defaultselected,defer,disabled,' +
    'enabled,formnovalidate,hidden,indeterminate,inert,ismap,itemscope,loop,multiple,' +
    'muted,nohref,noresize,noshade,novalidate,nowrap,open,pauseonexit,readonly,' +
    'required,reversed,scoped,seamless,selected,sortable,' +
    'truespeed,typemustmatch,visible'
)

/**
 * 定义 xlink 命名空间的常量。
 * 该命名空间用于处理与 XML 链接相关的属性。
 */
export const xlinkNS = 'http://www.w3.org/1999/xlink'

/**
 * 判断给定的名称是否为 XLink 属性。
 *
 * XLink 是一种 XML 命名空间，用于定义链接属性。
 * 此函数通过检查名称的前五个字符是否为 'xlink'，
 * 并且第六个字符是否为 ':' 来判断。
 *
 * @param name - 要检查的属性名称。
 * @returns 如果名称符合 XLink 格式，则返回 true；否则返回 false。
 */
export const isXlink = (name: string): boolean => {
  return name.charAt(5) === ':' && name.slice(0, 5) === 'xlink'
}

/**
 * 获取去掉 `xlink:` 前缀的属性名。
 * 如果属性名符合 `xlink:` 前缀规则，则返回去掉前缀后的部分；
 * 否则返回空字符串。
 *
 * @param name - 属性名字符串
 * @returns 去掉 `xlink:` 前缀的属性名或空字符串
 */
export const getXlinkProp = (name: string): string => {
  return isXlink(name) ? name.slice(6, name.length) : ''
}

/**
 * 判断属性值是否为假值
 *
 * 如果属性值为 `null` 或 `false`，则认为是假值。
 *
 * @param val - 任意类型的属性值
 * @returns 如果属性值为假值，返回 `true`；否则返回 `false`
 */
export const isFalsyAttrValue = (val: any): boolean => {
  return val == null || val === false
}
