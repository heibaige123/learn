import {
  tip,
  hasOwn,
  isDef,
  isUndef,
  hyphenate,
  formatComponentName
} from 'core/util/index'
import type { Component } from 'types/component'
import type { VNodeData } from 'types/vnode'

/**
 * 从虚拟节点的数据 (`VNodeData`) 中提取组件的 `props`，
 * 并返回一个包含这些 `props` 的对象。
 * @param data 虚拟节点的数据对象，包含 `attrs` 和 `props` 等信息。
 * @param Ctor 组件的构造函数，用于获取组件的 `props` 定义。
 * @param tag 组件的标签名（可选）
 * @returns
 */
export function extractPropsFromVNodeData(
  data: VNodeData,
  Ctor: typeof Component,
  tag?: string
): object | undefined {
  // we are only extracting raw values here.
  // validation and default values are handled in the child
  // component itself.
  const propOptions = Ctor.options.props
  if (isUndef(propOptions)) {
    return
  }
  const res = {}
  const { attrs, props } = data

  if (!(isDef(attrs) || isDef(props))) {
    return
  }

  for (const key in propOptions) {
    const altKey = hyphenate(key)
    if (__DEV__) {
      const keyInLowerCase = key.toLowerCase()
      if (key !== keyInLowerCase && attrs && hasOwn(attrs, keyInLowerCase)) {
        tip(
          `Prop "${keyInLowerCase}" is passed to component ` +
            `${formatComponentName(
              // @ts-expect-error tag is string
              tag || Ctor
            )}, but the declared prop name is` +
            ` "${key}". ` +
            `Note that HTML attributes are case-insensitive and camelCased ` +
            `props need to use their kebab-case equivalents when using in-DOM ` +
            `templates. You should probably use "${altKey}" instead of "${key}".`
        )
      }
    }
    checkProp(res, props, key, altKey, true) ||
      checkProp(res, attrs, key, altKey, false)
  }

  return res
}

/**
 * 检查并提取指定的 `prop` 值。
 * @param res 存储提取结果的对象。
 * @param hash `props` 或 `attrs` 对象。
 * @param key `prop` 的名称。
 * @param altKey `prop` 的连字符形式名称。
 * @param preserve 是否保留原始数据中的 `prop`。
 * @returns
 */
function checkProp(
  res: Object,
  hash: Object | undefined,
  key: string,
  altKey: string,
  preserve: boolean
): boolean {
  if (!isDef(hash)) {
    return false
  }

  if (hasOwn(hash, key)) {
    res[key] = hash[key]
    if (!preserve) {
      delete hash[key]
    }
    return true
  }

  if (hasOwn(hash, altKey)) {
    res[key] = hash[altKey]
    if (!preserve) {
      delete hash[altKey]
    }
    return true
  }

  return false
}
