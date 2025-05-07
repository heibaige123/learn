import { Dep } from './Dep'
import { observe } from './Observer'

export function defineReactive(data: object, key, val) {
  const childOb = observe(val)

  const dep = new Dep()

  Object.defineProperty(data, key, {
    enumerable: true,
    configurable: true,
    get() {
      dep.depend()

      if (childOb) {
        childOb.dep.depend()
      }

      return val
    },
    set(newVal) {
      if (val === newVal) {
        return
      }

      dep.notify()
      val = newVal
    }
  })
}
