// helper to process dynamic keys for dynamic arguments in v-bind and v-on.
// For example, the following template:
//
// <div id="app" :[key]="value">
//
// compiles to the following:
//
// _c('div', { attrs: bindDynamicKeys({ "id": "app" }, [key, value]) })

import { warn } from 'core/util/debug'

/**
 * 用于**处理 v-bind 和 v-on 的动态参数**的辅助函数。
 * @param baseObj 基础对象，最终会被返回（通常是 `{}` 或已有属性的对象）。
 * @param values 一个数组，内容是 `[key1, value1, key2, value2, ...]`，即成对出现。
 * @returns

 #### 举例

 ```js
 bindDynamicKeys({ id: 'foo' }, ['data-x', 123, 'title', 'bar'])
 // => { id: 'foo', 'data-x': 123, title: 'bar' }
 ```
 */
export function bindDynamicKeys(
  baseObj: Record<string, any>,
  values: Array<any>
): Object {
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i]
    if (typeof key === 'string' && key) {
      // 如果 key 是非空字符串，则 `baseObj[key] = value`。
      baseObj[values[i]] = values[i + 1]
    } else if (__DEV__ && key !== '' && key !== null) {
      // 如果 key 不是字符串且不是 `null` 或 `''`，开发环境下会报警告。
      // null is a special value for explicitly removing a binding
      warn(
        `Invalid value for dynamic directive argument (expected string or null): ${key}`,
        this
      )
    }
  }
  return baseObj
}

// helper to dynamically append modifier runtime markers to event names.
// ensure only append when value is already string, otherwise it will be cast
// to string and cause the type check to miss.
/**
 * 用于**给事件名动态添加修饰符前缀**的辅助函数
 * @param value
 * @param symbol
 * @returns
 *
 * #### 举例
 ```js
 prependModifier('click', '~') // => '~click'
 prependModifier('keyup', '!') // => '!keyup'
 prependModifier(123, '~')     // => 123
 ```
 */
export function prependModifier(value: any, symbol: string): any {
  return typeof value === 'string' ? symbol + value : value
}
