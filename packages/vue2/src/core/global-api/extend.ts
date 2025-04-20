import { ASSET_TYPES } from 'shared/constants'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'
import { getComponentName } from '../vdom/create-component'

/**
 * 初始化 Vue 的扩展功能。
 * @param Vue 全局 API 对象
 */
export function initExtend(Vue: GlobalAPI) {
  /**
   * 每个实例构造函数（包括 Vue）都有一个唯一的 cid。
   * 这使我们能够为原型继承创建包装的“子构造函数”并缓存它们。
   */
  Vue.cid = 0
  let cid = 1

  /**
   * 类继承方法，用于创建一个新的 Vue 子类。
   * @param extendOptions 扩展选项
   * @returns 新的组件构造函数
   */
  Vue.extend = function (extendOptions: any): typeof Component {
    /**
     * 缓存的构造函数，用于避免重复创建相同的子类。
     */
    extendOptions = extendOptions || {}
    const Super = this
    const SuperId = Super.cid
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      return cachedCtors[SuperId]
    }

    /**
     * 子类的名称，用于组件递归自查找。
     */
    const name =
      getComponentName(extendOptions) || getComponentName(Super.options)
    if (__DEV__ && name) {
      validateComponentName(name)
    }

    /**
     * 子类构造函数。
     * @param options 实例化选项
     */
    const Sub = function VueComponent(this: any, options: any) {
      this._init(options)
    } as unknown as typeof Component

    /**
     * 子类的原型继承自父类。
     */
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub

    /**
     * 子类的唯一 cid。
     */
    Sub.cid = cid++

    /**
     * 子类的合并选项。
     */
    Sub.options = mergeOptions(Super.options, extendOptions)

    /**
     * 父类的引用。
     */
    Sub['super'] = Super

    // 如果子类定义了 props 和 computed 属性，则初始化它们。
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // 允许子类继续使用扩展、混入和插件功能。
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // 创建资源注册器，使子类也可以拥有自己的私有资源。
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })

    // 如果有名称，则启用递归自查找。
    if (name) {
      Sub.options.components[name] = Sub
    }

    /**
     * 父类的选项快照，用于实例化时检查父类选项是否已更新。
     */
    Sub.superOptions = Super.options

    /**
     * 子类的扩展选项。
     */
    Sub.extendOptions = extendOptions

    /**
     * 子类的密封选项，用于防止修改。
     */
    Sub.sealedOptions = extend({}, Sub.options)

    // 缓存构造函数。
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

/**
 * 初始化组件的 props 属性。
 * 遍历组件的 props 配置，并在组件原型上为每个 prop 添加代理。
 *
 * @param Comp - 组件的构造函数，其类型为 `typeof Component`。
 */
function initProps(Comp: typeof Component) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

/**
 * 初始化组件的计算属性 (computed properties)。
 * 遍历组件的 `computed` 配置项，并为每个计算属性定义 getter 和 setter。
 *
 * @param Comp - 组件的构造函数，其 `options` 属性包含组件的配置。
 */
function initComputed(Comp: typeof Component) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
