import { isDef, isUndef } from 'shared/util'
import type { VNodeData } from 'types/vnode'

import { concat, stringifyClass, genClassForVnode } from 'web/util/index'

/**
 * 更新 DOM 元素的 class 属性
 * @param oldVnode
 * @param vnode
 * @returns
 */
function updateClass(oldVnode: any, vnode: any) {
  const el = vnode.elm
  const data: VNodeData = vnode.data
  const oldData: VNodeData = oldVnode.data
  // 如果新旧节点都没有 class 信息，直接返回，不做任何操作
  if (
    isUndef(data.staticClass) &&
    isUndef(data.class) &&
    (isUndef(oldData) ||
      (isUndef(oldData.staticClass) && isUndef(oldData.class)))
  ) {
    return
  }

  // 生成最终的 class 字符串.
  let cls = genClassForVnode(vnode)

  // handle transition classes
  // 处理过渡（transition）相关的 class
  const transitionClass = el._transitionClasses
  if (isDef(transitionClass)) {
    cls = concat(cls, stringifyClass(transitionClass))
  }

  // 如果 class 有变化，才更新 DOM，避免不必要的操作
  // set the class
  if (cls !== el._prevClass) {
    el.setAttribute('class', cls)
    el._prevClass = cls
  }
}

export default {
  create: updateClass,
  update: updateClass
}
