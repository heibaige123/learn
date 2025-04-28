/**
`<keep-alive>` 是 Vue 的一个内置抽象组件。它的主要功能是：

1.  **缓存组件实例**：当它包裹动态切换的组件时，会将失活（inactive）的组件实例缓存到内存中，而不是直接销毁。
2.  **性能优化**：当组件重新被切换回来时，`<keep-alive>` 会直接使用缓存的实例，避免了重新创建组件实例的开销，从而提升性能。
3.  **条件缓存**：可以通过 `include` 和 `exclude` prop 来控制哪些组件需要被缓存。
4.  **缓存限制**：可以通过 `max` prop 来限制最多缓存多少个组件实例，并采用 LRU（Least Recently Used，最近最少使用）策略进行淘汰。

---

`<keep-alive>` 通过其 `render` 函数巧妙地拦截了子组件的渲染过程：

1.  它首先确定是否应该缓存目标组件（基于 `include`/`exclude`）。
2.  如果需要缓存，它会检查缓存中是否已存在该组件的实例（基于 `key`）。
3.  如果存在（缓存命中），它将缓存的实例附加到当前的 VNode 上，并更新 LRU 顺序。
4.  如果不存在（缓存未命中），它标记该 VNode 等待后续在 `mounted`/`updated` 钩子中被缓存，并处理 LRU 淘汰逻辑。
5.  最后，它给 VNode 打上 `keepAlive` 标记，以便 Vue 的核心 patch 机制能够正确处理缓存组件的生命周期。

通过这种方式，`<keep-alive>` 实现了高效的组件实例复用和状态保持。

*/

