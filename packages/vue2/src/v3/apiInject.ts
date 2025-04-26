import { isFunction, warn } from 'core/util'
import { currentInstance } from './currentInstance'
import type { Component } from 'types/component'

/**
 * 定义一个类型安全的注入键。
 */
export interface InjectionKey<T> extends Symbol {}

/**
 * 在当前组件中提供一个值，供后代组件通过 `inject` 获取。
 * 数据通过键值对的形式存储，键可以是字符串、数字或 `InjectionKey`。
 * @param key
 * @param value
 */
export function provide<T>(key: InjectionKey<T> | string | number, value: T) {
  if (!currentInstance) {
    if (__DEV__) {
      warn(`provide() can only be used inside setup().`)
    }
  } else {
    // TS doesn't allow symbol as index type
    resolveProvided(currentInstance)[key as string] = value
  }
}

/**
 * 确保当前组件的 `_provided` 对象存在，并正确继承父组件的 `_provided` 对象。
 * @param vm
 * @returns
 */
export function resolveProvided(vm: Component): Record<string, any> {
  // by default an instance inherits its parent's provides object
  // but when it needs to provide values of its own, it creates its
  // own provides object using parent provides object as prototype.
  // this way in `inject` we can simply look up injections from direct
  // parent and let the prototype chain do the work.
  const existing = vm._provided
  const parentProvides = vm.$parent && vm.$parent._provided
  if (parentProvides === existing) {
    return (vm._provided = Object.create(parentProvides))
  } else {
    return existing
  }
}

/**
 *  在当前组件中获取祖先组件通过 `provide` 提供的值。
 * @param key
 */
export function inject<T>(key: InjectionKey<T> | string): T | undefined
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T,
  treatDefaultAsFactory?: false
): T
export function inject<T>(
  key: InjectionKey<T> | string,
  defaultValue: T | (() => T),
  treatDefaultAsFactory: true
): T
export function inject(
  key: InjectionKey<any> | string,
  defaultValue?: unknown,
  treatDefaultAsFactory = false
) {
  // fallback to `currentRenderingInstance` so that this can be called in
  // a functional component
  const instance = currentInstance
  if (instance) {
    // #2400
    // to support `app.use` plugins,
    // fallback to appContext's `provides` if the instance is at root
    const provides = instance.$parent && instance.$parent._provided

    if (provides && (key as string | symbol) in provides) {
      // TS doesn't allow symbol as index type
      return provides[key as string]
    } else if (arguments.length > 1) {
      return treatDefaultAsFactory && isFunction(defaultValue)
        ? defaultValue.call(instance)
        : defaultValue
    } else if (__DEV__) {
      warn(`injection "${String(key)}" not found.`)
    }
  } else if (__DEV__) {
    warn(`inject() can only be used inside setup() or functional components.`)
  }
}
