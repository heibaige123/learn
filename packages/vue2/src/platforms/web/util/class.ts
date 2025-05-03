import VNode from 'core/vdom/vnode'
import { isDef, isObject } from 'shared/util'
import type { VNodeData, VNodeWithData } from 'types/vnode'

/**
 * 生成某个VNode节点最终应该渲染的class字符串
 * @param vnode
 * @returns
 */
export function genClassForVnode(vnode: VNodeWithData): string {
  /** 保存当前节点的data（里面有class相关信息）。 */
  let data = vnode.data
  let parentNode: VNode | VNodeWithData | undefined = vnode
  let childNode: VNode | VNodeWithData = vnode
  while (isDef(childNode.componentInstance)) {
    childNode = childNode.componentInstance._vnode!
    if (childNode && childNode.data) {
      // 把根VNode的class信息和当前data合并。
      data = mergeClassData(childNode.data, data)
    }
  }
  // 沿着父节点链往上走，把每个父节点的class信息合并进来。
  // @ts-expect-error parentNode.parent not VNodeWithData
  while (isDef((parentNode = parentNode.parent))) {
    if (parentNode && parentNode.data) {
      data = mergeClassData(data, parentNode.data)
    }
  }
  return renderClass(data.staticClass!, data.class)
}

/**
 * 合并两个VNodeData对象中的class相关信息
 * @param child
 * @param parent
 * @returns
 */
function mergeClassData(
  child: VNodeData,
  parent: VNodeData
): {
  staticClass: string
  class: any
} {
  return {
    /** 合并后的静态class字符串 */
    staticClass: concat(child.staticClass, parent.staticClass),
    /** 合并后的动态class（可能是数组、对象或字符串） */
    class: isDef(child.class) ? [child.class, parent.class] : parent.class
  }
}

/**
 * **把静态class和动态class合成为最终的class字符串**，用于渲染到HTML标签的 `class` 属性上
 * @param staticClass
 * @param dynamicClass
 * @returns
 */
export function renderClass(
  staticClass: string | null | undefined,
  dynamicClass: any
): string {
  if (isDef(staticClass) || isDef(dynamicClass)) {
    return concat(staticClass, stringifyClass(dynamicClass))
  }
  /* istanbul ignore next */
  return ''
}

/**
 * 把两个class字符串用空格拼接起来
 * @param a
 * @param b
 * @returns
 */
export function concat(a?: string | null, b?: string | null): string {
  return a ? (b ? a + ' ' + b : a) : b || ''
}

/**
 * 把各种类型的 class 数据（字符串、数组、对象等）统一转换成字符串
 * @param value
 * @returns
 */
export function stringifyClass(value: any): string {
  if (Array.isArray(value)) {
    return stringifyArray(value)
  }
  if (isObject(value)) {
    return stringifyObject(value)
  }
  if (typeof value === 'string') {
    return value
  }
  /* istanbul ignore next */
  return ''
}

/**
 * 把 class 数组里的每一项都转成字符串，然后用空格拼接起来
 * @param value
 * @returns
 */
function stringifyArray(value: Array<any>): string {
  let res = ''
  let stringified
  for (let i = 0, l = value.length; i < l; i++) {
    if (isDef((stringified = stringifyClass(value[i]))) && stringified !== '') {
      if (res) res += ' '
      res += stringified
    }
  }
  return res
}

/**
 * 把对象类型的 class 数据转换成字符串
 * @param value
 * @returns
 */
function stringifyObject(value: Object): string {
  let res = ''
  for (const key in value) {
    if (value[key]) {
      if (res) res += ' '
      res += key
    }
  }
  return res
}
