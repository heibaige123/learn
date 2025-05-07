import {del} from './del';
import {set} from './set';
import { Watcher } from './Watcher'

function Vue() {}

Vue.prototype.$watch = function (
  expOrFn: string | Function,
  cb: Function,
  options?: {
    immediate?: boolean
    deep?: boolean
  }
) {
  const vm = this
  const watcher = new Watcher(vm, expOrFn, cb, options)

  if (options.immediate) {
    cb.call(vm, watcher.value)
  }

  return function unwatchFn() {
    watcher.teardown()
  }
}

Vue.prototype.$set = set
Vue.prototype.$del = del