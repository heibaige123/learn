let uid = 0

export class Dep {
  private subs: any[]
  id: number

  constructor() {
    this.id = uid++
    this.subs = []
  }

  addSub(sub) {
    this.subs.push(sub)
  }

  removeSub(sub) {
    const index = this.subs.indexOf(sub)

    if (index > -1) {
      return this.subs.splice(index, 1)
    }
  }

  depend() {
    if (window.target) {
      window.target.addDep(this)
    }
  }

  notify() {
    const subs = this.subs.slice()

    for (let index = 0; index < this.subs.length; index++) {
      subs[index].update()
    }
  }
}

function remove(arr, item) {
  if (!arr.length) {
    return
  }

  const index = arr.indexOf(item)

  if (index > -1) {
    return arr.splice(index, 1)
  }
}
