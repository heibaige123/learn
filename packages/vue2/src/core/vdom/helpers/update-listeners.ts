import { warn, invokeWithErrorHandling } from 'core/util'
import { cached, isUndef, isTrue } from 'shared/util'
import type { Component } from 'types/component'

/**
 * 用于**解析事件名字符串中的修饰符**，
 * 把像 `~!&click` 这样的事件名，拆解成结构化的信息，
 * 便于后续事件系统正确处理 once、capture、passive 等修饰符。

 #### 举例

 ```js
 normalizeEvent('~!&click')
 // 解析顺序：& → ~ → !
 // 结果：{ name: 'click', once: true, capture: true, passive: true }

 normalizeEvent('~input')
 // { name: 'input', once: true, capture: false, passive: false }

 normalizeEvent('!keyup')
 // { name: 'keyup', once: false, capture: true, passive: false }
 ```
 */
const normalizeEvent = cached(
  (
    name: string
  ): {
    name: string
    once: boolean
    capture: boolean
    passive: boolean
    handler?: Function
    params?: Array<any>
  } => {
    const passive = name.charAt(0) === '&'
    name = passive ? name.slice(1) : name
    const once = name.charAt(0) === '~' // Prefixed last, checked first
    name = once ? name.slice(1) : name
    const capture = name.charAt(0) === '!'
    name = capture ? name.slice(1) : name
    return {
      /** 纯事件名（去掉修饰符前缀） */
      name,
      /** 是否 once 修饰符 */
      once,
      /** 是否 capture 修饰符 */
      capture,
      /** 是否 passive 修饰符 */
      passive
    }
  }
)

/**
 * 用于**包装事件处理函数**，使其支持**多个回调**（即同一个事件可以有多个监听器），并且在触发时自动依次调用所有监听器。
 * @param fns
 * @param vm
 * @returns

 #### 举例

 ```js
 const invoker = createFnInvoker([fn1, fn2, fn3])
 invoker(1, 2) // 会依次调用 fn1(1,2), fn2(1,2), fn3(1,2)
 invoker.fns = [fn4] // 可以动态替换回调
 invoker(3) // 只会调用 fn4(3)
 ```
 */
export function createFnInvoker(
  fns: Function | Array<Function>,
  vm?: Component
): Function {
  function invoker() {
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      const cloned = fns.slice()

      cloned.forEach(clone => {
        invokeWithErrorHandling(
          clone,
          null,
          arguments as any,
          vm,
          `v-on handler`
        )
      })
    } else {
      // return handler return value for single handlers
      return invokeWithErrorHandling(
        fns,
        null,
        arguments as any,
        vm,
        `v-on handler`
      )
    }
  }

  invoker.fns = fns
  return invoker
}

/**
 * Vue 内部用于**对比和更新事件监听器**的核心函数。
 * - 对比新旧事件监听器对象（如 `v-on` 绑定的事件），
 * - 自动决定哪些事件需要添加、哪些需要移除、哪些需要更新，
 * - 并通过传入的 `add`、`remove`、`createOnceHandler` 等回调，完成事件的实际绑定和解绑。
 * @param on 新的事件监听器对象（如 { click: fn1, input: fn2 }）
 * @param oldOn 旧的事件监听器对象
 * @param add 添加事件监听器的回调（如 $on 或原生 addEventListener）
 * @param remove 移除事件监听器的回调
 * @param createOnceHandler 创建只执行一次的事件监听器的回调
 * @param vm 当前组件实例

 ## 举例

 假设：

 ```js
 // 上一次 patch
 oldOn = { click: fn1, input: fn2 }
 // 这一次 patch
 on = { click: fn3, change: fn4 }
 ```

 - `click`：新旧都存在，但回调变了 → 只更新 invoker.fns
 - `input`：旧有新无 → 调用 remove 移除
 - `change`：新有旧无 → 调用 add 添加

 ## 与 invoker 的关系

 - 所有事件监听器都被包装成 invoker（带 `.fns` 属性的函数）。
 - 这样事件系统可以灵活地动态替换回调，而不需要频繁解绑/重新绑定原生事件，提高性能。

 ---

 ## 与组件事件系统的关系

 - 在组件初始化、更新、销毁时，Vue 会调用 `updateComponentListeners`，它内部会调用 `updateListeners`，并传入合适的 `add`、`remove`、`createOnceHandler` 实现（通常就是 `$on`、`$off` 等）。
 - 对于原生 DOM 事件，`add`/`remove` 就是 `addEventListener`/`removeEventListener`。
 */
export function updateListeners(
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  createOnceHandler: Function,
  vm: Component
) {
  let name, cur, old, event
  for (name in on) {
    cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    if (isUndef(cur)) {
      __DEV__ &&
        warn(
          `Invalid handler for event "${event.name}": got ` + String(cur),
          vm
        )
    } else if (isUndef(old)) {
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur, vm)
      }
      if (isTrue(event.once)) {
        cur = on[name] = createOnceHandler(event.name, cur, event.capture)
      }
      add(event.name, cur, event.capture, event.passive, event.params)
    } else if (cur !== old) {
      old.fns = cur
      on[name] = old
    }
  }
  for (name in oldOn) {
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
