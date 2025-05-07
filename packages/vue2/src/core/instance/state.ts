import config from '../config'
import Watcher from '../observer/watcher'
import Dep, { pushTarget, popTarget } from '../observer/dep'
import { isUpdatingChildComponent } from './lifecycle'
import { initSetup } from 'v3/apiSetup'

import {
  set,
  del,
  observe,
  defineReactive,
  toggleObserving
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute,
  invokeWithErrorHandling,
  isFunction
} from '../util/index'
import type { Component } from 'types/component'
import { shallowReactive, TrackOpTypes } from 'v3'

/**
 * 共享的属性定义对象
 */
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

/**
 * 创建属性代理
 * @param target 目标对象，通常是 Vue 实例（`vm`）
 * @param sourceKey 源数据的键名，如 `'_data'` 或 `'_props'`
 * @param key 要代理的属性名称
 */
export function proxy(target: Object, sourceKey: string, key: string) {
  sharedPropertyDefinition.get = function proxyGetter() {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter(val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 初始化 Vue 组件实例的所有状态选项
 * @param vm Vue 组件实例
 */
export function initState(vm: Component) {
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)

  // Composition API
  initSetup(vm)

  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    const ob = observe((vm._data = {}))
    ob && ob.vmCount++
  }
  if (opts.computed) initComputed(vm, opts.computed)
  if (opts.watch && opts.watch !== nativeWatch) {
    initWatch(vm, opts.watch)
  }
}

/**
 * 初始化 Vue 组件实例的 props 属性
 * @param vm Vue 组件实例
 * @param propsOptions 组件选项中定义的 props 对象
 */
function initProps(vm: Component, propsOptions: Object) {
  const propsData = vm.$options.propsData || {}
  const props = (vm._props = shallowReactive({}))
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys: string[] = (vm.$options._propKeys = [])
  const isRoot = !vm.$parent
  // root instance props should be converted
  if (!isRoot) {
    toggleObserving(false)
  }
  for (const key in propsOptions) {
    keys.push(key)
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (__DEV__) {
      const hyphenatedKey = hyphenate(key)
      if (
        isReservedAttribute(hyphenatedKey) ||
        config.isReservedAttr(hyphenatedKey)
      ) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(
        props,
        key,
        value,
        () => {
          if (!isRoot && !isUpdatingChildComponent) {
            warn(
              `Avoid mutating a prop directly since the value will be ` +
                `overwritten whenever the parent component re-renders. ` +
                `Instead, use a data or computed property based on the prop's ` +
                `value. Prop being mutated: "${key}"`,
              vm
            )
          }
        },
        true /* shallow */
      )
    } else {
      defineReactive(props, key, value, undefined, true /* shallow */)
    }
    // static props are already proxied on the component's prototype
    // during Vue.extend(). We only need to proxy props defined at
    // instantiation here.
    if (!(key in vm)) {
      proxy(vm, `_props`, key)
    }
  }
  toggleObserving(true)
}

/**
 * 初始化 Vue 组件实例的 data 数据
 * @param vm
 */
function initData(vm: Component) {
  let data: any = vm.$options.data
  data = vm._data = isFunction(data) ? getData(data, vm) : data || {}
  if (!isPlainObject(data)) {
    data = {}
    __DEV__ &&
      warn(
        'data functions should return an object:\n' +
          'https://v2.vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
        vm
      )
  }
  // proxy data on instance
  const keys = Object.keys(data)
  const props = vm.$options.props
  const methods = vm.$options.methods
  let i = keys.length
  while (i--) {
    const key = keys[i]
    if (__DEV__) {
      if (methods && hasOwn(methods, key)) {
        warn(`Method "${key}" has already been defined as a data property.`, vm)
      }
    }
    if (props && hasOwn(props, key)) {
      __DEV__ &&
        warn(
          `The data property "${key}" is already declared as a prop. ` +
            `Use prop default value instead.`,
          vm
        )
    } else if (!isReserved(key)) {
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  const ob = observe(data)
  ob && ob.vmCount++
}

/**
 * 执行组件的 data 函数并获取返回值
 * @param data 组件定义的 data 函数
 * @param vm Vue 组件实例
 * @returns
 */
export function getData(data: Function, vm: Component): any {
  // #7573 disable dep collection when invoking data getters
  pushTarget()
  try {
    return data.call(vm, vm)
  } catch (e: any) {
    handleError(e, vm, `data()`)
    return {}
  } finally {
    popTarget()
  }
}

const computedWatcherOptions = { lazy: true }

/**
 * 初始化 Vue 组件的计算属性，为每个计算属性创建观察者(Watcher)并设置响应式连接。
 * @param vm Vue 组件实例
 * @param computed 组件选项中定义的计算属性对象
 */
function initComputed(vm: Component, computed: Object) {
  // - 创建无原型链的纯对象，用于存储每个计算属性的专用观察者实例
  // - 保存到 `vm._computedWatchers` 属性上供内部使用
  // $flow-disable-line
  const watchers = (vm._computedWatchers = Object.create(null))
  // computed properties are just getters during SSR
  // 检查是否在服务器端渲染环境中执行，SSR 环境下计算属性处理方式有所不同
  const isSSR = isServerRendering()

  // - 获取用户定义的计算属性（函数或带有 get 方法的对象）
  // - 提取 getter 函数
  for (const key in computed) {
    const userDef = computed[key]
    const getter = isFunction(userDef) ? userDef : userDef.get
    if (__DEV__ && getter == null) {
      warn(`Getter is missing for computed property "${key}".`, vm)
    }

    if (!isSSR) {
      // - 为每个计算属性创建特殊的 Watcher 实例
      // - `computedWatcherOptions` 包含 `{ lazy: true }`，实现懒计算机制
      // - 这种观察者只在属性被访问时才计算值，且缓存结果直到依赖变化
      // create internal watcher for the computed property.
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // - 调用 `defineComputed` 在 Vue 实例上定义计算属性的 getter 和 setter
      // - 只处理实例化时定义的计算属性，原型上已有的计算属性会被跳过
      defineComputed(vm, key, userDef)
    } else if (__DEV__) {
      // - 开发环境下检查计算属性与其他属性是否重名
      // - 发现冲突时发出适当的警告
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      } else if (vm.$options.methods && key in vm.$options.methods) {
        warn(
          `The computed property "${key}" is already defined as a method.`,
          vm
        )
      }
    }
  }
}

/**
 * 在目标对象上定义计算属性，设置适当的 getter 和 setter，并处理缓存策略。
 * @param target 目标对象，通常是 Vue 实例
 * @param key 计算属性的名称
 * @param userDef 用户定义的计算属性，可以是函数或具有 get/set 方法的对象
 */
export function defineComputed(
  target: any,
  key: string,
  userDef: Record<string, any> | (() => any)
) {
  // - 在客户端渲染时启用缓存（`shouldCache = true`）
  // - 在服务器端渲染(SSR)时禁用缓存（`shouldCache = false`）
  const shouldCache = !isServerRendering()

  // - 如果计算属性是函数形式，将函数作为 getter
  // - 根据缓存策略选择合适的 getter 实现
  // - 设置空操作函数作为 setter（只读属性）
  if (isFunction(userDef)) {
    sharedPropertyDefinition.get = shouldCache
      ? createComputedGetter(key)
      : createGetterInvoker(userDef)
    sharedPropertyDefinition.set = noop
  }
  // - 处理具有 get/set 方法的对象形式
  // - 如果存在 get 方法，根据缓存策略和用户设置选择合适的 getter 实现
  // - 如果存在 set 方法，使用它，否则使用空操作函数
  else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : createGetterInvoker(userDef.get)
      : noop
    sharedPropertyDefinition.set = userDef.set || noop
  }
  if (__DEV__ && sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

/**
 * 创建计算属性的 getter 函数
 * @param key 计算属性的名称，用于在 `_computedWatchers` 对象中查找对应的 watcher
 * @returns
 */
function createComputedGetter(key) {
  return function computedGetter() {
    // 从组件实例的 `_computedWatchers` 中获取对应计算属性的观察者实例
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // `dirty` 标志表示依赖项已变化，需要重新计算
      if (watcher.dirty) {
        // `evaluate()` 方法会执行计算属性的 getter 函数并缓存结果
        watcher.evaluate()
      }
      // `Dep.target` 表示当前正在收集依赖的观察者（渲染 watcher 或其他计算属性 watcher）
      if (Dep.target) {
        if (__DEV__ && Dep.target.onTrack) {
          Dep.target.onTrack({
            effect: Dep.target,
            target: this,
            type: TrackOpTypes.GET,
            key
          })
        }
        // `watcher.depend()` 建立当前计算属性与外部观察者之间的依赖关系
        watcher.depend()
      }
      return watcher.value
    }
  }
}

/**
 * 创建计算属性的无缓存版本的 getter 函数。它直接调用原始计算函数，不进行任何缓存或依赖追踪。
 * @param fn 原始的计算函数或计算属性的 get 方法
 * @returns
 */
function createGetterInvoker(fn) {
  return function computedGetter() {
    return fn.call(this, this)
  }
}

/**
 * 初始化 Vue 组件的方法，将用户定义的方法绑定到组件实例上，并确保方法内的 `this` 指向组件实例
 * @param vm Vue 组件实例
 * @param methods 组件选项中定义的方法对象
 */
function initMethods(vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (__DEV__) {
      if (typeof methods[key] !== 'function') {
        warn(
          `Method "${key}" has type "${typeof methods[
            key
          ]}" in the component definition. ` +
            `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(`Method "${key}" has already been defined as a prop.`, vm)
      }
      if (key in vm && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
            `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = typeof methods[key] !== 'function' ? noop : bind(methods[key], vm)
  }
}

/**
 * 初始化 Vue 组件实例中定义的所有侦听器(watchers)
 * @param vm Vue 组件实例
 * @param watch 组件选项中定义的侦听器配置对象
 */
function initWatch(vm: Component, watch: Object) {
  for (const key in watch) {
    const handler = watch[key]
    if (Array.isArray(handler)) {
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

/**
 * 处理各种格式的侦听器配置，将其规范化后调用 `vm.$watch` 方法创建真正的侦听器
 * @param vm Vue 组件实例
 * @param expOrFn 要侦听的表达式或函数，可以是属性路径字符串（如 `'user.name'`）或函数
 * @param handler 侦听器回调函数或配置对象
 * @param options 可选的侦听器配置选项
 * @returns
 */
function createWatcher(
  vm: Component,
  expOrFn: string | (() => any),
  handler: any,
  options?: Object
) {
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  return vm.$watch(expOrFn, handler, options)
}

/**
 * 向 Vue 构造函数的原型上添加与状态相关的属性和方法，包括 `$data`、`$props`、`$set`、`$delete` 和 `$watch`。
 * @param Vue
 */
export function stateMixin(Vue: typeof Component) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef: any = {}
  dataDef.get = function () {
    return this._data
  }
  const propsDef: any = {}
  propsDef.get = function () {
    return this._props
  }
  if (__DEV__) {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
          'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  // 设置 `$data` 属性，代理到内部的 `_data` 对象
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  // 设置 `$props` 属性，代理到内部的 `_props` 对象
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  // 添加 `$set` 方法：用于向响应式对象添加新属性，并确保新属性也是响应式的
  Vue.prototype.$set = set
  // 添加 `$delete` 方法：用于从响应式对象中删除属性，并触发视图更新
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | (() => any),
    cb: any,
    options?: Record<string, any>
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      const info = `callback for immediate watcher "${watcher.expression}"`
      pushTarget()
      invokeWithErrorHandling(cb, vm, [watcher.value], vm, info)
      popTarget()
    }
    return function unwatchFn() {
      watcher.teardown()
    }
  }
}
