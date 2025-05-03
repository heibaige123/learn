/**
- 在 IE 下，`<div a="\n"/>` 解析后属性值会变成 `&#10;`，所以 `shouldDecodeNewlines` 为 `true`。
- 在 Chrome 下，`<a href="\n"/>` 解析后 `href` 属性值会变成 `&#10;`，所以 `shouldDecodeNewlinesForHref` 为 `true`。
*/

import { inBrowser } from 'core/util/index'

// check whether current browser encodes a char inside attribute values
let div

/**
 * - 检测当前浏览器在 HTML 属性值中是否会把换行符（`\n`）编码成 `&#10;`
 * - 不同浏览器的行为不一样，IE 会编码，Chrome/Firefox 不会。
 * - 这个检测结果会影响 Vue 在序列化属性值时的处理方式。
 * @param href
 * @returns
 */
function getShouldDecode(href: boolean): boolean {
  div = div || document.createElement('div')
  div.innerHTML = href ? `<a href="\n"/>` : `<div a="\n"/>`
  return div.innerHTML.indexOf('&#10;') > 0
}

// #3663: IE encodes newlines inside attribute values while other browsers don't
/**
 * 检查普通属性值（如 `<div a="\n"/>`）是否会被编码
 */
export const shouldDecodeNewlines = inBrowser ? getShouldDecode(false) : false
// #6828: chrome encodes content in a[href]
/**
 * 浏览器会自动解析 innerHTML，如果属性值中的 `\n` 被编码成 `&#10;`，那么 innerHTML 里就会出现 `&#10;`
 */
export const shouldDecodeNewlinesForHref = inBrowser
  ? getShouldDecode(true)
  : false
