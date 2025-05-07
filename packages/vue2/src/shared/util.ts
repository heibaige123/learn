/**
 * 一个冻结的空对象，用于避免在代码中意外修改。
 * 这是一个不可变的对象，通常用作默认值或占位符。
 */
export const emptyObject: Record<string, any> = Object.freeze({})

/**
 * 判断一个值是否为 `undefined` 或 `null`
 *
 * @param v - 要检查的值
 * @returns 如果值为 `undefined` 或 `null`，返回 `true`；否则返回 `false`
 */
export function isUndef(v: any): v is undefined | null {
  return v === undefined || v === null
}

/**
 * 检查变量是否已定义且不为 null。
 * @param v - 要检查的变量。
 * @returns 如果变量已定义且不为 null，则返回 true；否则返回 false。
 */
export function isDef<T>(v: T): v is NonNullable<T> {
  return v !== undefined && v !== null
}

/**
 * 判断给定的值是否为 true。
 *
 * @param v - 任意类型的值
 * @returns 如果值为 true，则返回 true；否则返回 false
 */
export function isTrue(v: any): boolean {
  return v === true
}

/**
 * 判断给定的值是否为 `false`。
 *
 * @param v - 任意值
 * @returns 如果值为 `false`，返回 `true`；否则返回 `false`。
 */
export function isFalse(v: any): boolean {
  return v === false
}

/**
 * 检查值是否为原始类型。
 * 原始类型包括：字符串、数字、符号和布尔值。
 */
export function isPrimitive(value: any): boolean {
  return Object(value) !== value
}

/**
 * 判断给定的值是否为函数类型
 *
 * @param value - 任意值
 * @returns 如果值是函数类型，则返回 true；否则返回 false
 */
export function isFunction(value: any): value is (...args: any[]) => any {
  return typeof value === 'function'
}

/**
 * Quick object check - this is primarily used to tell
 * objects from primitive values when we know the value
 * is a JSON-compliant type.
 */
/**
 * 判断一个值是否为对象
 * @param obj - 需要检查的值
 * @returns 如果值是对象则返回 true，否则返回 false
 */
export function isObject(obj: any): boolean {
  return obj !== null && typeof obj === 'object'
}

/**
 * Get the raw type string of a value, e.g., [object Object].
 */
/**
 * `_toString` 是对 `Object.prototype.toString` 的引用，
 * 用于获取对象的内部类型表示，通常用于类型判断。
 */
const _toString = Object.prototype.toString

