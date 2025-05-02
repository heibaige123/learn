import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'
import type { VNodeDirective, VNodeWithData } from 'types/vnode'
import type { Component } from 'types/component'

export default {
  create: updateDirectives,
  update: updateDirectives,
  /** 在 VNode 被销毁时，自动调用所有自定义指令的 `unbind` 生命周期钩子 */
  destroy: function unbindDirectives(vnode: VNodeWithData) {
    // @ts-expect-error emptyNode is not VNodeWithData
    updateDirectives(vnode, emptyNode)
  }
}

/**
 * 在虚拟 DOM patch 阶段处理自定义指令的生命周期钩子
 * @param oldVnode
 * @param vnode
 */
function updateDirectives(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // 只有当新旧 VNode 至少有一个包含 `directives`（指令数组）时，才需要处理指令。
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

/**
 * 对比新旧 VNode 上的自定义指令，并自动调用指令生命周期钩
 * @param oldVnode
 * @param vnode
 */
function _update(oldVnode, vnode) {
  /** 是否是新建节点（首次挂载） */
  const isCreate = oldVnode === emptyNode
  /** 是否是销毁节点 */
  const isDestroy = vnode === emptyNode
  const oldDirs = normalizeDirectives(
    oldVnode.data.directives,
    oldVnode.context
  )
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

  const dirsWithInsert: any[] = []
  const dirsWithPostpatch: any[] = []

  let key, oldDir, dir
  for (key in newDirs) {
    oldDir = oldDirs[key]
    dir = newDirs[key]
    if (!oldDir) {
      // new directive, bind
      // 新指令，调用 bind
      callHook(dir, 'bind', vnode, oldVnode)
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    } else {
      // existing directive, update
      // 已存在指令，调用 update
      dir.oldValue = oldDir.value
      dir.oldArg = oldDir.arg
      callHook(dir, 'update', vnode, oldVnode)
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }

  // - 如果有需要在节点插入后执行的 inserted 钩子：
  if (dirsWithInsert.length) {
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    if (isCreate) {
      // 新建节点时，合并到 VNode 的 insert 钩子，等节点插入后再执行。
      mergeVNodeHook(vnode, 'insert', callInsert)
    } else {
      // 更新节点时，直接执行。
      callInsert()
    }
  }

  if (dirsWithPostpatch.length) {
    // 如果有需要在组件更新后执行的 componentUpdated 钩子，合并到 VNode 的 postpatch 钩子，等 patch 完成后再执行。
    mergeVNodeHook(vnode, 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        // 指令已被移除，调用 unbind
        // - 只有在更新或销毁时才需要处理 unbind。
        // - 如果旧指令在新节点中已经不存在，说明被移除了，调用其 `unbind` 钩子。
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

/**
 * 规范化指令数组为对象映射，保证每个指令都带有标准 modifiers，并挂载好指令定义，为后续指令的高效查找和生命周期管理打下基础。
    - 把编译生成的指令数组（`dirs`）转换成以唯一 key（指令名+修饰符）为键、指令对象为值的对象，便于后续高效查找和对比。
    - 保证每个指令对象都带有标准的 `modifiers` 属性。
    - 解析并挂载指令的定义对象（`def`），支持普通指令和 setup 语法糖指令。
 * @param dirs 指令数组（`VNodeDirective[]`），每一项是一个指令对象，包含 name、modifiers、value、arg 等。
 * @param vm 当前组件实例（`Component`），用于查找指令定义。
 * @returns

 ## 举例

 假设模板：

 ```vue
 <div v-focus v-my-dir.a="foo" v-my-dir.b="bar"></div>
 ```

 编译后指令数组：

 ```js
 [
   { name: 'focus', modifiers: undefined, value: undefined, ... },
   { name: 'my-dir', modifiers: { a: true }, value: 'foo', ... },
   { name: 'my-dir', modifiers: { b: true }, value: 'bar', ... }
 ]
 ```
 `normalizeDirectives` 处理后：

 ```js
 {
   'focus.': { name: 'focus', modifiers: {}, ... },
   'my-dir.a': { name: 'my-dir', modifiers: { a: true }, ... },
   'my-dir.b': { name: 'my-dir', modifiers: { b: true }, ... }
 }
 ```

 */
function normalizeDirectives(
  dirs: Array<VNodeDirective> | undefined,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    // $flow-disable-line
    return res
  }
  let i: number, dir: VNodeDirective
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      // $flow-disable-line
      dir.modifiers = emptyModifiers
    }
    res[getRawDirName(dir)] = dir
    // setup 语法糖指令支持
    if (vm._setupState && vm._setupState.__sfc) {
      const setupDef =
        dir.def || resolveAsset(vm, '_setupState', 'v-' + dir.name)
      if (typeof setupDef === 'function') {
        dir.def = {
          bind: setupDef,
          update: setupDef
        }
      } else {
        dir.def = setupDef
      }
    }
    // 普通指令定义查找
    dir.def = dir.def || resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  // $flow-disable-line
  return res
}

/**
 * 生成指令的唯一标识字符串
    - 在对比新旧指令时，能唯一标识每一个指令（包括指令名和修饰符），
    - 作为指令的 key 用于对象存储和查找。
 * @param dir 一个指令对象（`VNodeDirective`），包含指令名、修饰符、原始名等信息。
 * @returns

 #### 举例

 ```js
 getRawDirName({ name: 'focus', modifiers: { once: true, stop: true } })
 // => 'focus.once.stop'

 getRawDirName({ rawName: 'v-my-dir.a.b', name: 'my-dir', modifiers: { a: true, b: true } })
 // => 'v-my-dir.a.b'
 ```
 */
function getRawDirName(dir: VNodeDirective): string {
  return (
    // - 如果指令对象有 `rawName` 属性（即模板编译时保留的原始指令字符串，如 `v-my-dir.a.b`），直接返回它。
    // - 否则，拼接指令名和所有修饰符，用点号连接，生成唯一字符串。例如：
    //    - 指令名 `my-dir`，修饰符 `{ a: true, b: true }`，结果为：`my-dir.a.b`
    //    - 没有修饰符时，结果为：`my-dir.`
    dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
  )
}

/**
 * 调用自定义指令生命周期钩子函数
 * @param dir 指令对象（包含指令的定义、参数、修饰符等）。
 * @param hook 要调用的钩子名称（字符串，如 `'bind'`、`'update'` 等）。
 * @param vnode 当前 VNode 节点
 * @param oldVnode 旧的 VNode 节点（用于 update、unbind 等阶段）。
 * @param isDestroy 是否为销毁阶段（只在 `unbind` 时传递）。
 */
function callHook(dir, hook, vnode, oldVnode, isDestroy?: any) {
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e: any) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
