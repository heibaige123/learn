import { Dep } from './Dep'
import { parsePath } from '../utils/parsePath'
import { traverse } from './traverse'

export class Watcher {
  vm
  getter: Function
  cb: Function
  value
  deps: Dep[]
  depIds: Set<any>
  deep?: boolean

  constructor(
    vm,
    expOrFn: string | Function,
    cb: Function,
    options?: {
      deep?: boolean
    }
  ) {
    this.vm = vm

    if (options) {
      this.deep == !!options.deep
    } else {
      this.deep = false
    }

    this.deps = []
    this.depIds = new Set()

    if (typeof expOrFn === 'function') {
      this.getter = expOrFn
    } else {
      this.getter = parsePath(expOrFn)
    }

    this.cb = cb
    this.value = this.get()
  }

  get() {
    window.target = this
    const value = this.getter.call(this.vm, this.vm)

    if (this.deep) {
      traverse(value)
    }

    window.target = undefined
    return value
  }

  update() {
    const oldValue = this.value
    this.value = this.get()
    this.cb.call(this.vm, this.value, oldValue)
  }

  addDep(dep: Dep) {
    const id = dep.id

    if (!this.depIds.has(id)) {
      this.depIds.add(id)
      this.deps.push(dep)
      dep.addSub(this)
    }
  }

  teardown() {
    let index = this.deps.length

    while (index--) {
      this.deps[index].removeSub(this)
    }
  }
}
