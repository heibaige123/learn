import { Hooks } from "./hooks";
import { AttachData } from "./helpers/attachto";
import { VNodeStyle } from "./modules/style";
import { On } from "./modules/eventlisteners";
import { Attrs } from "./modules/attributes";
import { Classes } from "./modules/class";
import { Props } from "./modules/props";
import { Dataset } from "./modules/dataset";

export type Key = PropertyKey;

/**
 * VNode 接口表示虚拟 DOM 节点的结构。
 */
export interface VNode {
  /**
   * 节点的选择器，例如标签名或 CSS 选择器。
   */
  sel: string | undefined;

  /**
   * 节点的附加数据，例如属性、事件监听器等。
   */
  data: VNodeData | undefined;

  /**
   * 子节点数组，可以是 VNode 或字符串。
   */
  children: Array<VNode | string> | undefined;

  /**
   * 对应的真实 DOM 节点。
   */
  elm: Node | undefined;

  /**
   * 节点的文本内容。
   */
  text: string | undefined;

  /**
   * 节点的唯一标识键，用于优化节点更新。
   */
  key: Key | undefined;
}

/**
 * 表示虚拟节点的数据结构。
 */
export interface VNodeData<VNodeProps = Props> {
  /** 节点的属性集合 */
  props?: VNodeProps;

  /** 节点的 HTML 属性 */
  attrs?: Attrs;

  /** 节点的 CSS 类 */
  class?: Classes;

  /** 节点的内联样式 */
  style?: VNodeStyle;

  /** 节点的自定义数据集 */
  dataset?: Dataset;

  /** 节点的事件监听器 */
  on?: On;

  /** 节点的附加数据 */
  attachData?: AttachData;

  /** 节点的生命周期钩子 */
  hook?: Hooks;

  /** 节点的唯一标识键 */
  key?: Key;

  /** 节点的命名空间（用于 SVG 等） */
  ns?: string;

  /** 节点的 thunk 函数 */
  fn?: () => VNode;

  /** 节点的 thunk 参数 */
  args?: any[];

  /** 自定义元素的 `is` 属性 */
  is?: string;

  /** 其他第三方模块的扩展属性 */
  [key: string]: any;
}

/**
 * vnode 函数，用于创建一个虚拟节点对象。
 * @param sel - 节点的选择器，例如标签名、类名或 ID。
 * @param data - 节点的属性、事件等数据对象。
 * @param children - 子节点数组，可以是 VNode 或字符串。
 * @param text - 节点的文本内容。
 * @param elm - 对应的真实 DOM 元素。
 * @returns 一个 VNode 对象，表示虚拟节点。
 */
export function vnode(
  sel: string | undefined,
  data: any | undefined,
  children: Array<VNode | string> | undefined,
  text: string | undefined,
  elm: Element | DocumentFragment | Text | undefined
): VNode {
  const key = data === undefined ? undefined : data.key;
  return { sel, data, children, text, elm, key };
}
