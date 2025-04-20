import on from './on'
import bind from './bind'
import { noop } from 'shared/util'

/**
 * 默认导出一个对象，包含三个指令处理函数：
 * - `on`：用于处理事件绑定指令。
 * - `bind`：用于处理普通绑定指令。
 * - `cloak`：一个空操作函数，用于处理 `v-cloak` 指令。
 */
export default {
  on,
  bind,
  cloak: noop
}
