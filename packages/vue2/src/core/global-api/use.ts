import type { GlobalAPI } from 'types/global-api'
import { toArray, isFunction } from '../util/index'

/**
 * 向 Vue 构造函数添加 `use` 方法，该方法用于安装 Vue 插件
 * @param Vue
 */
export function initUse(Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | any) {
    const installedPlugins =
      this._installedPlugins || (this._installedPlugins = [])
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (isFunction(plugin.install)) {
      plugin.install.apply(plugin, args)
    } else if (isFunction(plugin)) {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
