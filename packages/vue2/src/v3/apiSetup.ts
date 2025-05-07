import { Component } from 'types/component'
import { PropOptions } from 'types/options'
import { popTarget, pushTarget } from '../core/observer/dep'
import { def, invokeWithErrorHandling, isReserved, warn } from '../core/util'
import VNode from '../core/vdom/vnode'
import {
  bind,
  emptyObject,
  isArray,
  isFunction,
  isObject
} from '../shared/util'
import { currentInstance, setCurrentInstance } from './currentInstance'
import { shallowReactive } from './reactivity/reactive'
import { proxyWithRefUnwrap } from './reactivity/ref'

/**
 * @internal
 * SetupContext 接口定义，用于 setup 函数的第二个参数。
 */
export interface SetupContext {
  // 组件的 $attrs 代理对象，包含父作用域传递但未被 props 接收的属性
  attrs: Record<string, any>
  // 组件的 $listeners 代理对象，包含父作用域传递的事件监听器
  listeners: Record<string, Function | Function[]>
  // 组件的插槽对象，键为插槽名，值为返回 VNode 数组的函数
  slots: Record<string, () => VNode[]>
  // 触发自定义事件的方法
  emit: (event: string, ...args: any[]) => any
  // 暴露给父组件的属性或方法
  expose: (exposed: Record<string, any>) => void
}

/**
 * 初始化 setup 相关逻辑。
 * 如果组件定义了 setup 函数，则调用 setup，并根据返回值处理 render 或绑定。
 * @param vm 组件实例
 */
export function initSetup(vm: Component) {
  const options = vm.$options
  const setup = options.setup
  if (setup) {
    // 创建 setup 上下文对象（第二个参数）
    const ctx = (vm._setupContext = createSetupContext(vm))

    // 设置当前激活实例，进入依赖收集环境
    setCurrentInstance(vm)
    pushTarget()
    // 调用 setup 函数，传入 props 和 setup context
    const setupResult = invokeWithErrorHandling(
      setup,
      null,
      [vm._props || shallowReactive({}), ctx],
      vm,
      `setup`
    )
    popTarget()
    setCurrentInstance()

    // 如果 setup 返回的是函数，则作为 render 函数
    if (isFunction(setupResult)) {
      // @ts-ignore
      options.render = setupResult
    }
    // 如果 setup 返回的是对象，则作为绑定数据
    else if (isObject(setupResult)) {
      // 开发环境下，setup 不应直接返回 VNode
      if (__DEV__ && setupResult instanceof VNode) {
        warn(
          `setup() should not return VNodes directly - ` +
            `return a render function instead.`
        )
      }
      vm._setupState = setupResult
      // __sfc 标记表示 <script setup> 编译产物
      if (!setupResult.__sfc) {
        // 普通 setup 返回对象，代理到 vm 上
        for (const key in setupResult) {
          if (!isReserved(key)) {
            proxyWithRefUnwrap(vm, setupResult, key)
          } else if (__DEV__) {
            warn(`Avoid using variables that start with _ or $ in setup().`)
          }
        }
      } else {
        // <script setup> 编译产物，代理到 _setupProxy 上
        const proxy = (vm._setupProxy = {})
        for (const key in setupResult) {
          if (key !== '__sfc') {
            proxyWithRefUnwrap(proxy, setupResult, key)
          }
        }
      }
    }
    // 如果 setup 返回了非对象非函数，开发环境下警告
    else if (__DEV__ && setupResult !== undefined) {
      warn(
        `setup() should return an object. Received: ${
          setupResult === null ? 'null' : typeof setupResult
        }`
      )
    }
  }
}

/**
 * 创建 setup context 对象，作为 setup 函数的第二个参数。
 * @param vm 组件实例
 * @returns SetupContext 对象
 */
