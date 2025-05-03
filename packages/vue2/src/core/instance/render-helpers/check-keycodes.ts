/**
 *   这是一个**运行时**的辅助函数，意味着它在你的 Vue 应用实际运行过程中被调用。
 *   它是 Vue 内部使用的，通过 `Vue.prototype._k` 暴露出来。
 *   通常是由 Vue **模板编译器**生成的代码来调用这个 `_k` 函数的。一般不会直接在自己的业务代码里调用它。

理解这个函数的关键在于知道**调用它的代码是如何使用其返回值的**。模板编译器生成的事件处理函数大概是这样的：
```javascript
// 简化后的 @keyup.enter="submitForm" 的处理逻辑
function generatedHandler(event) {
  // 调用 _k (即 checkKeyCodes)
  // 如果 checkKeyCodes 返回 true (表示按键不匹配)
  if (Vue.prototype._k(event.keyCode, 'enter', 13, event.key, 'Enter')) {
    // 就直接返回 null 或 undefined，阻止后续代码（即用户写的 submitForm 方法）的执行
    return null;
  }
  // 如果 checkKeyCodes 返回 false (表示按键匹配)
  // 那么 if 条件不成立，就会继续执行下面的代码
  return instance.submitForm(event); // 调用用户定义的方法
}
```
 */

import config from 'core/config'
import { hyphenate, isArray } from 'shared/util'

/**
 * 判断实际触发的按键是否与期望的按键不匹配
 * @param expect 期望的按键值（可以是单个值或值的数组）
 * @param actual 实际触发的按键值
 * @returns
 */
function isKeyNotMatch<T>(expect: T | Array<T>, actual: T): boolean {
  if (isArray(expect)) {
    return expect.indexOf(actual) === -1
  } else {
    return expect !== actual
  }
}

/**
 * Runtime helper for checking keyCodes from config.
 * exposed as Vue.prototype._k
 * passing in eventKeyName as last argument separately for backwards compat
 */
/**
 * 在处理键盘事件（如 `keyup`, `keydown`）时，判断用户实际按下的键**是否与**你在 Vue 模板中通过 `v-on` 指令指定的**按键修饰符**（比如 `.enter`, `.tab`, `.esc`, 或者自定义的别名，甚至是数字 keyCode）相匹配。
 * @param eventKeyCode 来自实际浏览器键盘事件对象 (`event`) 的 `keyCode` 属性值。这是一个数字，代表按键的编码（例如，Enter 键通常是 13）。这是识别按键的一种较老的方式，但为了兼容性和处理模板中直接写的数字（如 `@keyup.13`）而保留
 * @param key 在模板的 `v-on` 修饰符中指定的那个**键名或别名**。
 *   - 例如：`'enter'`, `'tab'`, `'esc'`, `'space'`, `'up'`, `'down'`, `'left'`, `'right'`, `'delete'` 这些内置别名。
 *   - 也可能是你在 `Vue.config.keyCodes` 中定义的**自定义别名**，比如 `'my-save-key'`。
 *   - 还可能是直接写的**数字 keyCode 字符串**，比如 `'13'`。
 * @param builtInKeyCode 如果 `key` 参数是 Vue 的一个**内置别名**（如 `'enter'`, `'tab'`），那么 Vue 编译器在生成代码时会把这个别名对应的标准 `keyCode`（或 `keyCode` 数组，因为一个别名可能对应多个键，如 'delete' 可能对应 Backspace 的 8 和 Delete 键的 46）作为这个参数传进来。
 * @param eventKeyName 来自实际浏览器键盘事件对象 (`event`) 的 `key` 属性值。这是一个字符串，代表按键的名称（例如 `'Enter'`, `'Tab'`, `'ArrowUp'`, `'PageDown'`）。这是更现代、更推荐的按键识别方式，因为它通常更具可读性且不受键盘布局影响。
 * @param builtInKeyName 如果 `key` 参数是 Vue 的一个**内置别名**，编译器会把这个别名对应的标准 `event.key` 名称（或名称数组）作为这个参数传进来（例如，对于 `'enter'`，这个参数就是 `'Enter'`）。
 * @returns
 */
export function checkKeyCodes(
  eventKeyCode: number,
  key: string,
  builtInKeyCode?: number | Array<number>,
  eventKeyName?: string,
  builtInKeyName?: string | Array<string>
): boolean | null | undefined {
  const mappedKeyCode = config.keyCodes[key] || builtInKeyCode
  if (builtInKeyName && eventKeyName && !config.keyCodes[key]) {
    return isKeyNotMatch(builtInKeyName, eventKeyName)
  } else if (mappedKeyCode) {
    return isKeyNotMatch(mappedKeyCode, eventKeyCode)
  } else if (eventKeyName) {
    return hyphenate(eventKeyName) !== key
  }
  return eventKeyCode === undefined
}
