import { isObject, isDef, hasSymbol, isArray } from 'core/util/index'
import VNode from 'core/vdom/vnode'

/**
 * Runtime helper for rendering v-for lists.
 */
/**
 * 实现 `v-for` 指令的运行时辅助函数。这个函数负责遍历不同类型的数据源，并为每一项调用渲染函数生成虚拟节点(VNode)
 * @param val 要遍历的数据源
 * @param render 每项的渲染函数，返回 VNode
 * @returns
 */
export function renderList(
  val: any,
  render: (val: any, keyOrIndex: string | number, index?: number) => VNode
): Array<VNode> | null {
  let ret: Array<VNode> | null = null,
    i,
    l,
    keys,
    key
  if (isArray(val) || typeof val === 'string') {
    // 1. 数组或字符串
    // - 对应 `v-for="item in array"` 或 `v-for="char in string"`
    // - 遍历每个元素，调用 `render(当前值, 索引)`
    ret = new Array(val.length)
    for (i = 0, l = val.length; i < l; i++) {
      ret[i] = render(val[i], i)
    }
  } else if (typeof val === 'number') {
    // 2. 数字
    // - 对应 `v-for="n in 10"`
    // - 生成从 1 到 n 的序列，调用 `render(当前数字, 索引)`
    // - 注意：这里渲染的值是从 1 开始的，而不是从 0 开始
    ret = new Array(val)
    for (i = 0; i < val; i++) {
      ret[i] = render(i + 1, i)
    }
  } else if (isObject(val)) {
    // 3. 对象
    // - 对应 `v-for="(value, key, index) in object"`
    // - 遍历对象的所有键，调用 `render(值, 键, 索引)`
    if (hasSymbol && val[Symbol.iterator]) {
      // (a) 可迭代对象 (如 Map, Set)
      ret = []
      const iterator: Iterator<any> = val[Symbol.iterator]()
      let result = iterator.next()
      while (!result.done) {
        ret.push(render(result.value, ret.length))
        result = iterator.next()
      }
    } else {
      // (b) 普通对象
      keys = Object.keys(val)
      ret = new Array(keys.length)
      for (i = 0, l = keys.length; i < l; i++) {
        key = keys[i]
        ret[i] = render(val[key], key, i)
      }
    }
  }
  if (!isDef(ret)) {
    ret = []
  }
  // - 确保返回数组，即使没有匹配任何类型
  // - 添加 `_isVList` 标记，用于 Vue 内部识别这是由 v-for 生成的列表
  ;(ret as any)._isVList = true
  return ret
}
