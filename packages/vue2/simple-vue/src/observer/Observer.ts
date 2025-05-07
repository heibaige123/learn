import { arrayMethods } from './arrayMethods'
import { defineReactive } from './defineReactive'
import { Dep } from './Dep'
import { hasOwn } from '../utils/hasOwn'
import { isObject } from '../utils/isObject'
import { def } from '../utils/def'

export class Observer {
  value
  dep: Dep

  constructor(value) {
    this.value = value
    this.dep = new Dep()
    def(value, '__ob__', this)

    if (Array.isArray(value)) {
      //   value.__proto__ = arrayMethods
      Object.setPrototypeOf(value, arrayMethods)
      this.observeArray(value)
    } else {
      this.walk(value)
    }
  }

  walk(obj: Record<string, unknown>) {
    const keys = Object.keys(obj)

    keys.forEach(key => {
      defineReactive(obj, key, obj[key])
    })
  }

  observeArray(items: any[]) {
    items.forEach(item => {
      observe(item)
    })
  }
}

export function observe(value, asRootData?: unknown) {
  if (!isObject(value)) {
    return
  }

  let ob

  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else {
    ob = new Observer(value)
  }

  return ob
}
