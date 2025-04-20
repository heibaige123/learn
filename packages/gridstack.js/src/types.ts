/**
 * types.ts 11.5.0-dev
 * Copyright (c) 2021-2024 Alain Dumesny - see GridStack root license
 */

import {GridStack} from './gridstack';
import {GridStackEngine} from './gridstack-engine';

/**
 * 网格选项的默认值 - 在初始化和保存时使用 */
export const gridDefaults: GridStackOptions = {
    /**
     * 在移动设备上始终显示调整大小的句柄 */
    alwaysShowResizeHandle: 'mobile',

    /**
     * 启用动画效果 */
    animate: true,

    /**
     * 如果为true，gridstack将初始化现有项目 */
    auto: true,

    /**
     * 单元格高度（可以是整数（px）或字符串（例如：'100px', '10em', '10rem'）） */
    cellHeight: 'auto',

    /**
     * cellHeight='auto'时的节流时间延迟 */
    cellHeightThrottle: 100,

    /**
     * cellHeight的单位 */
    cellHeightUnit: 'px',

    /**
     * 列数 */
    column: 12,

    /**
     * 可拖动选项 */
    draggable: {handle: '.grid-stack-item-content', appendTo: 'body', scroll: true},

    /**
     * 可拖动句柄选择器 */
    handle: '.grid-stack-item-content',

    /**
     * 额外的部件类名 */
    itemClass: 'grid-stack-item',

    /**
     * 网格项目之间的间隙 */
    margin: 10,

    /**
     * margin的单位 */
    marginUnit: 'px',

    /**
     * 最大行数 */
    maxRow: 0,

    /**
     * 最小行数 */
    minRow: 0,

    /**
     * 占位符的类名 */
    placeholderClass: 'grid-stack-placeholder',

    /**
     * 占位符默认内容 */
    placeholderText: '',

    /**
     * 可移除选项 */
    removableOptions: {
        accept: 'grid-stack-item',
        decline: 'grid-stack-non-removable'
    },

    /**
     * 可调整大小选项 */
    resizable: {handles: 'se'},

    /**
     * 从右到左布局 */
    rtl: 'auto'

    // **** same as not being set ****
    // **** 与未设置相同 ****
    // disableDrag: false,
    // disableResize: false,
    // float: false,
    // handleClass: null,
    // removable: false,
    // staticGrid: false,
    //removable
};

/**
 * 改变列数时的不同布局选项，包括自定义函数，该函数接收新/旧列数和新/旧位置数组
 * 注意：如果我们在该大小有布局缓存且后来添加了新项目，则新列表可能已经部分填充
 * 选项包括：
 * 'list' - 将项目视为排序列表，保持项目顺序（除非太大而无法适应列数），顺序重新排列它们
 * 'compact' - 类似于list，但使用compact()方法，如果由于较大项目需要推到下一行而有空槽可用，则可能重新排序项目
 * 'moveScale' - 将按新列数/旧列数的比例缩放和移动项目
 * 'move' | 'scale' - 仅调整大小或移动项目
 * 'none' - 除非项目不适合列数，否则保持项目不变
 */
export type ColumnOptions =
    | 'list'
    | 'compact'
    | 'moveScale'
    | 'move'
    | 'scale'
    | 'none'
    | ((
          column: number,
          oldColumn: number,
          nodes: GridStackNode[],
          oldNodes: GridStackNode[]
      ) => void);

/**
 * 压缩布局选项 */
export type CompactOptions = 'list' | 'compact';

/**
 * 数字或字符串类型 */
export type numberOrString = number | string;

/**
 * GridStack HTML元素扩展 */
export interface GridItemHTMLElement extends HTMLElement {
    /**
     * 指向网格节点实例的指针 */
    gridstackNode?: GridStackNode;

    /**
     * @internal 内部原始网格节点 */
    _gridstackNodeOrig?: GridStackNode;
}

