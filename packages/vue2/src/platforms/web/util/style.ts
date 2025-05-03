import VNode from 'core/vdom/vnode'
import { cached, extend, toObject } from 'shared/util'
import type { VNodeData, VNodeWithData } from 'types/vnode'

/**
 * 把内联样式字符串（如 style 属性里的内容）解析成一个对象

 ## 举例说明

 ```js
 parseStyleText('color: red; font-size: 14px; background: url(a;b);')
 // 结果：{ color: "red", "font-size": "14px", background: "url(a;b)" }
 ```
 */
export const parseStyleText = cached(function (cssText) {
  const res = {}
  // 用于分割每个样式声明（以分号分隔），但不会分割括号里的分号（比如 `background: url(...;...)` 这种情况）
  const listDelimiter = /;(?![^(]*\))/g
  // 用于分割属性名和属性值（只分割第一个冒号，避免值里有冒号时出错）。
  const propertyDelimiter = /:(.+)/
  cssText.split(listDelimiter).forEach(function (item) {
    if (item) {
      const tmp = item.split(propertyDelimiter)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res
})

// merge static and dynamic style data on the same vnode
/**
 * 合并和规范化 VNodeData 上的 style 信息
 * @param data
 * @returns
 */
function normalizeStyleData(data: VNodeData): Record<string, any> {
  const style = normalizeStyleBinding(data.style)
  // static style is pre-processed into an object during compilation
  // and is always a fresh object, so it's safe to merge into it
  return data.staticStyle ? extend(data.staticStyle, style) : style
}

// normalize possible array / string values into Object
/**
 * 把各种可能的 style 绑定值（数组、字符串、对象）统一规范成对象格式
 * @param bindingStyle
 * @returns

@example

```js
const childVNode = {
  data: { style: { background: 'blue' } },
  parent: null,
  componentInstance: null
}

const parentVNode = {
  data: { style: { fontSize: '20px' } },
  parent: {
    data: { staticStyle: { color: 'red' } },
    parent: null
  },
  componentInstance: {
    _vnode: childVNode
  }
}
childVNode.parent = parentVNode
```

## 最终结果

```js
{
  background: 'blue',
  fontSize: '20px',
  color: 'red'
}
```

 */
export function normalizeStyleBinding(bindingStyle: any): Record<string, any> {
  if (Array.isArray(bindingStyle)) {
    return toObject(bindingStyle)
  }
  if (typeof bindingStyle === 'string') {
    return parseStyleText(bindingStyle)
  }
  return bindingStyle
}

/**
 * parent component style should be after child's
 * so that parent component's style could override it
 */
/**
 * 收集并合并某个 VNode 及其相关节点（包括子组件根节点和父节点链）上的所有 style 信息
 * @param vnode
 * @param checkChild
 * @returns
 */
export function getStyle(vnode: VNodeWithData, checkChild: boolean): Object {
  const res = {}
  let styleData

  if (checkChild) {
    // 递归查找子组件根节点的 style
    let childNode: VNodeWithData | VNode = vnode
    while (childNode.componentInstance) {
      childNode = childNode.componentInstance._vnode!
      if (
        childNode &&
        childNode.data &&
        (styleData = normalizeStyleData(childNode.data))
      ) {
        extend(res, styleData)
      }
    }
  }

  // 合并当前节点的 style
  if ((styleData = normalizeStyleData(vnode.data))) {
    extend(res, styleData)
  }

  // 向上遍历父节点链，合并父节点的 style
  let parentNode: VNodeWithData | VNode | undefined = vnode
  // @ts-expect-error parentNode.parent not VNodeWithData
  while ((parentNode = parentNode.parent)) {
    if (parentNode.data && (styleData = normalizeStyleData(parentNode.data))) {
      extend(res, styleData)
    }
  }
  return res
}
