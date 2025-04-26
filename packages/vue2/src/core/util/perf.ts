import { inBrowser } from './env'

/**
 * 性能标记（performance mark），用于记录性能相关的时间点
 */
export let mark: (tag: string) => PerformanceMark
/**
 * 用于性能测量（performance measure）,用于记录性能测量的时间段，并清除相关的标记（marks）
 */
export let measure: (name: string, startTag: string, endTag: string) => void

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
