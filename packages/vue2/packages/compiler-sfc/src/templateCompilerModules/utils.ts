import { TransformAssetUrlsOptions } from './assetUrl'
import { UrlWithStringQuery, parse as uriParse } from 'url'
import path from 'path'

/**
 * 将模板中引用的资源（如图片、视频、音频等）转换为可以被 Webpack 处理的模块化引用
 * @param url 需要转换的 URL。
 * @param transformAssetUrlsOption 用于指定转换选项
 * @returns 返回一个字符串，表示转换后的 `require` 语法或原始 URL。

@example
#### 示例 1：外部 URL
```ts
urlToRequire('http://example.com/image.png')
// 返回值：'"http://example.com/image.png"'
```

#### 示例 2：Data URL
```ts
urlToRequire('data:image/png;base64,...')
// 返回值：'"data:image/png;base64,..."'
```

#### 示例 3：相对路径
```ts
urlToRequire('./image.png')
// 返回值：'require("./image.png")'
```

#### 示例 4：带哈希的相对路径
```ts
urlToRequire('./image.png#hash')
// 返回值：'require("./image.png") + "#hash"'
```

#### 示例 5：基于 `base` 的路径
```ts
urlToRequire('./image.png', { base: 'http://example.com/assets' })
// 返回值：'"http://example.com/assets/image.png"'
```
 */
export function urlToRequire(
  url: string,
  transformAssetUrlsOption: TransformAssetUrlsOptions = {}
): string {
  const returnValue = `"${url}"`
  // same logic as in transform-require.js
  const firstChar = url.charAt(0)
  if (firstChar === '~') {
    const secondChar = url.charAt(1)
    url = url.slice(secondChar === '/' ? 2 : 1)
  }

  // 检查是否是外部 URL 或 Data URL
  if (isExternalUrl(url) || isDataUrl(url) || firstChar === '#') {
    return returnValue
  }

  const uriParts = parseUriParts(url)
  if (transformAssetUrlsOption.base) {
    // explicit base - directly rewrite the url into absolute url
    // does not apply to absolute urls or urls that start with `@`
    // since they are aliases
    if (firstChar === '.' || firstChar === '~') {
      // Allow for full hostnames provided in options.base
      const base = parseUriParts(transformAssetUrlsOption.base)
      const protocol = base.protocol || ''
      const host = base.host ? protocol + '//' + base.host : ''
      const basePath = base.path || '/'
      // when packaged in the browser, path will be using the posix-
      // only version provided by rollup-plugin-node-builtins.
      return `"${host}${(path.posix || path).join(
        basePath,
        uriParts.path + (uriParts.hash || '')
      )}"`
    }
  }

  // 处理需要转换为 `require` 的情况
  if (
    transformAssetUrlsOption.includeAbsolute ||
    firstChar === '.' ||
    firstChar === '~' ||
    firstChar === '@'
  ) {
    if (!uriParts.hash) {
      return `require("${url}")`
    } else {
      // support uri fragment case by excluding it from
      // the require and instead appending it as string;
      // assuming that the path part is sufficient according to
      // the above caseing(t.i. no protocol-auth-host parts expected)
      return `require("${uriParts.path}") + "${uriParts.hash}"`
    }
  }
  return returnValue
}

/**
 * 用于解析给定的 URL 字符串，并将其分解为各个部分（如协议、主机、路径、查询参数等）。它的主要作用是帮助处理和操作 URL，尤其是在需要对 URL 进行路径转换或重写时。
 *
 * vuejs/component-compiler-utils#22 Support uri fragment in transformed require
 * @returns 返回一个对象，包含解析后的 URL 各个部分。
 - 该对象的结构由 Node.js 的 `url.parse` 方法决定，常见字段包括：
   - `protocol`: 协议（如 `http:` 或 `https:`）。
   - `host`: 主机名（如 `example.com`）。
   - `path`: 路径部分（如 `/path`）。
   - `query`: 查询字符串（如 `query=123`）。
   - `hash`: 哈希部分（如 `#hash`）。
 */
function parseUriParts(urlString: string): UrlWithStringQuery {
  // initialize return value
  const returnValue: UrlWithStringQuery = uriParse('')
  if (urlString) {
    // A TypeError is thrown if urlString is not a string
    // @see https://nodejs.org/api/url.html#url_url_parse_urlstring_parsequerystring_slashesdenotehost
    if ('string' === typeof urlString) {
      // check is an uri
      return uriParse(urlString, false, true) // take apart the uri
    }
  }
  return returnValue
}

const externalRE = /^(https?:)?\/\//
/**
 * 用于判断给定的 URL 是否是一个 **外部 URL**（External URL）。
 * @example
 #### 匹配示例
 - 匹配成功：
   - `"http://example.com"`
   - `"https://example.com"`
   - `"//example.com"`
 - 匹配失败：
   - `"./local/path"`
   - `"/absolute/path"`
   - `"data:image/png;base64,..."`
 */
function isExternalUrl(url: string): boolean {
  return externalRE.test(url)
}

const dataUrlRE = /^\s*data:/i
/**
 * 用于判断给定的 URL 是否是一个 **Data URL**
 * @example
 #### 匹配示例
 - 匹配成功：
   - `"data:image/png;base64,..."`
   - `"   data:text/plain;charset=utf-8,..."`
   - `"DATA:application/json,..."`
 - 匹配失败：
   - `"http://example.com"`
   - `"file:///path/to/file"`
   - `"image.png"`
 */
function isDataUrl(url: string): boolean {
  return dataUrlRE.test(url)
}
