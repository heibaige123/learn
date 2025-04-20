/**
 * 表示服务器端渲染的标记属性，用于标识 HTML 是由服务器端渲染生成的。
 */
export const SSR_ATTR = 'data-server-rendered'

/**
 * 表示资源类型的常量数组，包括组件、指令和过滤器。
 */
export const ASSET_TYPES = ['component', 'directive', 'filter'] as const

/**
 * Vue 2.x 的生命周期钩子常量数组。
 * 包含了 Vue 实例在不同阶段会触发的生命周期钩子名称。
 * 这些钩子可以用于在组件的特定阶段执行逻辑。
 */
export const LIFECYCLE_HOOKS = [
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeDestroy',
  'destroyed',
  'activated',
  'deactivated',
  'errorCaptured',
  'serverPrefetch',
  'renderTracked',
  'renderTriggered'
] as const
