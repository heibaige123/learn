import { inBrowser } from './env'

/**
 * 标记性能测量的函数或变量，用于记录性能相关的时间点。
 * 具体实现可能依赖于浏览器的性能 API 或其他工具。
 */
export let mark
/**
 * 用于性能测量的变量，可能会在运行时被赋值为具体的测量函数。
 */
export let measure

if (__DEV__) {
  /**
   * 表示浏览器环境中是否支持性能监测的性能对象。
   * 如果运行环境是浏览器且 `window.performance` 可用，则 `perf` 为性能对象；
   * 否则为 `undefined`。
   */
  const perf = inBrowser && window.performance
  /* istanbul ignore if */
  if (
    perf &&
    // @ts-ignore
    perf.mark &&
    // @ts-ignore
    perf.measure &&
    // @ts-ignore
    perf.clearMarks &&
    // @ts-ignore
    perf.clearMeasures
  ) {
    mark = tag => perf.mark(tag)
    measure = (name, startTag, endTag) => {
      perf.measure(name, startTag, endTag)
      perf.clearMarks(startTag)
      perf.clearMarks(endTag)
      // perf.clearMeasures(name)
    }
  }
}
