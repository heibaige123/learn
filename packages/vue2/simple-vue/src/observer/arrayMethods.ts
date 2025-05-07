import { Observer } from './Observer'

const arrayProto = Array.prototype

export const arrayMethods = Object.create(arrayProto)
;['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(
  method => {
    const original = arrayMethods[method]

    Object.defineProperty(arrayMethods, method, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function mutator(...args) {
        const result = original.apply(this, args)
        const ob = this.__ob__ as Observer

        let inserted

        switch (method) {
          case 'push':
          case 'unshift': {
            inserted = args
            break
          }
          case 'splice': {
            inserted = args.splice(2)
            break
          }
        }

        if (inserted) {
          ob.observeArray(inserted)
        }

        ob.dep.notify()
        return result
      }
    })
  }
)
