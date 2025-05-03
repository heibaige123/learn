import { warn, hasSymbol, isFunction, isObject } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'
import type { Component } from 'types/component'
import { resolveProvided } from 'v3/apiInject'

/**
 * 用于**初始化当前组件的 provide 数据**，让后代组件可以通过 inject 访问到这些数据
 * @param vm 当前的 Vue 组件实例。这个实例上有 `$options` 属性，里面可能包含 `provide` 选项
 * @returns
 */
export function initProvide(vm: Component) {
  const provideOption = vm.$options.provide
  if (provideOption) {
    // 1. 获取 provide 的内容
    const provided = isFunction(provideOption)
      ? provideOption.call(vm)
      : provideOption
    if (!isObject(provided)) {
      return
    }
    // 2. 获取当前组件的 _provided 对象（用于存储 provide 的内容）
    const source = resolveProvided(vm)
    // IE9 doesn't support Object.getOwnPropertyDescriptors so we have to
    // iterate the keys ourselves.
    // 3. 兼容 IE9，遍历所有 key
    const keys = hasSymbol ? Reflect.ownKeys(provided) : Object.keys(provided)
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      Object.defineProperty(
        source,
        key,
        Object.getOwnPropertyDescriptor(provided, key)!
      )
    }
  }
}

/**
 * 用于**初始化当前组件的 inject 数据**，让组件能够使用祖先组件提供的 provide 数据
 * @param vm 当前的 Vue 组件实例。这个实例上有 `$options` 属性，里面可能包含 `inject` 选项
 */
export function initInjections(vm: Component) {
  // 1. 解析并获取所有需要注入的数据
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (__DEV__) {
        // 开发环境：带警告的响应式定义
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
              `overwritten whenever the provided component re-renders. ` +
              `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        // 生产环境：普通响应式定义
        defineReactive(vm, key, result[key])
      }
    })
    // 4. 恢复观察模式
    toggleObserving(true)
  }
}

/**
 * 解析组件的 inject 配置，并从祖先组件中查找匹配的 provide 值
 * @param inject 组件的 inject 配置选项。可以是多种形式，如 `['foo']` 或 `{ foo: { from: 'bar', default: 'value' } }`
 * @param vm 当前的 Vue 组件实例，用于访问其 `_provided` 属性，从祖先组件中查找提供的值。
 * @returns
 */
export function resolveInject(
  inject: any,
  vm: Component
): Record<string, any> | undefined | null {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    // 1. 创建结果对象
    const result = Object.create(null)
    // 2. 获取所有 inject 的键
    const keys = hasSymbol ? Reflect.ownKeys(inject) : Object.keys(inject)

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      // 3. 跳过响应式标记属性
      if (key === '__ob__') continue
      // 4. 查找 provide 的键
      const provideKey = inject[key].from
      // 5. 在组件链上查找匹配的 provide 值
      if (provideKey in vm._provided) {
        result[key] = vm._provided[provideKey]
        // 6. 如果找不到但有默认值，使用默认值
      } else if ('default' in inject[key]) {
        const provideDefault = inject[key].default
        result[key] = isFunction(provideDefault)
          ? provideDefault.call(vm)
          : provideDefault
        // 7. 开发环境下，找不到且没默认值时警告
      } else if (__DEV__) {
        warn(`Injection "${key as string}" not found`, vm)
      }
    }
    return result
  }
}
