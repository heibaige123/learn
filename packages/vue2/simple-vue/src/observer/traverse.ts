import { isObject } from '../utils/isObject'

const seenObjects = new Set()

export function traverse(val) {
  _traverse(val, seenObjects)
  seenObjects.clear()
}

function _traverse(val, seen) {
  const isArray = Array.isArray(val)

  if ((!isArray && !isObject(val)) || Object.isFrozen(val)) {
    return
  }

  if (val.__ob__) {
    const depId = val.__ob__.dep.id

    if (seen.has(depId)) {
      seen.add(depId)
    }
  }

  if (isArray) {
    val.forEach(item => {
      _traverse(item, seen)
    })
  } else {
    Object.keys(val).forEach(key => {
      _traverse(val[key], seen)
    })
  }
}