import { isRegExp, isArray, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'
import type VNode from 'core/vdom/vnode'
import type { VNodeComponentOptions } from 'types/vnode'
import type { Component } from 'types/component'
import { getComponentName } from '../vdom/create-component'

/** 缓存条目的结构 */
type CacheEntry = {
  /**
   * - **含义**: 缓存的组件的名称。
   * - **来源**: 通常是通过 `_getComponentName` 辅助函数从组件的 `options.name` 或其 VNode 的 `tag` 获取的。
   * - **用途**: 主要用于 `include` 和 `exclude` prop 的匹配。当 `include` 或 `exclude` 变化时，`pruneCache` 函数会使用这个 `name` 来决定是否应该保留或移除这个缓存条目。
   */
  name?: string

  /**
   * - **含义**: 创建这个缓存条目时，对应组件的 VNode 的标签名 (e.g., `'my-component'`)。
   * - **来源**: 直接从被缓存的 VNode (`vnodeToCache.tag`) 获取。
   * - **用途**: 在 `pruneCacheEntry` 函数中，销毁缓存实例前会有一个额外的检查 (`!current || entry.tag !== current.tag`)。这个 `tag` 用于比较，增加了一层安全性，确保不会意外销毁一个具有相同 `key` 但不同 `tag` 的（理论上不太可能出现的）当前 VNode 对应的实例。
   */
  tag?: string

  /**
   * **含义**: **这是最重要的部分** - 它存储了实际被缓存的 Vue 组件**实例**。
   *
   * **来源**: 当一个组件首次被渲染并需要缓存时，它的实例 (`vnodeToCache.componentInstance`) 会被存储在这里。
   *
   * **用途**:
   * - **实例复用**: 当 `<keep-alive>` 再次渲染这个组件（缓存命中）时，它会直接将这个存储的 `componentInstance` 赋值给新的 VNode (`vnode.componentInstance = cache[key].componentInstance`)。这告诉 Vue 使用这个现有的、保持了状态的实例，而不是创建一个全新的实例。
   * - **实例销毁**: 当缓存条目需要被移除时（例如因为 `max` 限制或 `include`/`exclude` 规则变化），`pruneCacheEntry` 函数会调用这个 `componentInstance.$destroy()` 方法来正确地销毁组件实例，释放资源。
   */
  componentInstance?: Component
}

/** 缓存对象 */
type CacheEntryMap = Record<string, CacheEntry | null>

/**
 * 获取 VNode 组件选项中的组件名称
 * @param opts
 * @returns
 */
function _getComponentName(opts?: VNodeComponentOptions): string | null {
  return opts && (getComponentName(opts.Ctor.options as any) || opts.tag)
}

/**
 * 检查给定的组件名称是否匹配提供的模式。
 *
 * @param pattern 匹配模式，可以是逗号分隔的字符串、正则表达式或字符串数组。
 * @param name 要检查的组件名称。
 * @returns 如果名称匹配模式，则返回 true，否则返回 false。
 */
function matches(
  pattern: string | RegExp | Array<string>,
  name: string
): boolean {
  if (isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

/**
 * 根据提供的过滤器函数修剪 keep-alive 实例的缓存。
 * 当 include 或 exclude prop 变化时，此函数被调用以移除不再符合条件的缓存条目。
 *
 * @param keepAliveInstance keep-alive 组件实例，包含 cache, keys, _vnode, $vnode。
 * @param filter 一个函数，接收组件名称作为参数。如果该函数对某个名称返回 false，
 *               则对应的缓存条目将被移除。换句话说，filter 函数定义了哪些条目应该被“保留”。
 */
function pruneCache(
  keepAliveInstance: {
    cache: CacheEntryMap
    keys: string[]
    _vnode: VNode
    $vnode: VNode
  },
  filter: Function
) {
  const { cache, keys, _vnode, $vnode } = keepAliveInstance
  for (const key in cache) {
    const entry = cache[key]
    if (entry) {
      const name = entry.name
      // 核心判断：
      // 1. 确保组件名称存在 (name)
      // 2. 调用 filter 函数并传入组件名称 (filter(name))
      // 3. 如果 filter(name) 返回 false (表示这个条目不应该被保留)，则执行移除操作
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
  $vnode.componentOptions!.children = undefined
}

/**
 * 从缓存中移除单个条目，并销毁其关联的组件实例。
 *
 * @param cache 缓存对象 (CacheEntryMap)。
 * @param key 要移除的缓存条目的键 (string)。
 * @param keys 缓存键的数组 (Array<string>)，用于 LRU 跟踪。
 * @param current 可选的 VNode，代表当前正在被 keep-alive 渲染的组件 VNode。
 *                用于防止意外销毁当前正在使用的实例。
 */
function pruneCacheEntry(
  cache: CacheEntryMap,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const entry = cache[key]
  // 检查是否需要销毁组件实例
  // 条件：
  // a) 缓存条目 entry 必须存在 (不为 null)。
  // b) 满足以下任一条件：
  //    i) 没有提供 current VNode (通常发生在 keep-alive 组件自身销毁时，需要清理所有缓存)。
  //    ii) 或者，提供了 current VNode，但缓存条目的 tag 与 current VNode 的 tag 不同。
  //        这是一个安全检查，防止在 LRU 淘汰或规则清理时，意外销毁了当前正要渲染的组件实例
  //        (如果它们的 key 碰巧相同但 tag 不同，虽然理论上少见)。
  if (entry && (!current || entry.tag !== current.tag)) {
    // @ts-expect-error can be undefined
    entry.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

/** 定义一个包含 String, RegExp, Array 构造函数的数组 */
const patternTypes: Array<Function> = [String, RegExp, Array]

// TODO defineComponent
export default {
  /** 组件名称 */
  name: 'keep-alive',
  /** 抽象组件标记 */
  abstract: true,

  props: {
    /**
     * 包含规则：指定哪些组件应该被缓存。
     * 可以是逗号分隔的字符串、正则表达式或组件名数组。
     */
    include: patternTypes,
    /**
     * 排除规则：指定哪些组件不应该被缓存。
     * 优先级高于 include。
     * 可以是逗号分隔的字符串、正则表达式或组件名数组。
     */
    exclude: patternTypes,
    /**
     * 最大缓存数量：限制缓存的组件实例的最大数量。
     * 超出限制时，会根据 LRU (最近最少使用) 策略移除最旧的缓存。
     * 可以是字符串或数字。
     */
    max: [String, Number]
  },

  methods: {
    /**
     * 将在 render 阶段标记为待缓存的 VNode 实际添加到缓存中。
     * 同时处理 LRU 淘汰逻辑。
     */
    cacheVNode() {
      const { cache, keys, vnodeToCache, keyToCache } = this
      // 只有当 render 阶段标记了需要缓存的 VNode 时才执行
      if (vnodeToCache) {
        const { tag, componentInstance, componentOptions } = vnodeToCache
        // 创建 CacheEntry 对象并存入缓存
        cache[keyToCache] = {
          name: _getComponentName(componentOptions),
          tag,
          componentInstance
        }
        keys.push(keyToCache)
        // prune oldest entry
        // LRU 淘汰逻辑：如果设置了 max 且当前缓存数量超过 max
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
        // 清空待缓存标记，表示本次缓存操作完成
        this.vnodeToCache = null
      }
    }
  },

  created() {
    // 初始化缓存对象，使用 Object.create(null) 创建一个没有原型链的对象
    this.cache = Object.create(null)
    // 初始化用于 LRU 的键数组
    this.keys = []
  },

  destroyed() {
    // 组件销毁时，遍历所有缓存
    for (const key in this.cache) {
      // 调用 pruneCacheEntry 销毁每个缓存的组件实例，防止内存泄漏
      // 注意：这里没有传入 current VNode，所以会无条件销毁
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  mounted() {
    // 组件挂载后，尝试执行一次缓存操作 (虽然首次挂载时 vnodeToCache 通常是 null)
    this.cacheVNode()
    this.$watch('include', val => {
      // 当 include 变化时，调用 pruneCache 清理缓存
      // 过滤器逻辑：保留那些名称匹配新的 include 规则的缓存
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      // 当 exclude 变化时，调用 pruneCache 清理缓存
      // 过滤器逻辑：保留那些名称不匹配新的 exclude 规则的缓存
      pruneCache(this, name => !matches(val, name))
    })
  },

  updated() {
    // 调用 cacheVNode 可以将其加入缓存。
    this.cacheVNode()
  },

  render() {
    // 获取默认插槽内容
    const slot = this.$slots.default
    // 从插槽中获取第一个组件类型的 VNode
    const vnode = getFirstComponentChild(slot)
    // 获取 VNode 的组件选项 (如果 vnode 是一个组件的话)
    const componentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name = _getComponentName(componentOptions)
      const { include, exclude } = this
      // 如果组件不应该被缓存 (不匹配 include 或匹配 exclude)，则直接返回该 VNode，不进行缓存处理
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      // 获取缓存和键
      const { cache, keys } = this
      const key =
        // 优先使用用户在组件上设置的 :key
        vnode.key == null
          ? // same constructor may get registered as different local components
            // so cid alone is not enough (#3269)
            // 如果没有设置 key，则生成一个基于组件 cid 和 tag 的 key
            // (处理同一个构造函数注册为不同局部组件的情况 #3269)
            componentOptions.Ctor.cid +
            (componentOptions.tag ? `::${componentOptions.tag}` : '')
          : vnode.key

      // 检查缓存命中
      if (cache[key]) {
        // **核心**: 将缓存的组件实例直接赋给当前 VNode
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        // 更新 LRU 顺序：将当前 key 移到 keys 数组末尾，表示最近使用
        remove(keys, key)
        keys.push(key)
      } else {
        // delay setting the cache until update
        // 缓存未命中！
        // 将当前 VNode 标记为“待缓存”
        this.vnodeToCache = vnode
        this.keyToCache = key
        // 实际的缓存操作会延迟到 mounted 或 updated 钩子中执行 cacheVNode()
      }

      // 标记 VNode
      // 在 VNode 的 data 上添加 keepAlive 标记
      // 这个标记会告诉 Vue 的 patch 算法，对这个组件实例使用 activated/deactivated 钩子
      // @ts-expect-error can vnode.data can be undefined
      vnode.data.keepAlive = true
    }

    // 如果 vnode 是组件，返回处理后的 vnode (可能带有缓存实例或标记)
    // 如果 vnode 不是组件，或者插槽为空，则返回 vnode 或插槽的第一个节点 (可能是文本节点等)
    return vnode || (slot && slot[0])
  }
}
