import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import {
  shouldDecodeNewlines,
  shouldDecodeNewlinesForHref
} from './util/compat'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'

/**
 * 缓存通过 id 查询到的模板字符串（innerHTML）
 */
const idToTemplate = cached(id => {
  /**
   * 通过 id 查询 DOM 元素
   */
  const el = query(id)
  return el && el.innerHTML
})

/**
 * 保存原始的 $mount 方法
 */
const mount = Vue.prototype.$mount

/**
 * 重写 $mount 方法，支持 template 选项的编译
 */
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  /**
   * 通过选择器或元素获取真实的 DOM 元素
   */
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    __DEV__ &&
      warn(
        `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
      )
    return this
  }

  /**
   * 获取组件的配置信息
   */
  const options = this.$options
  // resolve template/el and convert to render function
  if (!options.render) {
    /**
     * 获取 template 选项
     */
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        /**
         * 如果 template 是以 # 开头的字符串，则认为是选择器，获取对应的模板内容
         */
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (__DEV__ && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        /**
         * 如果 template 是 DOM 节点，直接取 innerHTML
         */
        template = template.innerHTML
      } else {
        if (__DEV__) {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      /**
       * 如果没有 template，使用挂载元素的 outerHTML 作为模板
       */
      // @ts-expect-error
      template = getOuterHTML(el)
    }
    if (template) {
      /* istanbul ignore if */
      if (__DEV__ && config.performance && mark) {
        mark('compile')
      }

      /**
       * 编译模板为 render 函数和静态渲染函数
       */
      const { render, staticRenderFns } = compileToFunctions(
        template,
        {
          outputSourceRange: __DEV__,
          shouldDecodeNewlines,
          shouldDecodeNewlinesForHref,
          delimiters: options.delimiters,
          comments: options.comments
        },
        this
      )
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (__DEV__ && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * 获取元素的 outerHTML，兼容 IE 下的 SVG 元素
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue as GlobalAPI
