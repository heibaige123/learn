import { makeMap } from 'shared/util'

/**
 * 判断是否为一元标签的工具函数。
 * 一元标签是指不需要闭合的 HTML 标签，例如 <br>、<img> 等。
 * 该函数通过调用 `makeMap` 方法生成一个快速查找的映射表。
 */
export const isUnaryTag = makeMap(
  'area,base,br,col,embed,frame,hr,img,input,isindex,keygen,' +
    'link,meta,param,source,track,wbr'
)

// Elements that you can, intentionally, leave open
// (and which close themselves)
/**
 * 定义一个可以省略闭合标签的 HTML 标签集合。
 * 这些标签在 HTML 规范中允许不需要显式闭合。
 * @example
 * canBeLeftOpenTag('li') // true
 * canBeLeftOpenTag('div') // false
 */
export const canBeLeftOpenTag = makeMap(
  'colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr,source'
)

// HTML5 tags https://html.spec.whatwg.org/multipage/indices.html#elements-3
// Phrasing Content https://html.spec.whatwg.org/multipage/dom.html#phrasing-content
/**
 * 判断是否为非短语标签的工具函数。
 * 非短语标签包括如 `address`、`article`、`div` 等 HTML 标签。
 * 使用 `makeMap` 方法生成一个快速查找的映射。
 */
export const isNonPhrasingTag = makeMap(
  'address,article,aside,base,blockquote,body,caption,col,colgroup,dd,' +
    'details,dialog,div,dl,dt,fieldset,figcaption,figure,footer,form,' +
    'h1,h2,h3,h4,h5,h6,head,header,hgroup,hr,html,legend,li,menuitem,meta,' +
    'optgroup,option,param,rp,rt,source,style,summary,tbody,td,tfoot,th,thead,' +
    'title,tr,track'
)
