// using literal strings instead of numbers so that it's easier to inspect
// debugger events

/**
 * 表示依赖追踪操作类型
 */
export const enum TrackOpTypes {
  /**
   * 获取操作
   */
  GET = 'get',
  /**
   * 触碰操作
   */
  TOUCH = 'touch'
}

/**
 * 表示触发操作类型
 */
export const enum TriggerOpTypes {
  /**
   * 设置操作
   */
  SET = 'set',
  /**
   * 添加操作
   */
  ADD = 'add',
  /**
   * 删除操作
   */
  DELETE = 'delete',
  /**
   * 数组变更操作
   */
  ARRAY_MUTATION = 'array mutation'
}
