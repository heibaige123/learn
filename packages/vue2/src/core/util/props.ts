import { warn } from './debug'
import { observe, toggleObserving, shouldObserve } from '../observer/index'
import {
  hasOwn,
  isArray,
  isObject,
  isFunction,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'
import type { Component } from 'types/component'

/**
 * PropOptions 类型定义，用于描述 Vue 组件的 prop 配置选项。
 */
type PropOptions = {
  /** 定义 prop 的类型，可以是单个构造函数或构造函数数组，表示允许的类型。 */
  type: Function | Array<Function> | null
  /** 定义 prop 的默认值，可以是任意类型。 */
  default: any
  /** 可选属性，表示该 prop 是否为必填项。 */
  required?: boolean
  /** 可选属性，自定义验证函数，用于验证 prop 的值是否符合要求。 */
  validator?: Function
}

/**
 * 验证属性的值是否符合定义的属性选项。
 * @param key 属性的键名
 * @param propOptions 定义的属性选项对象
 * @param propsData 传入的属性数据对象
 * @param vm 可选的 Vue 组件实例
 * @returns 验证后的属性值
 */
export function validateProp(
  /** 属性的键名 */
  key: string,
  /** 定义的属性选项对象 */
  propOptions: Object,
  /** 传入的属性数据对象 */
  propsData: Object,
  /** 可选的 Vue 组件实例 */
  vm?: Component
): any {
  const prop = propOptions[key]
  const absent = !hasOwn(propsData, key)
  let value = propsData[key]
  // boolean casting
  const booleanIndex = getTypeIndex(Boolean, prop.type)
  if (booleanIndex > -1) {
    if (absent && !hasOwn(prop, 'default')) {
      value = false
    } else if (value === '' || value === hyphenate(key)) {
      // only cast empty string / same name to boolean if
      // boolean has higher priority
      const stringIndex = getTypeIndex(String, prop.type)
      if (stringIndex < 0 || booleanIndex < stringIndex) {
        value = true
      }
    }
  }
  // check default value
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldObserve = shouldObserve
    toggleObserving(true)
    observe(value)
    toggleObserving(prevShouldObserve)
  }
  if (__DEV__) {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * Get the default value of a prop.
 */
/**
 * 获取 prop 的默认值
 * @param vm Vue 组件实例（可选）
 * @param prop 属性选项对象
 * @param key 属性的键名
 * @returns 默认值
 */
function getPropDefaultValue(
  /** Vue 组件实例（可选） */
  vm: Component | undefined,
  /** 属性选项对象 */
  prop: PropOptions,
  /** 属性的键名 */
  key: string
): any {
  // no default, return undefined
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // warn against non-factory defaults for Object & Array
  if (__DEV__ && isObject(def)) {
    warn(
      'Invalid default value for prop "' +
        key +
        '": ' +
        'Props with type Object/Array must use a factory function ' +
        'to return the default value.',
      vm
    )
  }
  // the raw prop value was also undefined from previous render,
  // return previous default value to avoid unnecessary watcher trigger
  if (
    vm &&
    vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // call factory function for non-Function types
  // a value is Function if its prototype is function even across different execution context
  return isFunction(def) && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
/**
 * 验证属性是否符合要求。
 * @param prop 属性的选项对象。
 * @param name 属性的名称。
 * @param value 属性的值。
 * @param vm 可选，Vue 组件实例。
 * @param absent 可选，表示属性是否缺失。
 */
function assertProp(
  /**
   * 属性的选项对象，包含类型、验证器等信息。
   */
  prop: PropOptions,
  /**
   * 属性的名称。
   */
  name: string,
  /**
   * 属性的值。
   */
  value: any,
  /**
   * 可选，Vue 组件实例，用于上下文警告信息。
   */
  vm?: Component,
  /**
   * 可选，表示属性是否缺失。
   */
  absent?: boolean
) {
  if (prop.required && absent) {
    warn('Missing required prop: "' + name + '"', vm)
    return
  }
  if (value == null && !prop.required) {
    return
  }
  let type = prop.type
  let valid = !type || (type as any) === true
  const expectedTypes: string[] = []
  if (type) {
    if (!isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i], vm)
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }

  const haveExpectedTypes = expectedTypes.some(t => t)
  if (!valid && haveExpectedTypes) {
    warn(getInvalidTypeMessage(name, value, expectedTypes), vm)
    return
  }
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

/**
 * 一个用于检查简单类型的正则表达式。
 * 匹配的类型包括：String、Number、Boolean、Function、Symbol 和 BigInt。
 */
const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol|BigInt)$/

/**
 * 检查值是否符合指定的类型。
 * @param value - 要检查的值。
 * @param type - 期望的类型构造函数。
 * @param vm - 可选的 Vue 组件实例，用于在警告中提供上下文。
 * @returns 一个对象，包含 `valid` 表示值是否有效，以及 `expectedType` 表示期望的类型。
 */
function assertType(
  /**
   * 要检查的值。
   */
  value: any,
  /**
   * 期望的类型构造函数。
   */
  type: Function,
  /**
   * 可选的 Vue 组件实例，用于在警告中提供上下文。
   */
  vm?: Component
): {
  /**
   * 值是否符合期望的类型。
   */
  valid: boolean
  /**
   * 期望的类型名称。
   */
  expectedType: string
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = isArray(value)
  } else {
    try {
      valid = value instanceof type
    } catch (e: any) {
      warn('Invalid prop type: "' + String(type) + '" is not a constructor', vm)
      valid = false
    }
  }
  return {
    valid,
    expectedType
  }
}

/**
 * 用于匹配函数类型的正则表达式。
 * 该正则表达式会匹配以 "function" 开头，后跟一个函数名称的字符串。
 *
 * 示例匹配：
 * - "function myFunction" -> 匹配 "myFunction"
 * - "function " -> 不匹配（因为没有函数名称）
 */
const functionTypeCheckRE = /^\s*function (\w+)/

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
/**
 * 获取函数的类型名称。
 *
 * @param fn - 一个函数，用于提取其类型名称。
 * @returns 如果匹配成功，返回函数的类型名称；否则返回空字符串。
 */
function getType(fn) {
  const match = fn && fn.toString().match(functionTypeCheckRE)
  return match ? match[1] : ''
}

/**
 * 检查两个值是否为相同的类型。
 * @param a - 第一个值，用于比较类型。
 * @param b - 第二个值，用于比较类型。
 * @returns 如果两个值的类型相同，则返回 true；否则返回 false。
 */
function isSameType(a, b) {
  return getType(a) === getType(b)
}

/**
 * 检查类型是否在预期类型列表中，并返回其索引。
 * @param type - 要检查的类型。
 * @param expectedTypes - 预期的类型或类型数组。
 * @returns 如果类型匹配，返回索引；否则返回 -1。
 */
function getTypeIndex(type, expectedTypes): number {
  if (!isArray(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  for (let i = 0, len = expectedTypes.length; i < len; i++) {
    if (isSameType(expectedTypes[i], type)) {
      return i
    }
  }
  return -1
}

/**
 * 获取无效类型的错误消息。
 * @param name - 属性的名称。
 * @param value - 属性的实际值。
 * @param expectedTypes - 预期的类型数组。
 * @returns 返回描述无效类型的错误消息字符串。
 */
function getInvalidTypeMessage(name, value, expectedTypes) {
  let message =
    `Invalid prop: type check failed for prop "${name}".` +
    ` Expected ${expectedTypes.map(capitalize).join(', ')}`
  const expectedType = expectedTypes[0]
  const receivedType = toRawType(value)
  // check if we need to specify expected value
  if (
    expectedTypes.length === 1 &&
    isExplicable(expectedType) &&
    isExplicable(typeof value) &&
    !isBoolean(expectedType, receivedType)
  ) {
    message += ` with value ${styleValue(value, expectedType)}`
  }
  message += `, got ${receivedType} `
  // check if we need to specify received value
  if (isExplicable(receivedType)) {
    message += `with value ${styleValue(value, receivedType)}.`
  }
  return message
}

/**
 * 根据传入的值和类型返回格式化后的样式值。
 *
 * @param value - 需要格式化的值。
 * @param type - 值的类型，可以是 'String'、'Number' 或其他类型。
 * @returns 格式化后的样式值。如果类型是 'String'，返回带双引号的字符串；
 * 如果类型是 'Number'，返回数值；否则直接返回原值。
 */
function styleValue(value, type) {
  if (type === 'String') {
    return `"${value}"`
  } else if (type === 'Number') {
    return `${Number(value)}`
  } else {
    return `${value}`
  }
}

/**
 * 用于定义可以被明确解释的类型数组。
 * 包含以下三种类型：
 * - 'string': 表示字符串类型
 * - 'number': 表示数字类型
 * - 'boolean': 表示布尔类型
 */
const EXPLICABLE_TYPES = ['string', 'number', 'boolean']
/**
 * 判断给定的值是否可以被解释。
 *
 * @param value - 要检查的值。
 * @returns 如果值可以被解释，则返回 true；否则返回 false。
 */
function isExplicable(value) {
  return EXPLICABLE_TYPES.some(elem => value.toLowerCase() === elem)
}

/**
 * 检查是否至少有一个参数的值为字符串 'boolean'（忽略大小写）。
 *
 * @param args - 任意数量的字符串参数。
 * @returns 如果至少有一个参数为 'boolean'（忽略大小写），返回 true；否则返回 false。
 */
function isBoolean(...args) {
  return args.some(elem => elem.toLowerCase() === 'boolean')
}