export function toRawType(value: any): string {
  return _toString.call(value).slice(8, -1)
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 */
/**
 * 检查一个对象是否是纯对象。
 *
 * 一个纯对象是通过对象字面量 `{}` 或 `new Object()` 创建的对象。
 *
 * @param obj - 要检查的对象。
 * @returns 如果对象是纯对象，则返回 `true`，否则返回 `false`。
 */
export function isPlainObject(obj: any): boolean {
  return _toString.call(obj) === '[object Object]'
}

/**
 * 判断一个值是否为正则表达式对象
 *
 * @param v - 任意值
 * @returns 如果值是正则表达式对象，则返回 true；否则返回 false
 */
export function isRegExp(v: any): v is RegExp {
  return _toString.call(v) === '[object RegExp]'
}

/**
 * Check if val is a valid array index.
 */
/**
 * 检查给定的值是否是一个有效的数组索引。
 * @param val - 需要验证的值，可以是任意类型。
 * @returns 如果值是一个非负整数且是有限数值，则返回 true；否则返回 false。
 */
export function isValidArrayIndex(val: any): boolean {
  const n = parseFloat(String(val))
  return n >= 0 && Math.floor(n) === n && isFinite(val)
}

/**
 * 判断一个值是否为 Promise 对象
 * @param val 任意值
 * @returns 如果该值是一个 Promise 对象，则返回 true；否则返回 false
 */
export function isPromise(val: any): val is Promise<any> {
  return (
    isDef(val) &&
    typeof val.then === 'function' &&
    typeof val.catch === 'function'
  )
}

/**
 * Convert a value to a string that is actually rendered.
 */
/**
 * 将任意值转换为字符串表示形式。
 *
 * @param val - 需要转换的值，可以是任意类型。
 * @returns 如果值为 `null` 或 `undefined`，返回空字符串；
 *          如果值是数组或普通对象且其 `toString` 方法为默认的 `_toString`，返回格式化的 JSON 字符串；
 *          否则返回值的字符串表示形式。
 */
export function toString(val: any): string {
  return val == null
    ? ''
    : Array.isArray(val) || (isPlainObject(val) && val.toString === _toString)
    ? JSON.stringify(val, replacer, 2)
    : String(val)
}

/**
 * 替换器函数，用于处理对象序列化时的值替换逻辑。
 *
 * @param _key - 当前属性的键名（未使用）。
 * @param val - 当前属性的值。
 * @returns 如果值是一个 Vue 3 的 Ref 对象，则返回其内部的值；否则返回原值。
 */
function replacer(_key: string, val: any): any {
  // avoid circular deps from v3
  if (val && val.__v_isRef) {
    return val.value
  }
  return val
}

/**
 * Convert an input value to a number for persistence.
 * If the conversion fails, return original string.
 */
/**
 * 将字符串转换为数字。
 * @param val - 要转换的字符串。
 * @returns 如果字符串可以被解析为数字，则返回数字；否则返回原始字符串。
 */
export function toNumber(val: string): number | string {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

/**
 * Make a map and return a function for checking if a key
 * is in that map.
 */
/**
 * 创建一个映射表函数，根据传入的字符串生成一个映射表。
 * @param str 用逗号分隔的字符串，用于生成映射表。
 * @param expectsLowerCase 是否期望将键转换为小写。
 * @returns 一个函数，该函数接受一个键并返回 `true` 或 `undefined`。
 *
 *
 * @example
 *    const isFruit = makeMap('apple,banana,orange', true)
 *    console.log(isFruit('apple')) // true
 *    console.log(isFruit('APPLE')) // true (because expectsLowerCase is true)
 *    console.log(isFruit('grape')) // undefined
 */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean
): (key: string) => true | undefined {
  /**
   * 一个用逗号分隔的字符串，用于生成映射表。
   */
  const map = Object.create(null)

  /**
   * 通过逗号分隔的字符串生成的字符串数组。
   */
  const list: Array<string> = str.split(',')
  for (let i = 0; i < list.length; i++) {
    map[list[i]] = true
  }
  return expectsLowerCase ? val => map[val.toLowerCase()] : val => map[val]
}

/**
 * Check if a tag is a built-in tag.
 */
/**
 * 检查给定的标签名是否是内置标签。
 * 内置标签包括 'slot' 和 'component'。
 * @constant
 */
export const isBuiltInTag = makeMap('slot,component', true)

/**
 * Check if an attribute is a reserved attribute.
 */
/**
 * 检查给定的属性名是否是保留属性。
 * 保留属性包括：`key`、`ref`、`slot`、`slot-scope` 和 `is`。
 */
export const isReservedAttribute = makeMap('key,ref,slot,slot-scope,is')

/**
 * Remove an item from an array.
 */
/**
 * 从数组中移除指定的元素。
 * @param arr 要操作的数组。
 * @param item 要移除的元素。
 * @returns 如果找到并移除了元素，返回被移除的元素数组；否则返回 void。
 */
export function remove(arr: Array<any>, item: any): Array<any> | void {
  const len = arr.length
  if (len) {
    // fast path for the only / last item
    if (item === arr[len - 1]) {
      arr.length = len - 1
      return
    }
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

/**
 * Check whether an object has the property.
 */
const hasOwnProperty = Object.prototype.hasOwnProperty
/**
 * 检查对象或数组是否具有指定的自有属性。
 *
 * @param obj 要检查的对象或数组。
 * @param key 要检查的属性键。
 * @returns 如果对象或数组具有指定的自有属性，则返回 true；否则返回 false。
 */
export function hasOwn(obj: Object | Array<any>, key: string): boolean {
  return hasOwnProperty.call(obj, key)
}

/**
 * Create a cached version of a pure function.
 */

/**
 * 创建一个带有缓存功能的函数
 * @param fn 接收一个字符串参数并返回结果的函数
 * @returns 一个带有缓存功能的函数
 */
export function cached<R>(fn: (str: string) => R): (sr: string) => R {
  /**
   * 缓存对象，用于存储函数调用结果
   */
  const cache: Record<string, R> = Object.create(null)
  return function cachedFn(str: string) {
    /**
     * 从缓存中获取结果，如果不存在则调用原函数并存储结果
     */
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }
}

/**
 * Camelize a hyphen-delimited string.
 */
const camelizeRE = /-(\w)/g
/**
 * 将连字符分隔的字符串转换为驼峰命名法的字符串。
 *
 * @param str - 输入的连字符分隔的字符串。
 * @returns 转换为驼峰命名法的字符串。
 */
export const camelize = cached((str: string): string => {
  return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
})

/**
 * Capitalize a string.
 */
/**
 * 将字符串的首字母大写并返回处理后的字符串。
 * 使用缓存机制以提高性能。
 *
 * @param str - 需要处理的字符串
 * @returns 首字母大写后的字符串
 */
export const capitalize = cached((str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1)
})

/**
 * Hyphenate a camelCase string.
 */
const hyphenateRE = /\B([A-Z])/g
/**
 * 将字符串中的大写字母转换为连字符加小写字母的形式。
 * 使用缓存优化性能。
 *
 * @param str 要转换的字符串
 * @returns 转换后的字符串，所有大写字母被替换为连字符加小写字母。
 */
export const hyphenate = cached((str: string): string => {
  return str.replace(hyphenateRE, '-$1').toLowerCase()
})

/**
 * Simple bind polyfill for environments that do not support it,
 * e.g., PhantomJS 1.x. Technically, we don't need this anymore
 * since native bind is now performant enough in most browsers.
 * But removing it would mean breaking code that was able to run in
 * PhantomJS 1.x, so this must be kept for backward compatibility.
 */

/* istanbul ignore next */
/**
 * 一个用于绑定函数上下文的 polyfill 方法。
 *
 * @param fn 要绑定的函数
 * @param ctx 要绑定的上下文对象
 * @returns 返回一个绑定了上下文的函数
 */
function polyfillBind(fn: Function, ctx: Object): Function {
  function boundFn(a: any) {
    const l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }

  boundFn._length = fn.length
  return boundFn
}

/**
 * 一个用于绑定函数上下文的工具函数。
 *
 * @param fn - 需要绑定上下文的函数。
 * @param ctx - 要绑定的上下文对象。
 * @returns 返回一个绑定了指定上下文的函数。
 */
function nativeBind(fn: Function, ctx: Object): Function {
  return fn.bind(ctx)
}

/**
 * `bind` 是一个函数引用，根据环境选择使用原生的 `Function.prototype.bind` 方法，
 * 或者使用自定义的 `polyfillBind` 方法作为兼容性实现。
 *
 * - 如果运行环境支持原生的 `Function.prototype.bind`，则直接使用它。
 * - 如果不支持，则使用 `polyfillBind` 提供的兼容实现。
 */
// @ts-expect-error bind cannot be `undefined`
export const bind = Function.prototype.bind ? nativeBind : polyfillBind

/**
 * Convert an Array-like object to a real Array.
 */
/**
 * 将类数组对象转换为数组
 * @param list 类数组对象
 * @param start 可选参数，指定从哪个索引开始转换，默认为 0
 * @returns 转换后的数组
 */
export function toArray(list: any, start?: number): Array<any> {
  /**
   * 起始索引，默认为 0
   */
  start = start || 0

  /**
   * 需要转换的元素数量
   */
  let i = list.length - start

  /**
   * 存储转换结果的数组
   */
  const ret: Array<any> = new Array(i)

  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

/**
 * Mix properties into target object.
 */
/**
 * 将源对象 `_from` 的属性扩展到目标对象 `to` 中。
 * @param to 目标对象，将被扩展的对象。
 * @param _from 源对象，其属性将被复制到目标对象中。
 * @returns 返回扩展后的目标对象。
 */
export function extend(
  to: Record<PropertyKey, any>,
  _from?: Record<PropertyKey, any>
): Record<PropertyKey, any> {
  for (const key in _from) {
    to[key] = _from[key]
  }
  return to
}

/**
 * Merge an Array of Objects into a single Object.
 */
/**
 * 将一个数组中的对象合并为一个对象。
 * @param arr 一个包含对象的数组。
 * @returns 合并后的对象。
 */
export function toObject(arr: Array<any>): object {
  const res = {}
  /**
   * 遍历数组，将每个对象的属性扩展到结果对象中。
   */
  for (let i = 0; i < arr.length; i++) {
    if (arr[i]) {
      /**
       * 如果数组元素存在，则将其属性扩展到结果对象。
       */
      extend(res, arr[i])
    }
  }
  return res
}

/* eslint-disable no-unused-vars */

/**
 * 一个空操作函数。
 * 为了让 Flow 满意而存根参数，避免在转译代码中留下无用的 ...rest。
 * 参考：https://flow.org/blog/2017/05/07/Strict-Function-Call-Arity/
 */
export function noop(a?: any, b?: any, c?: any) {}

/**
 * 一个始终返回 false 的函数。
 * @param a - 可选参数，任意类型。
 * @param b - 可选参数，任意类型。
 * @param c - 可选参数，任意类型。
 * @returns 始终返回 false。
 */
export const no = (a?: any, b?: any, c?: any) => false

/* eslint-enable no-unused-vars */

/**
 * Return the same value.
 */
/**
 * 一个通用的标识函数，返回传入的参数本身。
 *
 * @param _ 任意类型的输入参数
 * @returns 返回与输入参数相同的值
 */
export const identity = (_: any) => _

/**
 * Generate a string containing static keys from compiler modules.
 */
/**
 * 根据模块数组生成静态键的逗号分隔字符串。
 * @param modules 模块数组，其中每个模块可以包含一个静态键数组 `staticKeys`。
 * @returns 由所有模块的静态键组成的逗号分隔字符串。
 */
export function genStaticKeys(
  modules: Array<{ staticKeys?: string[] } /* ModuleOptions */>
): string {
  return modules
    .reduce<string[]>((keys, m) => keys.concat(m.staticKeys || []), [])
    .join(',')
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 */
/**
 * 比较两个值是否宽松相等。
 * @param a - 第一个值，可以是任意类型。
 * @param b - 第二个值，可以是任意类型。
 * @returns 如果两个值宽松相等，则返回 true；否则返回 false。
 */
export function looseEqual(a: any, b: any): boolean {
  if (a === b) return true
  const isObjectA = isObject(a)
  const isObjectB = isObject(b)

  /**
   * 判断 a 是否为数组
   */
  const isArrayA = Array.isArray(a)

  /**
   * 判断 b 是否为数组
   */
  const isArrayB = Array.isArray(b)

  if (isObjectA && isObjectB) {
    try {
      if (isArrayA && isArrayB) {
        return (
          a.length === b.length &&
          a.every((e: any, i: any) => {
            return looseEqual(e, b[i])
          })
        )
      } else if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime()
      } else if (!isArrayA && !isArrayB) {
        /**
         * 获取对象 a 的所有键。
         */
        const keysA = Object.keys(a)

        /**
         * 获取对象 b 的所有键。
         */
        const keysB = Object.keys(b)

        return (
          keysA.length === keysB.length &&
          keysA.every(key => {
            return looseEqual(a[key], b[key])
          })
        )
      } else {
        /* istanbul ignore next */
        return false
      }
    } catch (e: any) {
      /* istanbul ignore next */
      return false
    }
  } else if (!isObjectA && !isObjectB) {
    return String(a) === String(b)
  } else {
    return false
  }
}

/**
 * Return the first index at which a loosely equal value can be
 * found in the array (if value is a plain object, the array must
 * contain an object of the same shape), or -1 if it is not present.
 */
/**
 * 在数组中查找与指定值宽松相等的元素的索引。
 *
 * @param arr 要搜索的数组
 * @param val 要查找的值
 * @returns 如果找到，返回元素的索引；否则返回 -1
 */
export function looseIndexOf(arr: Array<unknown>, val: unknown): number {
  for (let i = 0; i < arr.length; i++) {
    if (looseEqual(arr[i], val)) return i
  }
  return -1
}

/**
 * Ensure a function is called only once.
 */
/**
 * 一个只允许函数执行一次的高阶函数。
 * @template T 函数类型，必须是一个接受任意参数并返回任意值的函数。
 * @param fn 需要包装的函数，只会被调用一次。
 * @returns 包装后的函数，调用多次只会执行一次原始函数。
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false
  return function () {
    if (!called) {
      called = true
      fn.apply(this, arguments as any)
    }
  } as any
}

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is#polyfill
/**
 * 比较两个值是否发生变化。
 * @param x 第一个值
 * @param y 第二个值
 * @returns 如果两个值不同，返回 true；否则返回 false
 */
export function hasChanged(x: unknown, y: unknown): boolean {
  return Object.is(x, y)
}
