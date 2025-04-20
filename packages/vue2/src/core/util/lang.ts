/**
 * 用于解析 HTML 标签、组件名称和属性路径的 Unicode 字符。
 * 使用 https://www.w3.org/TR/html53/semantics-scripting.html#potentialcustomelementname
 * 跳过 \u10000-\uEFFFF 因为它会导致 PhantomJS 冻结。
 */
export const unicodeRegExp =
  /a-zA-Z\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD/

/**
 * Check if a string starts with $ or _
 */
/**
 * 判断字符串是否是保留的关键字。
 * @param str 要检查的字符串。
 * @returns 如果字符串是以 `$` 或 `_` 开头，则返回 true；否则返回 false。
 */
export function isReserved(str: string): boolean {
  const c = (str + '').charCodeAt(0)
  return c === 0x24 || c === 0x5f
}

/**
 * Define a property.
 */
/**
 * 定义一个对象的属性。
 * @param obj - 要定义属性的目标对象。
 * @param key - 属性的键名。
 * @param val - 属性的值。
 * @param enumerable - 属性是否可枚举，默认为 `false`。
 */
export function def(obj: Object, key: string, val: any, enumerable?: boolean) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

/**
 * 用于匹配非法路径字符的正则表达式。
 * 如果路径中包含非 Unicode 字符、点号、美元符号、下划线或数字，则认为路径非法。
 */
const bailRE = new RegExp(`[^${unicodeRegExp.source}.$_\\d]`)
/**
 * 解析路径字符串并返回一个函数，该函数可以根据路径访问对象的属性。
 * 如果路径字符串包含非法字符，则返回 undefined。
 *
 * @param path - 用点号分隔的路径字符串，例如 "a.b.c"。
 * @returns 一个函数，该函数接受一个对象作为参数，并根据路径访问对象的属性。
 *
 *
 * @example
```javascript
// 定义一个嵌套对象
const data = {
  user: {
    profile: {
      name: 'Alice',
      age: 25
    }
  }
}

// 使用 parsePath 函数解析路径
const getName = parsePath('user.profile.name')
const getAge = parsePath('user.profile.age')

// 调用返回的函数获取属性值
console.log(getName(data)) // 输出: 'Alice'
console.log(getAge(data))  // 输出: 25

// 处理不存在的路径
const getNonExistent = parsePath('user.profile.nonExistent')
console.log(getNonExistent(data)) // 输出: undefined
```
 */
export function parsePath(path: string): any {
  if (bailRE.test(path)) {
    return
  }
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) return
      obj = obj[segments[i]]
    }
    return obj
  }
}