/**
 * GridStack元素的联合类型 */
export type GridStackElement = string | HTMLElement | GridItemHTMLElement;

/**
 * .on()方法的特定和通用事件处理程序 */
export type GridStackEventHandler = (event: Event) => void;

/**
 * 同时接收元素的事件处理程序 */
export type GridStackElementHandler = (event: Event, el: GridItemHTMLElement) => void;

/**
 * 接收节点数组的事件处理程序 */
export type GridStackNodesHandler = (event: Event, nodes: GridStackNode[]) => void;

/**
 * 处理已放置项目的事件处理程序 */
export type GridStackDroppedHandler = (
    event: Event,
    previousNode: GridStackNode,
    newNode: GridStackNode
) => void;

/**
 * 所有可能的事件处理程序的联合类型 */
export type GridStackEventHandlerCallback =
    | GridStackEventHandler
    | GridStackElementHandler
    | GridStackNodesHandler
    | GridStackDroppedHandler;

/**
 * 在load()过程中调用的可选函数，用于回调用户新添加/移除的网格项或网格 */
export type AddRemoveFcn = (
    parent: HTMLElement,
    w: GridStackWidget,
    add: boolean,
    grid: boolean
) => HTMLElement | undefined;

/**
 * 在save()过程中调用的可选函数，允许调用者向将要返回的GridStackWidget结构添加额外的自定义数据 */
export type SaveFcn = (node: GridStackNode, w: GridStackWidget) => void;

/**
 * 在load()/addWidget()过程中调用的可选函数，允许调用者创建自定义内容而不是纯文本 */
export type RenderFcn = (el: HTMLElement, w: GridStackWidget) => void;

/**
 * 根据内容调整元素大小的函数 */
export type ResizeToContentFcn = (el: GridItemHTMLElement) => void;

/**
 * 描述网格的响应式特性 */
export interface Responsive {
    /**
     * 希望维持的宽度以动态选择列数 */
    columnWidth?: number;

    /**
     * 允许的最大列数 */
    columnMax?: number;

    /**
     * 显式的宽度:列断点，代替自动的'columnWidth' */
    breakpoints?: Breakpoint[];

    /**
     * 指定断点是用于窗口大小还是网格大小 */
    breakpointForWindow?: boolean;

    /**
     * 改变列数时的全局重新布局模式 */
    layout?: ColumnOptions;
}

/**
 * 响应式断点配置
 * */
export interface Breakpoint {
    /**
     * `<=` 触发断点的宽度
     * */
    w?: number;

    /**
     * 列数
     *  */
    c: number;

    /**
     * 如果与全局设置不同的重新布局模式
     * */
    layout?: ColumnOptions;
    /** TODO: children layout, which spells out exact locations and could omit/add some children */
    // children?: GridStackWidget[];
}

/**
 * 定义网格的选项
 */
export interface GridStackOptions {
    /**
     * 接受从其他网格或外部拖动的部件（默认值：`false`）。可以是：
     * - `true`（使用`'.grid-stack-item'`类过滤器）或`false`
     * - 字符串形式的明确类名
     * - 返回布尔值的函数。参见[示例](http://gridstack.github.io/gridstack.js/demo/two.html)
     */
    acceptWidgets?: boolean | string | ((element: Element) => boolean);

    /**
     * 控制何时显示调整大小的句柄
     */
    alwaysShowResizeHandle?: true | false | 'mobile';

    /**
     * 启用动画
     *  */
    animate?: boolean;

    /**
     * 如果为false，gridstack将不会初始化现有项目
     * */
    auto?: boolean;

    /**
     * 单元格高度
     * */
    cellHeight?: numberOrString;

    /**
     * cellHeight='auto'时的节流时间延迟
     *  */
    cellHeightThrottle?: number;

    /**
     * cellHeight的单位
     * */
    cellHeightUnit?: string;