function createSetupContext(vm: Component): SetupContext {
  let exposeCalled = false // 标记 expose 是否已调用
  return {
    // attrs 代理，自动同步 $attrs
    get attrs() {
      if (!vm._attrsProxy) {
        const proxy = (vm._attrsProxy = {})
        def(proxy, '_v_attr_proxy', true)
        syncSetupProxy(proxy, vm.$attrs, emptyObject, vm, '$attrs')
      }
      return vm._attrsProxy
    },
    // listeners 代理，自动同步 $listeners
    get listeners() {
      if (!vm._listenersProxy) {
        const proxy = (vm._listenersProxy = {})
        syncSetupProxy(proxy, vm.$listeners, emptyObject, vm, '$listeners')
      }
      return vm._listenersProxy
    },
    // slots 代理，返回插槽代理对象
    get slots() {
      return initSlotsProxy(vm)
    },
    // emit 方法，绑定到当前组件实例
    emit: bind(vm.$emit, vm) as any,
    // expose 方法，允许 setup 暴露属性/方法给父组件
    expose(exposed?: Record<string, any>) {
      if (__DEV__) {
        if (exposeCalled) {
          warn(`expose() should be called only once per setup().`, vm)
        }
        exposeCalled = true
      }
      if (exposed) {
        Object.keys(exposed).forEach(key =>
          proxyWithRefUnwrap(vm, exposed, key)
        )
      }
    }
  }
}

/**
 * 用于**同步两个对象之间的属性**，保持代理对象与源对象的属性一致：
 1. **添加新属性**：如果源对象中有新的键，在代理对象上创建相应的代理属性。
 2. **检测值变化**：如果已有属性的值发生变化，标记为有变化。
 3. **移除旧属性**：如果代理对象中有源对象不存在的键，从代理对象中删除它们。
 4. **返回变化状态**：表明本次同步是否造成了任何实际变化。
 * @param to 目标代理对象，需要被同步更新的对象。
 * @param from 源对象，包含最新数据的对象。
 * @param prev 上一次的源对象，用于比较值是否发生变化。
 * @param instance Vue 组件实例，用于创建代理属性。
 * @param type 代理类型标识符，例如 '$attrs'、'$listeners' 等。
 * @returns
 */
export function syncSetupProxy(
  to: any,
  from: any,
  prev: any,
  instance: Component,
  type: string
) {
  let changed = false
  // 1. 处理新增或更新的属性
  for (const key in from) {
    if (!(key in to)) {
      // 新属性：添加代理
      changed = true
      defineProxyAttr(to, key, instance, type)
    } else if (from[key] !== prev[key]) {
      // 已有属性但值变化
      changed = true
    }
  }
  // 2. 处理已被删除的属性
  for (const key in to) {
    if (!(key in from)) {
      // 属性已从源对象中移除：删除代理属性
      changed = true
      delete to[key]
    }
  }
  return changed
}

/**
 * 定义一个**只读代理属性**
 * @param proxy 目标对象，将在这个对象上定义新的属性。
 * @param key 要定义的属性名。
 * @param instance Vue 组件实例，包含实际数据的源对象。
 * @param type 指定要代理的实例属性类型，例如 'props'、'attrs'、'listeners' 等。这决定了从哪个实例属性中读取值。
 */
function defineProxyAttr(
  proxy: any,
  key: string,
  instance: Component,
  type: string
) {
  Object.defineProperty(proxy, key, {
    enumerable: true,
    configurable: true,
    get() {
      return instance[type][key]
    }
  })
}

/**
 * 初始化插槽代理对象，只在第一次调用时创建代理对象。
 * @param vm Vue 组件实例，需要初始化插槽代理的组件。
 * @returns
 */
function initSlotsProxy(vm: Component) {
  if (!vm._slotsProxy) {
    // 只在第一次调用时创建代理对象
    syncSetupSlots((vm._slotsProxy = {}), vm.$scopedSlots)
  }
  return vm._slotsProxy
}

/**
 * 同步槽位数据到目标对象
 * @param to 目标对象，通常是槽位代理对象（`vm._slotsProxy`），需要被同步的对象。
 * @param from 源对象，通常是最新的槽位数据（`vm.$scopedSlots`），包含当前最新的插槽内容。
 */
