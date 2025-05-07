export class VNode {
  tag: any
  data: any
  children: VNode
  text: string
  elm: any
  context: any
  componentOptions: any
  asyncFactory: any
  key: any
  ns: any
  functionalContext: any
  functionalOptions: any
  functionalScopedId: any
  componentInstance: any
  parent: any
  raw: any
  isStatic: boolean
  isRootInsert: any
  asyncMeta: any
  isComment: boolean
  isOnce: boolean
  isCloned: boolean
  isAsyncPlaceholder: boolean

  constructor(
    tag?: any,
    data?: any,
    children?: any,
    text?: any,
    elm?: any,
    context?: any,
    componentOptions?: any,
    asyncFactory?: any
  ) {
    this.tag = tag
    this.data = data
    this.children = children
    this.text = text
    this.elm = elm
    this.context = context
    this.componentOptions = componentOptions
    this.asyncFactory = asyncFactory

    this.key = data && data.key

    this.ns = undefined
    this.functionalContext = undefined
    this.functionalOptions = undefined
    this.functionalScopedId = undefined
    this.componentInstance = undefined
    this.parent = undefined
    this.raw = undefined
    this.isStatic = undefined
    this.isRootInsert = undefined
    this.asyncMeta = undefined

    this.isComment = false
    this.isOnce = false
    this.isCloned = false
    this.isAsyncPlaceholder = false
  }

  get child() {
    return this.componentInstance
  }


}