    /**
     * 调用load()或addGrid()时要创建的子项列表
     *  */
    children?: GridStackWidget[];

    /**
     * 列数 */
    column?: number | 'auto';

    /**
     * 宽度:列行为的响应式列布局 */
    columnOpts?: Responsive;

    /**
     * 在'.grid-stack'之上的额外类，以区分此实例 */
    class?: string;

    /**
     * 禁止拖动部件 */
    disableDrag?: boolean;

    /**
     * 禁止调整部件大小 */
    disableResize?: boolean;

    /**
     * 允许覆盖UI可拖动选项
     * */
    draggable?: DDDragOpt;

    /**
     * 允许用户将嵌套的网格项拖出父项
     *  */
    //dragOut?: boolean;

    /**
     * 要创建的引擎类型
     *  */
    engineClass?: typeof GridStackEngine;

    /**
     *
     * 启用浮动部件
     * */
    float?: boolean;

    /**
     *
     * 可拖动句柄选择器
     *  */
    handle?: string;

    /**
     *
     * 可拖动句柄类
     *  */
    handleClass?: string;

    /**
     * 额外的部件类 */
    itemClass?: string;

    /**
     * 当我们是子网格并且正在调整大小时的重新布局模式。默认为'list'
     */
    layout?: ColumnOptions;

    /**
     * 当部件仅在滚动到视图中时创建时为true */
    lazyLoad?: boolean;

    /**
     * 网格项和内容之间的间隙 */
    margin?: numberOrString;

    /**
     *  旧方法可选地设置每一侧 - 使用margin: '5px 10px 0 20px'代替 */
    marginTop?: numberOrString;
    marginRight?: numberOrString;
    marginBottom?: numberOrString;
    marginLeft?: numberOrString;

    /**
     *
     * margin的单位 */
    marginUnit?: string;

    /**
     *
     * 最大行数 */
    maxRow?: number;

    /**
     * 最小行数 */
    minRow?: number;

    /**
     * 如果您使用基于nonce的内容安全策略，请在此处传递您的nonce，GridStack将其添加到它创建的`<style>`元素中。 */
    nonce?: string;

    /**
     * 占位符的类 */
    placeholderClass?: string;

    /**
     *
     * 占位符默认内容 */
    placeholderText?: string;

    /**
     *
     * 允许覆盖UI可调整大小选项 */
    resizable?: DDResizeOpt;

    /**
     * 如果为true，可以通过拖动到网格外部来移除部件 */
    removable?: boolean | string;

    /**
     *
     * 允许覆盖UI可移除选项 */
    removableOptions?: DDRemoveOpt;

    /**
     *
     * 固定网格行数 */
    row?: number;

    /**
     * 如果为true，将网格转换为RTL */
    rtl?: boolean | 'auto';

    /**
     * 如果所有网格项的高度应基于内容大小，则设置为true */
    sizeToContent?: boolean;

    /**
     * 使网格静态 */
    staticGrid?: boolean;

    /**
     * @deprecated 不再使用，样式现在使用本地CSS变量实现 */
    styleInHead?: boolean;

    /**
     *
     * 我们下方自动创建的子网格选项的差异列表 */
    subGridOpts?: GridStackOptions;

    /**
     *
     * 通过完全拖动项目来启用/禁用动态创建子网格（嵌套）与部分（推送）。强制`DDDragOpt.pause=true`来实现这一点。 */
    subGridDynamic?: boolean;
}

/**
 *
 * GridStackEngine.moveNode()期间使用的选项 */
