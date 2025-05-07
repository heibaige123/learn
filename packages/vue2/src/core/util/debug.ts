import config from '../config'
import { noop, isFunction } from 'shared/util'
import type { Component } from 'types/component'
import { currentInstance } from 'v3/currentInstance'
import { getComponentName } from '../vdom/create-component'

/**
 * 用于发出警告信息的函数。
 * @param msg 警告信息的内容。
 * @param vm 可选参数，表示与警告相关的 Vue 组件实例。
 */
export let warn: (msg: string, vm?: Component | null) => void = noop
/**
 * 一个空操作函数的别名，用于在非生产环境中显示提示信息。
 * 在生产环境中，`tip` 被设置为 `noop`，以避免额外的性能开销。
 */
export let tip = noop
/**
 * 生成组件的调用栈信息，用于调试和错误追踪。
 * @param vm - 组件实例。
 * @returns 返回组件的调用栈信息字符串。
 */
export let generateComponentTrace: (vm: Component) => string // work around flow check
/**
 * 格式化组件名称的方法。
 * @param vm - 组件实例。
 * @param includeFile - 是否包含文件路径，默认为 false。
 * @returns 返回格式化后的组件名称字符串。
 */
export let formatComponentName: (vm: Component, includeFile?: false) => string

if (__DEV__) {
  const hasConsole = typeof console !== 'undefined'
  const classifyRE = /(?:^|[-_])(\w)/g
  /**
   * 将字符串转换为分类名称格式。
   * 该函数会将匹配 classifyRE 的部分转换为大写，并移除字符串中的连字符（-）和下划线（_）。
   *
   * @param str - 输入的字符串
   * @returns 转换后的分类名称格式字符串
   */
  const classify = str =>
    str.replace(classifyRE, c => c.toUpperCase()).replace(/[-_]/g, '')

  warn = (msg, vm = currentInstance) => {
    const trace = vm ? generateComponentTrace(vm) : ''

    if (config.warnHandler) {
      config.warnHandler.call(null, msg, vm, trace)
    } else if (hasConsole && !config.silent) {
      console.error(`[Vue warn]: ${msg}${trace}`)
    }
  }

  tip = (msg, vm) => {
    if (hasConsole && !config.silent) {
      console.warn(`[Vue tip]: ${msg}` + (vm ? generateComponentTrace(vm) : ''))
    }
  }

  formatComponentName = (vm, includeFile) => {
    if (vm.$root === vm) {
      return '<Root>'
    }
    const options =
      isFunction(vm) && (vm as any).cid != null
        ? (vm as any).options
        : vm._isVue
        ? vm.$options || (vm.constructor as any).options
        : vm
    let name = getComponentName(options)
    const file = options.__file
    if (!name && file) {
      const match = file.match(/([^/\\]+)\.vue$/)
      name = match && match[1]
    }

    return (
      (name ? `<${classify(name)}>` : `<Anonymous>`) +
      (file && includeFile !== false ? ` at ${file}` : '')
    )
  }

  /**
   * 一个用于重复字符串的函数。
   *
   * @param str 要重复的字符串。
   * @param n 重复的次数。
   * @returns 返回重复后的字符串。
   */
  const repeat = (str, n) => {
    let res = ''
    while (n) {
      if (n % 2 === 1) res += str
      if (n > 1) str += str
      n >>= 1
    }
    return res
  }

  generateComponentTrace = (vm: Component | undefined) => {
    if ((vm as any)._isVue && vm!.$parent) {
      const tree: any[] = []
      let currentRecursiveSequence = 0
      while (vm) {
        if (tree.length > 0) {
          const last = tree[tree.length - 1]
          if (last.constructor === vm.constructor) {
            currentRecursiveSequence++
            vm = vm.$parent!
            continue
          } else if (currentRecursiveSequence > 0) {
            tree[tree.length - 1] = [last, currentRecursiveSequence]
            currentRecursiveSequence = 0
          }
        }
        tree.push(vm)
        vm = vm.$parent!
      }
      return (
        '\n\nfound in\n\n' +
        tree
          .map(
            (vm, i) =>
              `${i === 0 ? '---> ' : repeat(' ', 5 + i * 2)}${
                Array.isArray(vm)
                  ? `${formatComponentName(vm[0])}... (${
                      vm[1]
                    } recursive calls)`
                  : formatComponentName(vm)
              }`
          )
          .join('\n')
      )
    } else {
      return `\n\n(found in ${formatComponentName(vm!)})`
    }
  }
}
