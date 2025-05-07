import { hasOwn } from '../utils/hasOwn'

export function del(target, key) {
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }

  const ob = target.__ob__

  if (target._isVue || (ob && ob.vmCount)) {
    return
  }

  if (!hasOwn(target, key)) {
    return
  }

  delete target[key]

  if (!ob) {
    return
  }

  ob.dep.notify()
}