export interface GridStackMoveOpts extends GridStackPosition {
    /**
     *
     * 跳过碰撞的节点 */
    skip?: GridStackNode;
    /**
     *
     * 我们是否打包（默认true） */
    pack?: boolean;
    /**
     *
     * 如果我们递归调用此方法以防止简单交换或覆盖碰撞，则为true - 默认false */
    nested?: boolean;
    /**
     *
     * 计算其他单元格坐标的变量 */
    cellWidth?: number;
    cellHeight?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    /**
     *
     * 当前拖动项目的位置（以像素为单位）（用于重叠检查） */
    rect?: GridStackPosition;
    /**
     *
     * 如果我们正在实时调整大小，则为true */
    resizing?: boolean;
    /**
     *
     * 我们碰撞的最佳节点（覆盖最多） */
    collide?: GridStackNode;
    /**
     *
     * 即使我们不移动也进行碰撞检查 */
    forceCollide?: boolean;
}

export interface GridStackPosition {
    /**
     *
     * 小部件位置x */
    x?: number;
    /**
     *
     * 小部件位置y */
    y?: number;
    /**
     *
     * 小部件尺寸宽度 */
    w?: number;
    /**
     *
     * 小部件尺寸高度 */
    h?: number;
}

/**
 * GridStack小部件创建选项
 */
export interface GridStackWidget extends GridStackPosition {
    /**
     * 如果为true，则忽略x，y参数，小部件将放置在第一个可用位置 */
    autoPosition?: boolean;
    /**
     * 调整大小/创建期间允许的最小宽度 */
    minW?: number;
    /**
     * 调整大小/创建期间允许的最大宽度 */
    maxW?: number;
    /**
     * 调整大小/创建期间允许的最小高度 */
    minH?: number;
    /**
     * 调整大小/创建期间允许的最大高度 */
    maxH?: number;
    /**
     * 防止用户直接调整大小 */
    noResize?: boolean;
    /**
     * 防止用户直接移动 */
    noMove?: boolean;
    /**
     * 与noMove+noResize相同，但也防止被其他小部件或api推送 */
    locked?: boolean;
    /**
     * 存储在小部件上的`gs-id`值 */
    id?: string;
    /**
     * 作为内容附加的html */
    content?: string;
    /**
     * 当小部件仅在滚动到视图中时创建时为true */
    lazyLoad?: boolean;
    /**
     * 本地（与网格相比）覆盖 - 请参阅GridStackOptions。
     * 注意：这还允许您设置最大h值（但在正常调整大小期间用户可更改），以防止无限内容占用过多空间（获取滚动条） */
    sizeToContent?: boolean | number;
    /**
     * GridStack.resizeToContentParent的本地覆盖，指定用于父级（实际）与子级（所需）高度的类 */
    resizeToContentParent?: string;
    /**
     * 可选的嵌套网格选项和子项列表，然后在运行时转换为实际实例以获取选项 */
    subGridOpts?: GridStackOptions;
}

/**
 *  Drag&Drop resize options
 *
 * 拖放调整大小选项 */
export interface DDResizeOpt {
    /**
     * 默认情况下调整大小句柄是否隐藏，直到鼠标悬停？ - 桌面默认：true，移动设备默认：false */
    autoHide?: boolean;
    /**
     *
     *
     * 可以调整大小的侧面（例如：'e, se, s, sw, w'） - 默认'se'（东南）
     * 注意：不建议从顶部调整大小，因为可能会出现奇怪的副作用。
     */
    handles?: string;
}

/**
 * 拖放移除选项 */
export interface DDRemoveOpt {
    /**
     * 可以移除的类 */
    accept?: string;
    /**
     * 不能移除的类 */
    decline?: string;
}

/**
 * 拖放拖动选项 */
export interface DDDragOpt {
    /**
     * 可以拖动的项目的类选择器 */
    handle?: string;
    /**
     * 默认值为'body' */
    appendTo?: string;
    /**
     * 如果设置（true | msec），拖动放置（碰撞）仅在用户暂停后发生。注意：这是全局的 */
    pause?: boolean | number;
    /**
     * 默认值为`true` */
    scroll?: boolean;
    /**
     * 防止在指定元素上开始拖动，列为逗号分隔的选择器（例如：'.no-drag'）。内置默认值为'input,textarea,button,select,option' */
    cancel?: string;
    /**
     * 放置时的辅助函数：'clone'或您自己的方法 */
    helper?: 'clone' | ((el: HTMLElement) => HTMLElement);
    /**
     * 回调 */
    start?: (event: Event, ui: DDUIData) => void;
    stop?: (event: Event) => void;
    drag?: (event: Event, ui: DDUIData) => void;
}
export interface Size {
    width: number;
    height: number;
}
export interface Position {
    top: number;
    left: number;
}
export interface Rect extends Size, Position {}

