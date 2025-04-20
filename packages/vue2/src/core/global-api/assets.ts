import { ASSET_TYPES } from 'shared/constants'
import type { GlobalAPI } from 'types/global-api'
import { isFunction, isPlainObject, validateComponentName } from '../util/index'

/**
 * 初始化资源注册方法。
 *
 * @param Vue 全局 API 对象，用于扩展组件、指令和过滤器等资源。
 */
export function initAssetRegisters(Vue: GlobalAPI) {
  /**
   * 创建资源注册方法。
   */
  ASSET_TYPES.forEach(type => {
    /**
     * 注册或检索指定类型的资源。
     *
     * @param id 资源的唯一标识符。
     * @param definition 可选的资源定义，可以是函数或对象。
     * @returns 如果未提供定义，则返回已注册的资源；否则返回定义本身。
     */
    // @ts-expect-error function is not exact same type
    Vue[type] = function (
      id: string,
      definition?: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (__DEV__ && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          // @ts-expect-error
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && isFunction(definition)) {
          definition = { bind: definition, update: definition }
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
