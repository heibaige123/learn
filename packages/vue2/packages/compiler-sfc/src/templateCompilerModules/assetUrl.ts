// vue compiler module for transforming `<tag>:<attribute>` to `require`

import { urlToRequire } from './utils'
import { ASTNode, ASTAttr } from 'types/compiler'

/**
 * 表示资源 URL 的选项配置。
 * 每个键是一个字符串，表示选项的名称。
 * 值可以是字符串或字符串数组，表示与该选项相关联的值。
 */
export interface AssetURLOptions {
  [name: string]: string | string[]
}

/**
 * 用于自动解析和转换模板中引用的静态资源路径

 1. **自动路径解析**：将模板中相对路径的资源引用转换为正确的路径。
 2. **支持自定义标签和属性**：允许开发者定义哪些标签和属性需要进行路径转换。
 3. **适配不同的构建工具**：确保资源路径在开发环境和生产环境中都能正确解析。
 */
export interface TransformAssetUrlsOptions {
  /**
   * 指定资源路径的基础路径（Base URL）
   */
  base?: string
  /**
   * 是否转换绝对路径的资源引用。
   */
  includeAbsolute?: boolean
}

/**
 * 为模板中的特定标签和属性提供默认的路径转换规则
 */
const defaultOptions: AssetURLOptions = {
  audio: 'src',
  video: ['src', 'poster'],
  source: 'src',
  img: 'src',
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href']
}

export default (
  userOptions?: AssetURLOptions,
  transformAssetUrlsOption?: TransformAssetUrlsOptions
) => {
  const options = userOptions
    ? Object.assign({}, defaultOptions, userOptions)
    : defaultOptions

  return {
    postTransformNode: (node: ASTNode) => {
      transform(node, options, transformAssetUrlsOption)
    }
  }
}

/**
 *  Vue 2 的模板编译器中用于处理静态资源路径转换的核心逻辑。
 * 它会根据配置规则，将模板中指定标签和属性的资源路径（如 <img src="./logo.png">）转换为构建工具
 * （如 Webpack）可识别的形式（如 require('./logo.png')）
 * @param node 当前处理的 AST 节点
 * @param options 资源 URL 转换规则
 * @param transformAssetUrlsOption 额外的路径转换选项
 * @returns
 */
function transform(
  node: ASTNode,
  options: AssetURLOptions,
  transformAssetUrlsOption?: TransformAssetUrlsOptions
) {
  if (node.type !== 1 || !node.attrs) return
  for (const tag in options) {
    if (tag === '*' || node.tag === tag) {
      const attributes = options[tag]
      if (typeof attributes === 'string') {
        node.attrs!.some(attr =>
          rewrite(attr, attributes, transformAssetUrlsOption)
        )
      } else if (Array.isArray(attributes)) {
        attributes.forEach(item =>
          node.attrs!.some(attr =>
            rewrite(attr, item, transformAssetUrlsOption)
          )
        )
      }
    }
  }
}

/**
 * 检查某个属性是否需要被转换，并在满足条件时对其值进行改写
 * @param attr 表示模板中某个标签的属性节点
 * @param name 表示需要检查的属性名称。
 * @param transformAssetUrlsOption 用于传递额外的路径转换选项（如 `base` 或 `includeAbsolute`）。
 * 这些选项会被传递给 `urlToRequire` 函数，用于生成最终的路径。
 * @returns
 */
function rewrite(
  attr: ASTAttr,
  name: string,
  transformAssetUrlsOption?: TransformAssetUrlsOptions
) {
  if (attr.name === name) {
    const value = attr.value
    // only transform static URLs
    if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      attr.value = urlToRequire(value.slice(1, -1), transformAssetUrlsOption)
      return true
    }
  }
  return false
}