/**
 * 在拖动和调整大小回调期间传递的数据 */
export interface DDUIData {
    position?: Position;
    size?: Size;
    draggable?: HTMLElement;
    /* fields not used by GridStack but sent by jq ? leave in case we go back to them...
  originalPosition? : Position;
  offset?: Position;
  originalSize?: Size;
  element?: HTMLElement[];
  helper?: HTMLElement[];
  originalElement?: HTMLElement[];
  */
}

/**
 * 描述网格中小部件的内部运行时描述
 */
export interface GridStackNode extends GridStackWidget {
    /**
     * 指向HTML元素的指针 */
    el?: GridItemHTMLElement;
    /**
     * 指向父网格实例的指针 */
    grid?: GridStack;
    /**
     * 实际的子网格实例 */
    subGrid?: GridStack;
    /**
     * 允许在可见时延迟创建 */
    visibleObservable?: IntersectionObserver;
    /**
     * @internal 内部id，用于在克隆引擎或保存列布局时匹配 */
    _id?: number;
    /**
     * @internal 由于x,y,w,h值的变化，节点属性是否需要更新 */
    _dirty?: boolean;
    /**
     * @internal */
    _updating?: boolean;
    /**
     * @internal 当在垃圾桶/另一个网格上时为true，因此我们不必费心删除将动画返回到旧位置的拖动CSS样式 */
    _isAboutToRemove?: boolean;
    /**
     * @internal 如果项目来自网格外部 -> 实际项目需要移动 */
    _isExternal?: boolean;
    /**
     * @internal 导致移动|调整大小的鼠标事件 */
    _event?: MouseEvent;
    /**
     * @internal 移动与调整大小 */
    _moving?: boolean;
    /**
     * @internal 是否正在调整大小？ */
    _resizing?: boolean;
    /**
     * @internal 如果我们跳过了下面的项目（一次跳跃，因此我们不必完全通过它），则为true */
    _skipDown?: boolean;
    /**
     * @internal 拖动/调整大小前的原始值 */
    _orig?: GridStackPosition;
    /**
     * @internal 碰撞检查期间使用的像素位置 */
    _rect?: GridStackPosition;
    /**
     * @internal 拖动前的顶部/左侧像素位置，以便我们可以检测到从最后位置移动的方向 */
    _lastUiPosition?: Position;
    /**
     * @internal 设置在被拖动/调整大小的项目上，记住我们尝试过的最后位置（但失败了），因此在拖动/调整大小期间不会再次尝试 */
    _lastTried?: GridStackPosition;
    /**
     * @internal willItFit()将使用的位置来定位项目 */
    _willFitPos?: GridStackPosition;
    /**
     * @internal 最后一次拖动Y像素位置，用于增量更新V滚动条 */
    _prevYPix?: number;
    /**
     * @internal 如果我们已经从自己移除了项目（拖出），但可能会恢复（释放在空白处 -> 返回），则为true */
    _temporaryRemoved?: boolean;
    /**
     * @internal 如果我们应该在_notify()上移除DOM元素而不是清除_id（旧方法），则为true */
    _removeDOM?: boolean;
    /**
     * @internal 如果从侧边栏拖动，项目的原始位置/大小
     * */
    _sidebarOrig?: GridStackPosition;
    /**
     * @internal 表示拖放是否已初始化
     * */
    _initDD?: boolean;
}
