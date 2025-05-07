const bailRE = /[^\w.$]/

export function parsePath(path: string) {
  if (bailRE.test(path)) {
    return () => {}
  }

  const segments = path.split('.')
  return function (obj) {
    for (let index = 0; index < segments.length; index++) {
      if (!obj) return ''
      obj = obj[segments[index]]
    }

    return obj
  }
}
