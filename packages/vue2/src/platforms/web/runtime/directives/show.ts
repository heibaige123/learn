import VNode from 'core/vdom/vnode'
import type { VNodeDirective, VNodeWithData } from 'types/vnode'
import { enter, leave } from 'web/runtime/modules/transition'

// recursively search for possible transition defined inside the component root
/**
 * 递归查找需要应用过渡（transition）的真实 VNode 节点
 * @param vnode
 * @returns
 */
function locateNode(vnode: VNode | VNodeWithData): VNodeWithData {
  // @ts-expect-error
  return vnode.componentInstance && (!vnode.data || !vnode.data.transition)
    ? locateNode(vnode.componentInstance._vnode!)
    : vnode
}

export default {
  /**
   * Vue 2 内置 `v-show` 指令的 `bind` 钩子的实现
   * @param el
   * @param param1
   * @param vnode
   */
  bind(el: any, { value }: VNodeDirective, vnode: VNodeWithData) {
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    // - 把当前元素的 `display` 样式保存到 `el.__vOriginalDisplay` 上。
    // - 如果当前就是 `display: none`，则保存空字符串，否则保存当前的 display 值。
    // - 这样后续切换显示/隐藏时可以恢复原始 display。
    const originalDisplay = (el.__vOriginalDisplay =
      el.style.display === 'none' ? '' : el.style.display)
    if (value && transition) {
      vnode.data.show = true
      // 调用 `enter(vnode, cb)`，等过渡动画完成后再把 `el.style.display` 恢复为原始值。
      enter(vnode, () => {
        el.style.display = originalDisplay
      })
    } else {
      // 直接设置 `el.style.display`，如果 `value` 为真，恢复原始 display，否则设为 `'none'` 隐藏。
      el.style.display = value ? originalDisplay : 'none'
    }
  },

  /**
   * Vue 2 内置 `v-show` 指令的 `update` 钩子的实现
   * @param el
   * @param param1
   * @param vnode
   * @returns
   */
  update(el: any, { value, oldValue }: VNodeDirective, vnode: VNodeWithData) {
    /* istanbul ignore if */
    if (!value === !oldValue) return
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    if (transition) {
      vnode.data.show = true
      if (value) {
        // 调用 `enter(vnode, cb)`，等动画完成后恢复原始 display。
        enter(vnode, () => {
          el.style.display = el.__vOriginalDisplay
        })
      } else {
        // 调用 `leave(vnode, cb)`，等动画完成后设置为 `'none'`。
        leave(vnode, () => {
          el.style.display = 'none'
        })
      }
    } else {
      // 设置 `el.style.display`，如果 `value` 为真，恢复原始 display，否则设为 `'none'` 隐藏。
      el.style.display = value ? el.__vOriginalDisplay : 'none'
    }
  },

  /**
   * 在节点被销毁但不是整个组件销毁时，恢复元素的原始 display 样式
   * @param el
   * @param binding
   * @param vnode
   * @param oldVnode
   * @param isDestroy 表示当前解绑是否是因为整个组件被销毁（`true`），还是只是指令被移除或节点被移除（`false`）
   */
  unbind(
    el: any,
    binding: VNodeDirective,
    vnode: VNodeWithData,
    oldVnode: VNodeWithData,
    isDestroy: boolean
  ) {
    if (!isDestroy) {
      el.style.display = el.__vOriginalDisplay
    }
  }
}
