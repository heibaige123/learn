import { inBrowser } from 'core/util/env'
import { makeMap } from 'shared/util'

/**
 * 命名空间映射对象，用于存储特定命名空间的 URI。
 * - `svg`: 对应 SVG 的命名空间 URI。
 * - `math`: 对应 MathML 的命名空间 URI。
 */
export const namespaceMap = {
  svg: 'http://www.w3.org/2000/svg',
  math: 'http://www.w3.org/1998/Math/MathML'
}

/**
 * 判断给定的标签名是否为标准的 HTML 标签。
 * 使用 `makeMap` 方法生成一个快速查找的映射表。
 *
 * 包含的标签包括：
 * - 常见的结构性标签，如 `div`, `span`, `header`, `footer` 等。
 * - 表单相关标签，如 `input`, `button`, `form`, `textarea` 等。
 * - 媒体相关标签，如 `audio`, `video`, `canvas` 等。
 * - 表格相关标签，如 `table`, `tr`, `td`, `th` 等。
 * - 其他 HTML5 新增标签，如 `template`, `dialog`, `details` 等。
 */
export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
    'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
    'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
    'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
    's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
    'embed,object,param,source,canvas,script,noscript,del,ins,' +
    'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
    'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
    'output,progress,select,textarea,' +
    'details,dialog,menu,menuitem,summary,' +
    'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
/**
 * 判断一个标签是否为 SVG 标签。
 *
 * 该方法通过 `makeMap` 工具函数生成一个快速查找的映射表，
 * 用于判断指定的标签名是否属于 SVG 标签集合。
 *
 * @constant
 */
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
    'foreignobject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
    'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)
/**
 * 判断一个标签是否是 `pre` 标签。
 *
 * `pre` 标签通常用于表示预格式化的文本内容，
 * 其中的空格和换行符会被保留。
 */
export const isPreTag = (tag?: string): boolean => tag === 'pre'

/**
 * 判断给定的标签是否是保留标签。
 * 保留标签包括 HTML 标签和 SVG 标签。
 *
 * @param tag - 要检查的标签名称。
 * @returns 如果是保留标签返回 true，否则返回 false。
 */
export const isReservedTag = (tag: string): boolean | undefined => {
  return isHTMLTag(tag) || isSVG(tag)
}

/**
 * 获取指定标签的命名空间。
 * @param tag - 要检查的标签名称。
 * @returns 如果标签是 SVG，则返回 'svg'；
 *          如果标签是 MathML 的根元素 'math'，则返回 'math'；
 *          否则返回 undefined。
 */
export function getTagNamespace(tag: string): string | undefined {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}

/**
 * 一个缓存对象，用于存储未知元素的相关信息。
 * 通过 Object.create(null) 创建，确保没有原型链上的属性干扰。
 */
const unknownElementCache = Object.create(null)
/**
 * 判断一个标签是否为未知元素。
 *
 * - 如果当前环境不是浏览器环境，直接返回 true。
 * - 如果标签是保留标签（HTML 或 SVG），返回 false。
 * - 如果标签包含 `-`，则通过构造函数判断是否为未知元素。
 * - 否则，通过 `HTMLUnknownElement` 的正则匹配判断。
 *
 * @param tag - 要检查的标签名称。
 * @returns 如果是未知元素返回 true，否则返回 false。
 */
export function isUnknownElement(tag: string): boolean {
  /* istanbul ignore if */
  if (!inBrowser) {
    return true
  }
  if (isReservedTag(tag)) {
    return false
  }
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  const el = document.createElement(tag)
  if (tag.indexOf('-') > -1) {
    // https://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] =
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement)
  } else {
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}

/**
 * 判断输入类型是否为文本输入类型
 *
 * 该方法通过 `makeMap` 工具函数生成一个映射，用于快速判断指定的输入类型是否属于
 * 文本输入类型。支持的类型包括：`text`、`number`、`password`、`search`、`email`、
 * `tel` 和 `url`。
 */
export const isTextInputType = makeMap(
  'text,number,password,search,email,tel,url'
)
