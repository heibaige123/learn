import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * Query an element selector if it's not an element already.
 */
/**
 * 查询并返回指定的 DOM 元素。
 *
 * @param el - 可以是一个 CSS 选择器字符串或一个 DOM 元素。
 * 如果是字符串，将使用 `document.querySelector` 查找对应的元素。
 * 如果找不到元素，会返回一个新创建的 `<div>` 元素。
 * 如果是 DOM 元素，直接返回该元素。
 *
 * @returns 返回找到的 DOM 元素或新创建的 `<div>` 元素。
 */
export function query(el: string | Element): Element {
  if (typeof el === 'string') {
    const selected = document.querySelector(el)
    if (!selected) {
      __DEV__ && warn('Cannot find element: ' + el)
      return document.createElement('div')
    }
    return selected
  } else {
    return el
  }
}
