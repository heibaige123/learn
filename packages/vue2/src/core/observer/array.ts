/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { TriggerOpTypes } from '../../v3'
import { def } from '../util/index'

/**
 * 获取 JavaScript 原生数组的原型对象。
 */
const arrayProto = Array.prototype
/**
 * 创建一个以 `arrayProto` 为原型的对象 `arrayMethods`。
 */
export const arrayMethods = Object.create(arrayProto)

/**
 * 需要拦截的数组方法
 */
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    let inserted
    switch (method) {
      // 对于 `push` 和 `unshift` 方法，新增的元素是传入的参数（`args`）。
      case 'push':
      case 'unshift':
        inserted = args
        break
      // 对于 `splice` 方法，新增的元素是参数的第 3 个及后续部分（`args.slice(2)`）。
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // `__ob__` 是 Vue 为响应式对象添加的一个属性，存储了该对象的观察者实例。
    // 通过 `ob`，可以访问观察者实例的功能（如依赖通知、子数组观察等）。
    if (inserted) ob.observeArray(inserted)
    // notify change
    // 调用观察者实例的 `dep.notify()` 方法，通知依赖更新。
    if (__DEV__) {
      ob.dep.notify({
        type: TriggerOpTypes.ARRAY_MUTATION,
        target: this,
        key: method
      })
    } else {
      ob.dep.notify()
    }
    return result
  })
})