export function syncSetupSlots(to: any, from: any) {
  // 1. 将 from 中的所有属性复制到 to 中
  for (const key in from) {
    to[key] = from[key]
  }
  // 2. 删除 to 中存在但 from 中不存在的属性
  for (const key in to) {
    if (!(key in from)) {
      delete to[key]
    }
  }
}
/**
 * @internal
 * 获取当前组件的 slots（插槽）对象。
 * 由于公共的 setup context 类型依赖于旧版 VNode 类型，这里手动指定返回类型。
 *
 * @returns 当前组件的 slots 代理对象（SetupContext['slots']）
 */
export function useSlots(): SetupContext['slots'] {
  return getContext().slots
}

/**
 * @internal
 * 获取当前组件的 attrs（非 props 属性）对象。
 * 由于公共的 setup context 类型依赖于旧版 VNode 类型，这里手动指定返回类型。
 *
 * @returns 当前组件的 attrs 代理对象（SetupContext['attrs']）
 */
export function useAttrs(): SetupContext['attrs'] {
  return getContext().attrs
}

/**
 * Vue 2 only
 * @internal
 * 获取当前组件的 listeners（事件监听器）对象。
 * 由于公共的 setup context 类型依赖于旧版 VNode 类型，这里手动指定返回类型。
 *
 * @returns 当前组件的 listeners 代理对象（SetupContext['listeners']）
 */
export function useListeners(): SetupContext['listeners'] {
  return getContext().listeners
}
/**
 * 获取当前 Vue 组件实例的 setup 上下文对象。
 * 该上下文对象包含 attrs、slots、emit 等属性，供组合式 API 使用。
 *
 * @returns SetupContext 组合式 API 的上下文对象，包含 attrs、slots、emit 等属性，
 *          用于在 setup 函数中提供除 props 外的其他组件功能。
 */
function getContext(): SetupContext {
  // 如果没有当前激活的组件实例，开发环境下给出警告
  if (__DEV__ && !currentInstance) {
    warn(`useContext() called without active instance.`)
  }
  // 获取当前组件实例
  const vm = currentInstance!
  // 如果 _setupContext 已存在则直接返回，否则创建新的 setupContext
  return vm._setupContext || (vm._setupContext = createSetupContext(vm))
}

/**
 * 运行时辅助函数，用于合并 props 的默认值声明。
 * 仅供编译后的代码导入使用。
 *
 * @param raw      原始 props 声明，可以是字符串数组或 props 对象
 * @param defaults 默认值对象，key 为 prop 名，value 为默认值
 * @returns        合并后的 props 对象，每个 prop 都带有 default 属性
 */
export function mergeDefaults(
  raw: string[] | Record<string, PropOptions>,
  defaults: Record<string, any>
): Record<string, PropOptions> {
  // 如果 raw 是数组，则将其转换为对象格式，每个 prop 都初始化为空对象
  const props = isArray(raw)
    ? raw.reduce(
        (normalized, p) => ((normalized[p] = {}), normalized),
        {} as Record<string, PropOptions>
      )
    : raw
  // 遍历 defaults，将默认值合并到 props 对象中
  for (const key in defaults) {
    const opt = props[key]
    if (opt) {
      // 如果 opt 是数组或函数，说明是类型声明，需要包装成对象
      if (isArray(opt) || isFunction(opt)) {
        props[key] = { type: opt, default: defaults[key] }
      } else {
        // 否则直接在原有对象上添加 default 属性
        opt.default = defaults[key]
      }
    } else if (opt === null) {
      // 如果 opt 为 null，也创建一个带 default 的对象
      props[key] = { default: defaults[key] }
    } else if (__DEV__) {
      // 如果没有对应的 prop 声明，开发环境下给出警告
      warn(`props default key "${key}" has no corresponding declaration.`)
    }
  }
  return props
}
