/*!
 * GridStack 11.5.0-dev
 * https://gridstackjs.com/
 *
 * Copyright (c) 2021-2024  Alain Dumesny
 * see root license https://github.com/gridstack/gridstack.js/tree/master/LICENSE
 */
import {GridStackEngine} from './gridstack-engine';
import {Utils, HeightData, obsolete, DragTransform} from './utils';
import {
    gridDefaults,
    ColumnOptions,
    GridItemHTMLElement,
    GridStackElement,
    GridStackEventHandlerCallback,
    GridStackNode,
    GridStackWidget,
    numberOrString,
    DDUIData,
    DDDragOpt,
    GridStackPosition,
    GridStackOptions,
    GridStackEventHandler,
    GridStackNodesHandler,
    AddRemoveFcn,
    SaveFcn,
    CompactOptions,
    GridStackMoveOpts,
    ResizeToContentFcn,
    GridStackDroppedHandler,
    GridStackElementHandler,
    Position,
    RenderFcn
} from './types';

/*
 * 并默认包含拖放 (D&D) 功能
 * TODO: 虽然我们可以生成一个更小的 gridstack-static.js（节省约 31k，41k -> 72k）
 * 但我不知道如何生成仅包含 DD 的代码（剩余 31k）以延迟加载，因为代码依赖于 Gridstack.ts
 * 此外，这在生产环境中导致了加载问题 - 参见 https://github.com/gridstack/gridstack.js/issues/2039
 */
import {DDGridStack} from './dd-gridstack';
import {isTouch} from './dd-touch';
import {DDManager} from './dd-manager';
import {DDElementHost} from './dd-element'; /** 全局实例 */
const dd = new DDGridStack();

// export all dependent file as well to make it easier for users to just import the main file
export * from './types';
export * from './utils';
export * from './gridstack-engine';
export * from './dd-gridstack';

/**
 * 表示一个 HTML 元素，该元素是 GridStack 网格的父元素。
 * 该接口扩展了标准的 HTMLElement，并添加了一个可选的 `gridstack` 属性，
 * 该属性指向与该元素关联的 GridStack 实例。
 */
export interface GridHTMLElement extends HTMLElement {
    gridstack?: GridStack; // 网格的父 DOM 元素指向网格类实例
}
/** list of possible events, or space separated list of them */
/**
 * 表示 GridStack 库可能触发的事件。
 *
 * 事件包括：
 * - `added`：当小部件被添加到网格时触发。
 * - `change`：当网格布局发生变化时触发。
 * - `disable`：当网格被禁用时触发。
 * - `drag`：在小部件拖动操作期间触发。
 * - `dragstart`：当小部件拖动操作开始时触发。
 * - `dragstop`：当小部件拖动操作结束时触发。
 * - `dropped`：当小部件被拖放到网格中时触发。
 * - `enable`：当网格被启用时触发。
 * - `removed`：当小部件从网格中移除时触发。
 * - `resize`：在小部件调整大小操作期间触发。
 * - `resizestart`：当小部件调整大小操作开始时触发。
 * - `resizestop`：当小部件调整大小操作结束时触发。
 * - `resizecontent`：当小部件的内容被调整大小时触发。
 */
export type GridStackEvent =
    | 'added'
    | 'change'
    | 'disable'
    | 'drag'
    | 'dragstart'
    | 'dragstop'
    | 'dropped'
    | 'enable'
    | 'removed'
    | 'resize'
    | 'resizestart'
    | 'resizestop'
    | 'resizecontent';

/** 定义对象的坐标 */
export interface MousePosition {
    /**
     * 对象顶部的像素位置
     */
    top: number;
    /**
     * 对象左侧的像素位置
     */
    left: number;
}

/** 定义网格中单元格的位置 */
export interface CellPosition {
    /**
     * 单元格的列索引
     */
    x: number;
    /**
     * 单元格的行索引
     */
    y: number;
}

/**
 * 扩展我们需要的内部字段 - TODO: 将其他项目移到这里
 */
interface InternalGridStackOptions extends GridStackOptions {
  _alwaysShowResizeHandle?: true | false | 'mobile'; // 用于保存时恢复的标志
}

/**
 * 临时的旧版支持 (<10.x)
 */
interface OldOneColumnOpts extends GridStackOptions {
  /** 禁用当网格宽度较小时的单列模式 (默认值?: false) */
  disableOneColumnMode?: boolean;
  /** 网格显示为单列模式的最小宽度 (默认值?: 768) */
  oneColumnSize?: number;
  /** 如果希望单列模式在排序时使用 DOM 顺序并忽略正常多列布局中的 x,y 值，请设置为 true。
   * 这使您能够拥有与其他布局不同的自定义单列布局。 (默认值?: false) */
  oneColumnModeDomSort?: boolean;
}

/**
 * 主网格栈类 - 您需要首先调用 `GridStack.init()` 来初始化您的网格。
 * 注意：您的网格元素必须具有以下类，以确保 CSS 布局正常工作：
 * @example
 * <div class="grid-stack">
 *   <div class="grid-stack-item">
 *     <div class="grid-stack-item-content">项目 1</div>
 *   </div>
 * </div>
 */
export class GridStack {
    /**
     * 初始化 HTML 元素或选择器字符串为一个网格，并返回该网格实例。
     * 如果再次调用此方法，将直接返回现有实例（忽略任何传入的选项）。
     * 还可以使用 initAll() 方法一次性初始化多个网格，或者使用 addGrid() 方法从 JSON 创建整个网格。
     * @param options 网格选项（可选）
     * @param elOrString 要转换为网格的元素或 CSS 选择器（默认选择器为 '.grid-stack'）
     *
     * @example
     * const grid = GridStack.init();
     *
     * 注意：HTMLElement（类型为 GridHTMLElement）将存储一个 `gridstack: GridStack` 值，可以稍后检索
     * const grid = document.querySelector('.grid-stack').gridstack;
     */
    public static init(
      options: GridStackOptions = {},
      elOrString: GridStackElement = '.grid-stack'
    ): GridStack {
      if (typeof document === 'undefined') return null; // 临时解决服务端渲染问题
      const el = GridStack.getGridElement(elOrString);
      if (!el) {
        if (typeof elOrString === 'string') {
          console.error(
            'GridStack.initAll() 未找到选择器 "' +
              elOrString +
              '" 对应的网格 - 元素缺失或选择器错误？' +
              '\n注意：".grid-stack" 是正确的 CSS 样式和拖放功能所需的默认选择器。'
          );
        } else {
          console.error('GridStack.init() 未传递网格元素。');
        }
        return null;
      }
      if (!el.gridstack) {
        el.gridstack = new GridStack(el, Utils.cloneDeep(options));
      }
      return el.gridstack;
    }

    /**
     * 将初始化一组元素（通过选择器指定）并返回一个网格数组。
     * @param options 网格选项（可选）
     * @param selector 要转换为网格的元素选择器（默认为 '.grid-stack' 类选择器）
     *
     * @example
     * const grids = GridStack.initAll();
     * grids.forEach(...)
     */
    public static initAll(options: GridStackOptions = {}, selector = '.grid-stack'): GridStack[] {
      const grids: GridStack[] = [];
      if (typeof document === 'undefined') return grids; // 临时解决服务端渲染问题
      GridStack.getGridElements(selector).forEach((el) => {
        if (!el.gridstack) {
          el.gridstack = new GridStack(el, Utils.cloneDeep(options));
        }
        grids.push(el.gridstack);
      });
      if (grids.length === 0) {
        console.error(
          'GridStack.initAll() 未找到选择器 "' +
            selector +
            '" 对应的网格 - 元素缺失或选择器错误？' +
            '\n注意：".grid-stack" 是正确的 CSS 样式和拖放功能所需的默认选择器。'
        );
      }
      return grids;
    }

    /**
     * 调用此方法以使用给定选项创建一个网格，包括从 JSON 结构加载任何子项。
     * 这将调用 GridStack.init()，然后对传递的子项调用 grid.load()（递归）。
     * 如果您希望整个网格来自 JSON 序列化数据（包括选项），这是调用 init() 的一个很好的替代方法。
     * @param parent HTML 元素，作为网格的父容器
     * @param opt 网格选项，用于初始化网格以及子项列表
     */
    public static addGrid(parent: HTMLElement, opt: GridStackOptions = {}): GridStack {
      if (!parent) return null;

      let el = parent as GridHTMLElement;
      if (el.gridstack) {
        // 如果已经是一个网格 - 设置选项并加载数据
        const grid = el.gridstack;
        if (opt) grid.opts = {...grid.opts, ...opt};
        if (opt.children !== undefined) grid.load(opt.children);
        return grid;
      }

      // 创建网格元素，但检查传递的 'parent' 是否已经具有网格样式并应被使用
      const parentIsGrid = parent.classList.contains('grid-stack');
      if (!parentIsGrid || GridStack.addRemoveCB) {
        if (GridStack.addRemoveCB) {
          el = GridStack.addRemoveCB(parent, opt, true, true);
        } else {
          el = Utils.createDiv(['grid-stack', opt.class], parent);
        }
      }

      // 创建网格类并加载任何子项
      const grid = GridStack.init(opt, el);
      return grid;
    }

    /** 调用此方法以注册您的引擎，而不是默认引擎。
     * 如果您只需要替换一个实例，请参见 `GridStackOptions.engineClass`。
     */
    static registerEngine(engineClass: typeof GridStackEngine): void {
      GridStack.engineClass = engineClass;
    }

    /**
     * 回调方法，用于在需要创建或删除新项目|网格时使用，而不是默认行为。
     * item: <div class="grid-stack-item"><div class="grid-stack-item-content">w.content</div></div>
     * grid: <div class="grid-stack">grid content...</div>
     * add = true: 返回的 DOM 元素将通过 makeWidget()|GridStack:init() 转换为 GridItemHTMLElement。
     * add = false: 项目将从 DOM 中移除（如果尚未移除）。
     * grid = true|false 表示网格与网格项。
     */
    public static addRemoveCB?: AddRemoveFcn;

    /**
     * 在保存期间的回调，应用程序可以为每个小部件注入额外的数据，除了网格布局属性之外。
     */
    public static saveCB?: SaveFcn;

    /**
     * 回调以创建小部件的内容，以便应用程序可以控制如何存储和恢复内容。
     * 默认情况下，此库将执行 'el.textContent = w.content'，强制仅支持文本以避免潜在的 XSS 问题。
     */
    public static renderCB?: RenderFcn = (el: HTMLElement, w: GridStackNode) => {
      if (el && w?.content) el.textContent = w.content;
    };

    /** 用于替代内置 resizeToContent 的回调函数 */
    public static resizeToContentCB?: ResizeToContentFcn;
    /** 用于调整内容大小的父类，默认为 '.grid-stack-item-content' */
    public static resizeToContentParent = '.grid-stack-item-content';

    /** 工具类的作用域，用户可以调用例如 GridStack.Utils.sort() */
    public static Utils = Utils;

    /** 引擎类的作用域，用户可以调用例如 new GridStack.Engine(12) */
    public static Engine = GridStackEngine;

    /** 实现非 DOM 网格功能的引擎 */
    public engine: GridStackEngine;

    /** 如果我们是嵌套的（位于两个网格之间的 grid-item 内部），指向父网格项 */
    public parentGridNode?: GridStackNode;

    /** 动画（如果启用）完成后等待的时间，以便内容大小调整可以发生 */
    public animationDelay = 300 + 10;

    /** @internal 引擎类，用于实现非 DOM 网格功能 */
    protected static engineClass: typeof GridStackEngine;
    /** @internal 用于监听大小变化的观察器 */
    protected resizeObserver: ResizeObserver;

    /** @internal 为我们生成的 CSS 样式表的唯一类名 */
    protected _styleSheetClass?: string;
    /** @internal 如果通过拖拽手势创建，则为 true，这样我们可以在拖出时移除（临时） */
    public _isTemp?: boolean;

    /** @internal 创建占位符 DIV（如有需要） */
    public get placeholder(): GridItemHTMLElement {
      if (!this._placeholder) {
        this._placeholder = Utils.createDiv([
          this.opts.placeholderClass,
          gridDefaults.itemClass,
          this.opts.itemClass
        ]);
        const placeholderChild = Utils.createDiv(['placeholder-content'], this._placeholder);
        if (this.opts.placeholderText) {
          placeholderChild.textContent = this.opts.placeholderText;
        }
      }
      return this._placeholder;
    }
    /** @internal 占位符元素 */
    protected _placeholder: GridItemHTMLElement;
    /** @internal 防止在加载到小列布局时更新缓存的布局 */
    protected _ignoreLayoutsNodeChange: boolean;
    /** @internal 事件处理器集合 */
    public _gsEventHandler = {};
    /** @internal 标志，用于在调整大小时保持单元格为正方形 */
    protected _isAutoCellHeight: boolean;
    /** @internal 限制自动单元格调整大小的方法 */
    protected _sizeThrottle: () => void;
    /** @internal 上一次调整大小时的宽度 */
    protected prevWidth: number;
    /** @internal 在网格底部拖动时添加的额外行 */
    protected _extraDragRow = 0;
    /** @internal 如果嵌套网格应从我们的宽度获取列数，则为 true */
    protected _autoColumn?: boolean;
    /** @internal 用于存储活动网格的缩放比例 */
    protected dragTransform: DragTransform = {xScale: 1, yScale: 1, xOffset: 0, yOffset: 0};
    /** @internal 跳过初始调整大小的标志 */
    private _skipInitialResize: boolean;

    /**
     * 从给定的元素和选项构造一个网格项
     * @param el 初始化后与此网格绑定的 HTML 元素
     * @param opts 网格选项 - 供类访问的公共选项，但请使用方法进行修改！
     */
    public constructor(public el: GridHTMLElement, public opts: GridStackOptions = {}) {
      el.gridstack = this;
      this.opts = opts = opts || {}; // 处理 null/undefined/0 的情况

      if (!el.classList.contains('grid-stack')) {
        this.el.classList.add('grid-stack');
      }

      // 如果存在 row 属性，则替换 minRow 和 maxRow
      if (opts.row) {
        opts.minRow = opts.maxRow = opts.row;
        delete opts.row;
      }
      const rowAttr = Utils.toNumber(el.getAttribute('gs-row'));

      // 仅在子网格中有效的标志（由父级处理，而不是在此处）
      if (opts.column === 'auto') {
        delete opts.column;
      }
      // 保存原始设置，以便在保存时可以恢复
      if (opts.alwaysShowResizeHandle !== undefined) {
        (opts as InternalGridStackOptions)._alwaysShowResizeHandle =
          opts.alwaysShowResizeHandle;
      }
      let bk = opts.columnOpts?.breakpoints;
      // 兼容性：v10.x 中 oneColumnMode 的更改 - 检查用户是否显式设置了某些内容以进行转换
      const oldOpts: OldOneColumnOpts = opts;
      if (oldOpts.oneColumnModeDomSort) {
        delete oldOpts.oneColumnModeDomSort;
        console.log(
          '警告: Gridstack oneColumnModeDomSort 不再支持。请使用 GridStackOptions.columnOpts 替代。'
        );
      }
      if (oldOpts.oneColumnSize || oldOpts.disableOneColumnMode === false) {
        const oneSize = oldOpts.oneColumnSize || 768;
        delete oldOpts.oneColumnSize;
        delete oldOpts.disableOneColumnMode;
        opts.columnOpts = opts.columnOpts || {};
        bk = opts.columnOpts.breakpoints = opts.columnOpts.breakpoints || [];
        let oneColumn = bk.find((b) => b.c === 1);
        if (!oneColumn) {
          oneColumn = {c: 1, w: oneSize};
          bk.push(oneColumn, {c: 12, w: oneSize + 1});
        } else oneColumn.w = oneSize;
      }
      //...结束兼容性处理
      // 清理响应式选项（必须有 columnWidth 或 breakpoints），然后按大小对断点进行排序（以便在调整大小时可以匹配）
      const resp = opts.columnOpts;
      if (resp) {
        if (!resp.columnWidth && !resp.breakpoints?.length) {
          delete opts.columnOpts;
          bk = undefined;
        } else {
          resp.columnMax = resp.columnMax || 12;
        }
      }
      if (bk?.length > 1) bk.sort((a, b) => (b.w || 0) - (a.w || 0));

      // 元素的 DOM 属性覆盖任何传递的选项（如 CSS 样式） - 将两者合并
      const defaults: GridStackOptions = {
        ...Utils.cloneDeep(gridDefaults),
        column: Utils.toNumber(el.getAttribute('gs-column')) || gridDefaults.column,
        minRow: rowAttr
          ? rowAttr
          : Utils.toNumber(el.getAttribute('gs-min-row')) || gridDefaults.minRow,
        maxRow: rowAttr
          ? rowAttr
          : Utils.toNumber(el.getAttribute('gs-max-row')) || gridDefaults.maxRow,
        staticGrid: Utils.toBool(el.getAttribute('gs-static')) || gridDefaults.staticGrid,
        sizeToContent: Utils.toBool(el.getAttribute('gs-size-to-content')) || undefined,
        draggable: {
          handle:
            (opts.handleClass ? '.' + opts.handleClass : opts.handle ? opts.handle : '') ||
            gridDefaults.draggable.handle
        },
        removableOptions: {
          accept: opts.itemClass || gridDefaults.removableOptions.accept,
          decline: gridDefaults.removableOptions.decline
        }
      };
      if (el.getAttribute('gs-animate')) {
        // 默认值为 true，但如果设置为 false 则使用该值
        defaults.animate = Utils.toBool(el.getAttribute('gs-animate'));
      }

      opts = Utils.defaults(opts, defaults);
      this._initMargin(); // 设置默认值的一部分...

      // 现在检查我们是否首先加载到 1 列模式，以便我们不会做不必要的工作（例如 cellHeight = width / 12 然后进入 1 列模式）
      this.checkDynamicColumn();
      this.el.classList.add('gs-' + opts.column);

      if (opts.rtl === 'auto') {
        opts.rtl = el.style.direction === 'rtl';
      }
      if (opts.rtl) {
        this.el.classList.add('grid-stack-rtl');
      }

      // 检查我们是否被嵌套，如果是则更新样式并保留指针（在保存期间使用）
      const parentGridItem: GridItemHTMLElement = this.el.closest('.' + gridDefaults.itemClass);
      const parentNode = parentGridItem?.gridstackNode;
      if (parentNode) {
        parentNode.subGrid = this;
        this.parentGridNode = parentNode;
        this.el.classList.add('grid-stack-nested');
        parentNode.el.classList.add('grid-stack-sub-grid');
      }

      this._isAutoCellHeight = opts.cellHeight === 'auto';
      if (this._isAutoCellHeight || opts.cellHeight === 'initial') {
        // 使单元格内容最初为正方形（将使用调整大小/列事件保持正方形）
        this.cellHeight(undefined, false);
      } else {
        // 如果设置了单位，则附加单位
        if (
          typeof opts.cellHeight == 'number' &&
          opts.cellHeightUnit &&
          opts.cellHeightUnit !== gridDefaults.cellHeightUnit
        ) {
          opts.cellHeight = opts.cellHeight + opts.cellHeightUnit;
          delete opts.cellHeightUnit;
        }
        this.cellHeight(opts.cellHeight, false);
      }

      // 查看我们是否需要调整自动隐藏
      if (opts.alwaysShowResizeHandle === 'mobile') {
        opts.alwaysShowResizeHandle = isTouch;
      }

      this._styleSheetClass = 'gs-id-' + GridStackEngine._idSeq++;
      this.el.classList.add(this._styleSheetClass);

      this._setStaticClass();

      const engineClass = opts.engineClass || GridStack.engineClass || GridStackEngine;
      this.engine = new engineClass({
        column: this.getColumn(),
        float: opts.float,
        maxRow: opts.maxRow,
        onChange: (cbNodes) => {
          cbNodes.forEach((n) => {
            const el = n.el;
            if (!el) return;
            if (n._removeDOM) {
              if (el) el.remove();
              delete n._removeDOM;
            } else {
              this._writePosAttr(el, n);
            }
          });
          this._updateStyles();
        }
      });

      // 在加载子项之前创建初始全局样式，以便可以正确计算 resizeToContent 的边距
      this._updateStyles();

      if (opts.auto) {
        this.batchUpdate(); // 防止中间重新布局 #1535 TODO: 这仅设置 float=true，需要防止冲突检查...
        this.engine._loading = true; // 加载冲突检查
        this.getGridItems().forEach((el) => this._prepareElement(el));
        delete this.engine._loading;
        this.batchUpdate(false);
      }

      // 加载任何传递的子项，这会覆盖上面完成的任何 DOM 布局
      if (opts.children) {
        const children = opts.children;
        delete opts.children;
        if (children.length) this.load(children); // 不加载空内容
      }

      // 如果 (this.engine.nodes.length) this._updateStyles(); // 根据子项数量更新。已在 engine onChange 回调中完成
      this.setAnimation();

      // 动态网格在拖动期间需要暂停以检测嵌套与推送
      if (opts.subGridDynamic && !DDManager.pauseDrag) DDManager.pauseDrag = true;
      if (opts.draggable?.pause !== undefined) DDManager.pauseDrag = opts.draggable.pause;

      this._setupRemoveDrop();
      this._setupAcceptWidget();
      this._updateResizeEvent();
    }

    /**
     * 添加一个新的小部件并返回它。
     *
     * 小部件将始终被放置，即使结果高度超过实际网格高度。
     * 在调用 addWidget 之前，您需要使用 `willItFit()` 进行额外检查。
     * 另请参见 `makeWidget(el)` 用于 DOM 元素。
     *
     * @example
     * const grid = GridStack.init();
     * grid.addWidget({w: 3, content: 'hello'});
     *
     * @param w GridStackWidget 定义。如果您有 DOM 元素，请使用 MakeWidget(el)。
     */
    public addWidget(w: GridStackWidget): GridItemHTMLElement {
      if (typeof w === 'string') {
        console.error('V11: GridStack.addWidget() 不再支持字符串。参见 #2736');
        return;
      }
      if ((w as HTMLElement).ELEMENT_NODE) {
        console.error(
          'V11: GridStack.addWidget() 不再支持 HTMLElement。请使用 makeWidget()'
        );
        return this.makeWidget(w as HTMLElement);
      }

      let el: GridItemHTMLElement;
      let node: GridStackNode = w;
      node.grid = this;
      if (node?.el) {
        el = node.el; // 重新使用存储在节点中的元素
      } else if (GridStack.addRemoveCB) {
        el = GridStack.addRemoveCB(this.el, w, true, false);
      } else {
        el = this.createWidgetDivs(node);
      }

      if (!el) return;

      // 如果调用者在 addRemoveCB 中初始化了小部件，或者我们已经有一个，跳过其余部分
      node = el.gridstackNode;
      if (
        node &&
        el.parentElement === this.el &&
        this.engine.nodes.find((n) => n._id === node._id)
      )
        return el;

      // 初始化传入的选项，加载任何未指定的 DOM 属性（这些属性会覆盖传入的选项）
      const domAttr = this._readAttr(el);
      Utils.defaults(w, domAttr);
      this.engine.prepareNode(w);

      this.el.appendChild(el);

      this.makeWidget(el, w);

      return el;
    }

    /** 创建默认的网格项 div 和内容（可能是延迟加载），通过使用 GridStack.renderCB() */
    public createWidgetDivs(n: GridStackNode): HTMLElement {
      const el = Utils.createDiv(['grid-stack-item', this.opts.itemClass]);
      const cont = Utils.createDiv(['grid-stack-item-content'], el);

      if (Utils.lazyLoad(n)) {
        if (!n.visibleObservable) {
          n.visibleObservable = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
              n.visibleObservable?.disconnect();
              delete n.visibleObservable;
              GridStack.renderCB(cont, n);
              n.grid?.prepareDragDrop(n.el);
            }
          });
          window.setTimeout(() => n.visibleObservable?.observe(el)); // 等待调用者设置位置属性
        }
      } else GridStack.renderCB(cont, n);

      return el;
    }

    /**
     * 将现有的 gridItem 元素转换为子网格，并使用给定的（可选）选项，否则从父级的 subGrid 选项继承。
     * @param el 要转换的 gridItem 元素
     * @param ops （可选）子网格选项，否则默认为节点，然后是父级设置，否则为默认值
     * @param nodeToAdd （可选）要添加到新创建的子网格中的节点（用于拖动到现有常规项上）
     * @param saveContent 如果为 true（默认值），则 html 内部 .grid-stack-content 将保存到子小部件
     * @returns 新创建的网格
     */
    public makeSubGrid(
      el: GridItemHTMLElement,
      ops?: GridStackOptions,
      nodeToAdd?: GridStackNode,
      saveContent = true
    ): GridStack {
      let node = el.gridstackNode;
      if (!node) {
        node = this.makeWidget(el).gridstackNode;
      }
      if (node.subGrid?.el) return node.subGrid; // 已经完成

      // 查找存储在父级上的模板子网格作为回退...
      let subGridTemplate: GridStackOptions; // eslint-disable-next-line @typescript-eslint/no-this-alias
      let grid: GridStack = this;
      while (grid && !subGridTemplate) {
        subGridTemplate = grid.opts?.subGridOpts;
        grid = grid.parentGridNode?.grid;
      }
      //... 并设置创建选项
      ops = Utils.cloneDeep({
        // 默认情况下，子网格继承自我们 | 父级，除了 id、children 等...
        ...this.opts,
        id: undefined,
        children: undefined,
        column: 'auto',
        columnOpts: undefined,
        layout: 'list',
        subGridOpts: undefined,
        ...(subGridTemplate || {}),
        ...(ops || node.subGridOpts || {})
      });
      node.subGridOpts = ops;

      // 如果列设置为特殊情况，记住该标志并设置默认值
      let autoColumn: boolean;
      if (ops.column === 'auto') {
        autoColumn = true;
        ops.column = Math.max(node.w || 1, nodeToAdd?.w || 1);
        delete ops.columnOpts; // 由父级驱动
      }

      // 如果我们正在转换现有的完整项目，请将内容移到新网格中的第一个子项
      let content = node.el.querySelector('.grid-stack-item-content') as HTMLElement;
      let newItem: HTMLElement;
      let newItemOpt: GridStackNode;
      if (saveContent) {
        this._removeDD(node.el); // 删除 D&D，因为它设置在内容 div 上
        newItemOpt = {...node, x: 0, y: 0};
        Utils.removeInternalForSave(newItemOpt);
        delete newItemOpt.subGridOpts;
        if (node.content) {
          newItemOpt.content = node.content;
          delete node.content;
        }
        if (GridStack.addRemoveCB) {
          newItem = GridStack.addRemoveCB(this.el, newItemOpt, true, false);
        } else {
          newItem = Utils.createDiv(['grid-stack-item']);
          newItem.appendChild(content);
          content = Utils.createDiv(['grid-stack-item-content'], node.el);
        }
        this.prepareDragDrop(node.el); // ... 并恢复原始 D&D
      }

      // 如果我们正在添加一个额外的项目，请使容器足够大以容纳它们
      if (nodeToAdd) {
        const w = autoColumn ? ops.column : node.w;
        const h = node.h + nodeToAdd.h;
        const style = node.el.style;
        style.transition = 'none'; // 立即显示，以便我们不会看到带有 nodeToAdd 的滚动条
        this.update(node.el, {w, h});
        setTimeout(() => (style.transition = null)); // 恢复动画
      }

      const subGrid = (node.subGrid = GridStack.addGrid(content, ops));
      if (nodeToAdd?._moving) subGrid._isTemp = true; // 防止重新嵌套，因为我们添加了
      if (autoColumn) subGrid._autoColumn = true;

      // 将原始内容作为新创建网格的子项添加回去
      if (saveContent) {
        subGrid.makeWidget(newItem, newItemOpt);
      }

      // 现在添加任何额外的节点
      if (nodeToAdd) {
        if (nodeToAdd._moving) {
          // 即使对于刚创建的网格，也创建一个人工事件以接收此项目
          window.setTimeout(
            () => Utils.simulateMouseEvent(nodeToAdd._event, 'mouseenter', subGrid.el),
            0
          );
        } else {
          subGrid.makeWidget(node.el, node);
        }
      }

      // 如果 sizedToContent，我们需要重新计算自己的大小
      this.resizeToContentCheck(false, node);

      return subGrid;
    }

    /**
     * 当一个项目被转换为嵌套网格以容纳拖入的项目，但随后项目离开时调用 - 返回到原始的 grid-item。
     * 也在最后一个项目被拖出时移除空的子网格（因为重新创建很简单）。
     */
    public removeAsSubGrid(nodeThatRemoved?: GridStackNode): void {
      const pGrid = this.parentGridNode?.grid; // 获取父网格
      if (!pGrid) return;

      pGrid.batchUpdate(); // 开始批量更新父网格
      pGrid.removeWidget(this.parentGridNode.el, true, true); // 从父网格中移除当前子网格
      this.engine.nodes.forEach((n) => {
        // 将子网格中的所有子项迁移到父网格，并调整位置偏移
        n.x += this.parentGridNode.x;
        n.y += this.parentGridNode.y;
        pGrid.makeWidget(n.el, n); // 在父网格中创建这些子项
      });
      pGrid.batchUpdate(false); // 结束批量更新
      if (this.parentGridNode) delete this.parentGridNode.subGrid; // 删除子网格引用
      delete this.parentGridNode;

      // 为原始网格创建一个人工事件，因为当前网格已被移除（触发离开事件，但不会触发进入事件）
      if (nodeThatRemoved) {
        window.setTimeout(
          () => Utils.simulateMouseEvent(nodeThatRemoved._event, 'mouseenter', pGrid.el),
          0
        );
      }
    }

    /**
     * 保存当前布局，返回用于序列化的小部件列表，可能包括任何嵌套网格。
     * @param saveContent 如果为 true（默认值），将保存 .grid-stack-content 内的最新 HTML 到 GridStackWidget.content 字段，否则将被移除。
     * @param saveGridOpt 如果为 true（默认值为 false），保存网格选项本身，这样可以通过调用新的 GridStack.addGrid() 从头重新创建所有内容。
     * GridStackOptions.children 将包含小部件列表。
     * @param saveCB 每个节点 -> 小部件的回调，因此应用程序可以插入额外的数据以保存到小部件数据结构中。
     * @returns 小部件列表或完整的网格选项，包括 .children 小部件列表
     */
    public save(
      saveContent = true,
      saveGridOpt = false,
      saveCB = GridStack.saveCB
    ): GridStackWidget[] | GridStackOptions {
      // 返回可以随意修改的 GridStackWidget 副本（可选带 .el）
      const list = this.engine.save(saveContent, saveCB);

      // 检查 HTML 内容和嵌套网格
      list.forEach((n) => {
        if (saveContent && n.el && !n.subGrid && !saveCB) {
          // 子网格以不同方式保存，而不是普通内容
          const itemContent = n.el.querySelector('.grid-stack-item-content');
          n.content = itemContent?.innerHTML;
          if (!n.content) delete n.content;
        } else {
          if (!saveContent && !saveCB) {
            delete n.content;
          }
          // 检查嵌套网格
          if (n.subGrid?.el) {
            const listOrOpt = n.subGrid.save(saveContent, saveGridOpt, saveCB);
            n.subGridOpts = (
              saveGridOpt ? listOrOpt : {children: listOrOpt}
            ) as GridStackOptions;
            delete n.subGrid;
          }
        }
        delete n.el; // 删除 DOM 元素引用
      });

      // 检查是否保存整个网格选项（递归所需）+ 子项
      if (saveGridOpt) {
        const o: InternalGridStackOptions = Utils.cloneDeep(this.opts);
        // 删除将在启动时重新创建的默认值
        if (
          o.marginBottom === o.marginTop &&
          o.marginRight === o.marginLeft &&
          o.marginTop === o.marginRight
        ) {
          o.margin = o.marginTop;
          delete o.marginTop;
          delete o.marginRight;
          delete o.marginBottom;
          delete o.marginLeft;
        }
        if (o.rtl === (this.el.style.direction === 'rtl')) {
          o.rtl = 'auto';
        }
        if (this._isAutoCellHeight) {
          o.cellHeight = 'auto';
        }
        if (this._autoColumn) {
          o.column = 'auto';
        }
        const origShow = o._alwaysShowResizeHandle;
        delete o._alwaysShowResizeHandle;
        if (origShow !== undefined) {
          o.alwaysShowResizeHandle = origShow;
        } else {
          delete o.alwaysShowResizeHandle;
        }
        Utils.removeInternalAndSame(o, gridDefaults);
        o.children = list;
        return o;
      }

      return list;
    }

    /**
     * 从一个小部件列表加载网格布局。这将调用 update() 更新现有小部件（通过 id 匹配），
     * 或者添加/移除不在列表中的小部件。
     *
     * @param items 小部件定义列表，用于更新或创建小部件。
     * @param addRemove 布尔值（默认 true）或回调方法，用于控制是否以及如何添加/移除缺失的小部件，
     *                  让用户可以控制插入逻辑。
     *
     * @example
     * 参见 http://gridstackjs.com/demo/serialization.html
     */
    public load(
      items: GridStackWidget[],
      addRemove: boolean | AddRemoveFcn = GridStack.addRemoveCB || true
    ): GridStack {
      items = Utils.cloneDeep(items); // 深拷贝以便修改
      const column = this.getColumn();

      // 确保每个小部件都有默认的大小（1x1）
      items.forEach((n) => {
        n.w = n.w || 1;
        n.h = n.h || 1;
      });

      // 对小部件进行排序，没有坐标的将排在最后
      items = Utils.sort(items);

      this.engine.skipCacheUpdate = this._ignoreLayoutsNodeChange = true; // 跳过布局更新

      // 如果加载的布局列数大于当前列数，缓存原始布局以便以后恢复
      let maxColumn = 0;
      items.forEach((n) => {
        maxColumn = Math.max(maxColumn, (n.x || 0) + n.w);
      });
      if (maxColumn > this.engine.defaultColumn) this.engine.defaultColumn = maxColumn;
      if (maxColumn > column) this.engine.cacheLayout(items, maxColumn, true);

      // 如果提供了不同的回调，临时设置为全局选项以便创建时使用
      const prevCB = GridStack.addRemoveCB;
      if (typeof addRemove === 'function') GridStack.addRemoveCB = addRemove as AddRemoveFcn;

      const removed: GridStackNode[] = [];
      this.batchUpdate();

      // 如果从空网格加载布局，临时禁用动画
      const blank = !this.engine.nodes.length;
      if (blank) this.setAnimation(false);

      // 检查是否有需要从当前网格中移除的小部件
      if (!blank && addRemove) {
        const copyNodes = [...this.engine.nodes]; // 避免修改时循环数组
        copyNodes.forEach((n) => {
          if (!n.id) return;
          const item = Utils.find(items, n.id);
          if (!item) {
            if (GridStack.addRemoveCB) GridStack.addRemoveCB(this.el, n, false, false);
            removed.push(n); // 批量跟踪移除的小部件
            this.removeWidget(n.el, true, false);
          }
        });
      }

      // 添加/更新小部件
      this.engine._loading = true; // 帮助处理冲突
      const updateNodes: GridStackWidget[] = [];
      this.engine.nodes = this.engine.nodes.filter((n) => {
        if (Utils.find(items, n.id)) {
          updateNodes.push(n);
          return false;
        } // 如果找到则从列表中移除
        return true;
      });
      items.forEach((w) => {
        const item = Utils.find(updateNodes, w.id);
        if (item) {
          // 如果小部件需要根据内容调整大小，重用现有高度以更好地估计最终大小
          if (Utils.shouldSizeToContent(item)) w.h = item.h;
          // 检查是否缺少坐标，如果是则找到下一个空位
          this.engine.nodeBoundFix(w);
          if (w.autoPosition || w.x === undefined || w.y === undefined) {
            w.w = w.w || item.w;
            w.h = w.h || item.h;
            this.engine.findEmptyPosition(w);
          }

          // 添加回当前列表，但强制检查冲突
          this.engine.nodes.push(item);
          if (Utils.samePos(item, w) && this.engine.nodes.length > 1) {
            this.moveNode(item, {...w, forceCollide: true});
            Utils.copyPos(w, item); // 使用可能更新的值
          }

          this.update(item.el, w);

          if (w.subGridOpts?.children) {
            // 更新子网格
            const sub = item.el.querySelector('.grid-stack') as GridHTMLElement;
            if (sub && sub.gridstack) {
              sub.gridstack.load(w.subGridOpts.children); // TODO: 支持更新网格选项？
            }
          }
        } else if (addRemove) {
          this.addWidget(w);
        }
      });

      delete this.engine._loading; // 加载完成
      this.engine.removedNodes = removed;
      this.batchUpdate(false);

      // 提交后清除标志
      delete this._ignoreLayoutsNodeChange;
      delete this.engine.skipCacheUpdate;
      prevCB ? (GridStack.addRemoveCB = prevCB) : delete GridStack.addRemoveCB;
      // 延迟恢复动画
      if (blank && this.opts?.animate) this.setAnimation(this.opts.animate, true);
      return this;
    }

    /**
     * 在调用多个 `addWidget()` 之前使用，以防止中间不必要的重新布局（更高效），
     * 并获得单一事件回调。在调用 `batchUpdate(false)` 之前不会看到任何更改。
     */
    public batchUpdate(flag = true): GridStack {
      this.engine.batchUpdate(flag);
      if (!flag) {
        this._updateContainerHeight();
        this._triggerRemoveEvent();
        this._triggerAddEvent();
        this._triggerChangeEvent();
      }
      return this;
    }

    /**
     * 获取当前单元格高度。
     */
    public getCellHeight(forcePixel = false): number {
      if (
        this.opts.cellHeight &&
        this.opts.cellHeight !== 'auto' &&
        (!forcePixel || !this.opts.cellHeightUnit || this.opts.cellHeightUnit === 'px')
      ) {
        return this.opts.cellHeight as number;
      }
      // rem/em/cm/mm 转换为 px
      if (this.opts.cellHeightUnit === 'rem') {
        return (
          (this.opts.cellHeight as number) *
          parseFloat(getComputedStyle(document.documentElement).fontSize)
        );
      }
      if (this.opts.cellHeightUnit === 'em') {
        return (
          (this.opts.cellHeight as number) * parseFloat(getComputedStyle(this.el).fontSize)
        );
      }
      if (this.opts.cellHeightUnit === 'cm') {
        // 1cm = 96px/2.54. 参见 https://www.w3.org/TR/css-values-3/#absolute-lengths
        return (this.opts.cellHeight as number) * (96 / 2.54);
      }
      if (this.opts.cellHeightUnit === 'mm') {
        return ((this.opts.cellHeight as number) * (96 / 2.54)) / 10;
      }
      // 否则获取第一个单元格高度
      const el = this.el.querySelector('.' + this.opts.itemClass) as HTMLElement;
      if (el) {
        const h = Utils.toNumber(el.getAttribute('gs-h')) || 1; // 默认值为 1
        return Math.round(el.offsetHeight / h);
      }
      // 否则计算整个网格高度和行数（但如果 min-height 是实际约束则无效）
      const rows = parseInt(this.el.getAttribute('gs-current-row'));
      return rows
        ? Math.round(this.el.getBoundingClientRect().height / rows)
        : (this.opts.cellHeight as number);
    }

    /**
     * 更新当前单元格高度 - 请参阅 `GridStackOptions.cellHeight` 的格式。
     * 此方法会重建内部 CSS 样式表。
     * 注意：如果频繁调用此方法，可能会导致性能问题。
     *
     * @param val 单元格高度。如果未传递（undefined），单元格内容将变为正方形（匹配宽度减去边距），
     * 如果传递 0，则 CSS 将由应用程序生成。
     * @param update （可选）如果为 false，则不会更新样式。
     *
     * @example
     * grid.cellHeight(100); // 等同于 100px
     * grid.cellHeight('70px');
     * grid.cellHeight(grid.cellWidth() * 1.2);
     */
    public cellHeight(val?: numberOrString, update = true): GridStack {
      // 如果不是内部调用，检查是否更改了模式
      if (update && val !== undefined) {
        if (this._isAutoCellHeight !== (val === 'auto')) {
          this._isAutoCellHeight = val === 'auto';
          this._updateResizeEvent();
        }
      }
      if (val === 'initial' || val === 'auto') {
        val = undefined;
      }

      // 使项目内容为正方形
      if (val === undefined) {
        const marginDiff =
          -(this.opts.marginRight as number) -
          (this.opts.marginLeft as number) +
          (this.opts.marginTop as number) +
          (this.opts.marginBottom as number);
        val = this.cellWidth() + marginDiff;
      }

      const data = Utils.parseHeight(val);
      if (this.opts.cellHeightUnit === data.unit && this.opts.cellHeight === data.h) {
        return this;
      }
      this.opts.cellHeightUnit = data.unit;
      this.opts.cellHeight = data.h;

      this.resizeToContentCheck();

      if (update) {
        this._updateStyles();
      }
      return this;
    }

    /** 获取当前单元格宽度。 */
    public cellWidth(): number {
      return this._widthOrContainer() / this.getColumn();
    }
    /** 返回当前宽度（或父容器宽度），可选返回窗口宽度以进行动态列检查 */
    protected _widthOrContainer(forBreakpoint = false): number {
      // 使用 `offsetWidth` 或 `clientWidth`（无滚动条）？
      // https://stackoverflow.com/questions/21064101/understanding-offsetwidth-clientwidth-scrollwidth-and-height-respectively
      return forBreakpoint && this.opts.columnOpts?.breakpointForWindow
        ? window.innerWidth
        : this.el.clientWidth || this.el.parentElement.clientWidth || window.innerWidth;
    }
    /** 检查当前尺寸是否需要动态列数，返回 true 如果发生了变化 */
    protected checkDynamicColumn(): boolean {
      const resp = this.opts.columnOpts;
      if (!resp || (!resp.columnWidth && !resp.breakpoints?.length)) return false;
      const column = this.getColumn();
      let newColumn = column;
      const w = this._widthOrContainer(true);
      if (resp.columnWidth) {
        newColumn = Math.min(Math.round(w / resp.columnWidth) || 1, resp.columnMax);
      } else {
        // 找到匹配的最近断点（已按从大到小排序）
        newColumn = resp.columnMax;
        let i = 0;
        while (i < resp.breakpoints.length && w <= resp.breakpoints[i].w) {
          newColumn = resp.breakpoints[i++].c || column;
        }
      }
      if (newColumn !== column) {
        const bk = resp.breakpoints?.find((b) => b.c === newColumn);
        this.column(newColumn, bk?.layout || resp.layout);
        return true;
      }
      return false;
    }

    /**
     * 重新布局网格项以回收任何空白空间。选项包括：
     * 'list' 保持小部件从左到右的顺序，即使这意味着如果不适合会留下空槽。
     * 'compact' 可能会重新排序项目以填充任何空白空间。
     *
     * doSort - 'false' 表示您可以在此之前自行排序以控制不同的顺序。（默认为排序）
     */
    public compact(layout: CompactOptions = 'compact', doSort = true): GridStack {
      this.engine.compact(layout, doSort);
      this._triggerChangeEvent();
      return this;
    }

    /**
     * 设置网格中的列数。将更新现有小部件以符合新的列数，
     * 并缓存原始布局，以便您可以恢复到以前的位置而不会丢失。
     * 需要 `gridstack-extra.css` 或 `gridstack-extra.min.css` 用于 [2-11]，
     * 否则您需要生成正确的 CSS（参见 https://github.com/gridstack/gridstack.js#change-grid-columns）
     * @param column - 整数 > 0（默认 12）。
     * @param layout 指定将发生的重新布局类型（位置、大小等）。
     * 注意：项目永远不会超出当前列边界。默认值为 'moveScale'。对于 1 列忽略。
     */
    public column(column: number, layout: ColumnOptions = 'moveScale'): GridStack {
      if (!column || column < 1 || this.opts.column === column) return this;

      const oldColumn = this.getColumn();
      this.opts.column = column;
      if (!this.engine) return this; // 在构造函数中调用，无需执行其他操作

      this.engine.column = column;
      this.el.classList.remove('gs-' + oldColumn);
      this.el.classList.add('gs-' + column);

      // 现在更新项目，检查是否有自定义子布局
      /*const newChildren = this.opts.columnOpts?.breakpoints?.find(r => r.c === column)?.children;
    if (newChildren) this.load(newChildren);
    else*/ this.engine.columnChanged(oldColumn, column, layout);
      if (this._isAutoCellHeight) this.cellHeight();

      this.resizeToContentCheck(true); // 等待宽度调整

      // 最后触发我们的事件...
      this._ignoreLayoutsNodeChange = true; // 跳过布局更新
      this._triggerChangeEvent();
      delete this._ignoreLayoutsNodeChange;

      return this;
    }

    /**
     * 获取网格中的列数（默认值为 12）
     */
    public getColumn(): number {
      return this.opts.column as number;
    }

    /**
     * 返回一个包含网格 HTML 元素的数组（不包括占位符） - 用于按 DOM 顺序遍历子元素
     */
    public getGridItems(): GridItemHTMLElement[] {
      return Array.from(this.el.children).filter(
        (el: HTMLElement) =>
          el.matches('.' + this.opts.itemClass) &&
          !el.matches('.' + this.opts.placeholderClass)
      ) as GridItemHTMLElement[];
    }

    /**
     * 如果由于列更改、sizeToContent、加载等原因需要忽略 changeCB，则返回 true，调用者可以忽略脏标志的情况
     */
    public isIgnoreChangeCB(): boolean {
      return this._ignoreLayoutsNodeChange;
    }

    /**
     * 销毁网格实例。销毁后请勿调用任何方法或访问任何变量，因为它将释放成员。
     * @param removeDOM 如果为 `false`，网格和项目的 HTML 元素将不会从 DOM 中移除（可选，默认值为 `true`）。
     */
    public destroy(removeDOM = true): GridStack {
      if (!this.el) return; // 防止多次调用
      this.offAll();
      this._updateResizeEvent(true);
      this.setStatic(true, false); // 永久移除 DD，但不设置 CSS 类（因为我们即将销毁）
      this.setAnimation(false);
      if (!removeDOM) {
        this.removeAll(removeDOM);
        this.el.classList.remove(this._styleSheetClass);
        this.el.removeAttribute('gs-current-row');
      } else {
        this.el.parentNode.removeChild(this.el);
      }
      if (this.parentGridNode) delete this.parentGridNode.subGrid;
      delete this.parentGridNode;
      delete this.opts;
      delete this._placeholder?.gridstackNode;
      delete this._placeholder;
      delete this.engine;
      delete this.el.gridstack; // 移除循环依赖以防止内存泄漏
      delete this.el;
      return this;
    }

    /**
     * 启用/禁用浮动小部件（默认值为 `false`）。参见 [示例](http://gridstackjs.com/demo/float.html)
     */
    public float(val: boolean): GridStack {
      if (this.opts.float !== val) {
        this.opts.float = this.engine.float = val;
        this._triggerChangeEvent();
      }
      return this;
    }

    /**
     * 获取当前的浮动模式
     */
    public getFloat(): boolean {
      return this.engine.float;
    }

    /**
     * 获取屏幕上某个像素下的单元格位置。
     * @param position 像素的绝对坐标位置，包含 `top` 和 `left` 属性的对象
     * @param useDocRelative 如果为 true，值将基于文档位置而不是父元素位置（可选，默认值为 false）。
     * 当网格位于 `position: relative` 元素内时很有用。
     *
     * 返回一个包含 `x` 和 `y` 属性的对象，即网格中的列和行。
     */
    public getCellFromPixel(position: MousePosition, useDocRelative = false): CellPosition {
      const box = this.el.getBoundingClientRect();
      // console.log(`getBoundingClientRect left: ${box.left} top: ${box.top} w: ${box.w} h: ${box.h}`)
      let containerPos: {top: number; left: number};
      if (useDocRelative) {
        containerPos = {top: box.top + document.documentElement.scrollTop, left: box.left};
        // console.log(`getCellFromPixel scrollTop: ${document.documentElement.scrollTop}`)
      } else {
        containerPos = {top: this.el.offsetTop, left: this.el.offsetLeft};
        // console.log(`getCellFromPixel offsetTop: ${containerPos.left} offsetLeft: ${containerPos.top}`)
      }
      const relativeLeft = position.left - containerPos.left;
      const relativeTop = position.top - containerPos.top;

      const columnWidth = box.width / this.getColumn();
      const rowHeight = box.height / parseInt(this.el.getAttribute('gs-current-row'));

      return {x: Math.floor(relativeLeft / columnWidth), y: Math.floor(relativeTop / rowHeight)};
    }

    /** 返回当前的行数，至少为设置的 `minRow` 值 */
    public getRow(): number {
      return Math.max(this.engine.getRow(), this.opts.minRow);
    }

    /**
     * 检查指定的区域是否为空。
     * @param x 区域的 x 坐标。
     * @param y 区域的 y 坐标。
     * @param w 要检查的区域宽度。
     * @param h 要检查的区域高度。
     */
    public isAreaEmpty(x: number, y: number, w: number, h: number): boolean {
      return this.engine.isAreaEmpty(x, y, w, h);
    }

    /**
     * 如果手动向网格中添加了元素（或通过某些框架创建 DOM），
     * 则需要在之后调用此方法将它们转换为小部件。
     * 如果希望由 gridstack 添加元素，请使用 `addWidget()`。
     * 将给定的元素转换为小部件并返回它。
     * @param els 要转换的小部件或单个选择器。
     * @param options 小部件定义，用于替代读取属性或使用默认大小值。
     *
     * @example
     * const grid = GridStack.init();
     * grid.el.innerHtml = '<div id="1" gs-w="3"></div><div id="2"></div>';
     * grid.makeWidget('1');
     * grid.makeWidget('2', {w:2, content: 'hello'});
     */
    public makeWidget(els: GridStackElement, options?: GridStackWidget): GridItemHTMLElement {
      const el = GridStack.getElement(els);
      if (!el) return;
      if (!el.parentElement) this.el.appendChild(el);
      this._prepareElement(el, true, options);
      const node = el.gridstackNode;

      this._updateContainerHeight();

      // 检查是否需要创建子网格
      if (node.subGridOpts) {
        this.makeSubGrid(el, node.subGridOpts, undefined, false); // node.subGrid 将作为选项传递，无需额外传递
      }

      // 如果我们正在向 1 列添加项目，请确保不会覆盖已保存的更大 12 列布局。#1985
      let resetIgnoreLayoutsNodeChange: boolean;
      if (this.opts.column === 1 && !this._ignoreLayoutsNodeChange) {
        resetIgnoreLayoutsNodeChange = this._ignoreLayoutsNodeChange = true;
      }
      this._triggerAddEvent();
      this._triggerChangeEvent();
      if (resetIgnoreLayoutsNodeChange) delete this._ignoreLayoutsNodeChange;

      return el;
    }

    /**
     * 事件处理器，用于自动提取自定义事件数据以接收自定义通知（参见文档支持的事件）。
     * @param name 事件名称（参见可能的值）或以空格分隔的名称列表。
     * @param callback 回调函数，接收事件和可选的第二/第三个参数（参见 README 文档中的每个签名）。
     *
     * @example
     * grid.on('added', function(e, items) { log('added ', items)} );
     * 或
     * grid.on('added removed change', function(e, items) { log(e.type, items)} );
     *
     * 注意：在某些情况下，这与调用原生处理程序并解析事件相同。
     * grid.el.addEventListener('added', function(event) { log('added ', event.detail)} );
     *
     */
    public on(name: 'dropped', callback: GridStackDroppedHandler): GridStack;
    public on(name: 'enable' | 'disable', callback: GridStackEventHandler): GridStack;
    public on(
      name: 'change' | 'added' | 'removed' | 'resizecontent',
      callback: GridStackNodesHandler
    ): GridStack;
    public on(
      name: 'resizestart' | 'resize' | 'resizestop' | 'dragstart' | 'drag' | 'dragstop',
      callback: GridStackElementHandler
    ): GridStack;
    public on(name: string, callback: GridStackEventHandlerCallback): GridStack;
    public on(name: GridStackEvent | string, callback: GridStackEventHandlerCallback): GridStack {
      // 检查是否传递了名称数组
      if (name.indexOf(' ') !== -1) {
        const names = name.split(' ') as GridStackEvent[];
        names.forEach((name) => this.on(name, callback));
        return this;
      }

      // 原生 CustomEvent 处理程序 - 缓存通用处理程序以便轻松移除
      if (
        name === 'change' ||
        name === 'added' ||
        name === 'removed' ||
        name === 'enable' ||
        name === 'disable'
      ) {
        const noData = name === 'enable' || name === 'disable';
        if (noData) {
          this._gsEventHandler[name] = (event: Event) =>
            (callback as GridStackEventHandler)(event);
        } else {
          this._gsEventHandler[name] = (event: CustomEvent) => {
            if (event.detail) (callback as GridStackNodesHandler)(event, event.detail);
          };
        }
        this.el.addEventListener(name, this._gsEventHandler[name]);
      } else if (
        name === 'drag' ||
        name === 'dragstart' ||
        name === 'dragstop' ||
        name === 'resizestart' ||
        name === 'resize' ||
        name === 'resizestop' ||
        name === 'dropped' ||
        name === 'resizecontent'
      ) {
        // 拖拽和调整大小停止事件需要在更新节点属性后调用，因此我们自己处理它们。
        // 同样对开始事件进行处理以简化操作。
        this._gsEventHandler[name] = callback;
      } else {
        console.error('GridStack.on(' + name + ') 事件不支持');
      }
      return this;
    }

    /**
     * 取消订阅 'on' 事件 GridStackEvent。
     * @param name 事件名称（参见可能的值）或以空格分隔的名称列表。
     */
    public off(name: GridStackEvent | string): GridStack {
      // 检查是否传递了名称数组
      if (name.indexOf(' ') !== -1) {
        const names = name.split(' ') as GridStackEvent[];
        names.forEach((name) => this.off(name));
        return this;
      }

      if (
        name === 'change' ||
        name === 'added' ||
        name === 'removed' ||
        name === 'enable' ||
        name === 'disable'
      ) {
        // 移除原生 CustomEvent 处理程序
        if (this._gsEventHandler[name]) {
          this.el.removeEventListener(name, this._gsEventHandler[name]);
        }
      }
      delete this._gsEventHandler[name];

      return this;
    }

    /** 移除所有事件处理程序 */
    public offAll(): GridStack {
      Object.keys(this._gsEventHandler).forEach((key: GridStackEvent) => this.off(key));
      return this;
    }

    /**
     * 从网格中移除小部件。
     * @param els 要移除的小部件或选择器
     * @param removeDOM 如果为 `false`，DOM 元素不会从树中移除（默认值为 `true`）。
     * @param triggerEvent 如果为 `false`（静默模式），元素不会被添加到移除列表中，也不会触发 'removed' 回调（默认值为 `true`）。
     */
    public removeWidget(els: GridStackElement, removeDOM = true, triggerEvent = true): GridStack {
      if (!els) {
        console.error('错误: 调用了 GridStack.removeWidget(undefined)');
        return this;
      }

      GridStack.getElements(els).forEach((el) => {
        if (el.parentElement && el.parentElement !== this.el) return; // 不是我们的子元素！
        let node = el.gridstackNode;
        // 支持 Meteor: https://github.com/gridstack/gridstack.js/pull/272
        if (!node) {
          node = this.engine.nodes.find((n) => el === n.el);
        }
        if (!node) return;

        if (removeDOM && GridStack.addRemoveCB) {
          GridStack.addRemoveCB(this.el, node, false, false);
        }

        // 移除我们的 DOM 数据（循环引用）并永久删除拖放功能
        delete el.gridstackNode;
        this._removeDD(el);

        this.engine.removeNode(node, removeDOM, triggerEvent);

        if (removeDOM && el.parentElement) {
          el.remove(); // 在批量模式下，engine.removeNode 不会回调移除 DOM
        }
      });
      if (triggerEvent) {
        this._triggerRemoveEvent();
        this._triggerChangeEvent();
      }
      return this;
    }

    /**
     * 从网格中移除所有小部件。
     * @param removeDOM 如果为 `false`，DOM 元素不会从树中移除（默认值为 `true`）。
     * @param triggerEvent 如果为 `false`（静默模式），元素不会被添加到移除列表中，也不会触发 'removed' 回调（默认值为 `true`）。
     */
    public removeAll(removeDOM = true, triggerEvent = true): GridStack {
      // 在列表清空之前始终移除我们的 DOM 数据（循环引用）并永久删除拖放功能
      this.engine.nodes.forEach((n) => {
        if (removeDOM && GridStack.addRemoveCB) {
          GridStack.addRemoveCB(this.el, n, false, false);
        }
        delete n.el.gridstackNode;
        if (!this.opts.staticGrid) this._removeDD(n.el);
      });
      this.engine.removeAll(removeDOM, triggerEvent);
      if (triggerEvent) this._triggerRemoveEvent();
      return this;
    }

    /**
     * 切换网格的动画状态。切换 `grid-stack-animate` 类。
     * @param doAnimate 如果为 true，网格将启用动画。
     * @param delay 如果为 true，设置将在下一个事件循环中生效。
     */
    public setAnimation(doAnimate = this.opts.animate, delay?: boolean): GridStack {
      if (delay) {
        // 延迟，但检查以确保网格（选项）仍然存在
        setTimeout(() => {
          if (this.opts) this.setAnimation(doAnimate);
        });
      } else if (doAnimate) {
        this.el.classList.add('grid-stack-animate');
      } else {
        this.el.classList.remove('grid-stack-animate');
      }
      return this;
    }

    /** @internal 检查是否启用了动画 CSS */
    private hasAnimationCSS(): boolean {
      return this.el.classList.contains('grid-stack-animate');
    }

    /**
     * 切换网格的静态状态，这会永久移除/添加拖放支持，与 disable()/enable() 不同，它只是打开/关闭。
     * 同时切换 `grid-stack-static` 类。
     * @param val 如果为 true，网格将变为静态。
     * @param updateClass 如果为 true（默认值），CSS 类将被更新。
     * @param recurse 如果为 true（默认值），子网格也会被更新。
     */
    public setStatic(val: boolean, updateClass = true, recurse = true): GridStack {
      if (!!this.opts.staticGrid === val) return this;
      val ? (this.opts.staticGrid = true) : delete this.opts.staticGrid;
      this._setupRemoveDrop();
      this._setupAcceptWidget();
      this.engine.nodes.forEach((n) => {
        this.prepareDragDrop(n.el); // 删除或初始化拖放功能
        if (n.subGrid && recurse) n.subGrid.setStatic(val, updateClass, recurse);
      });
      if (updateClass) {
        this._setStaticClass();
      }
      return this;
    }

    /**
     * 更新网格中的选项（类似于 update(widget) 用于网格选项）。
     * @param options 要更新的部分网格选项 - 仅指定的项目将被更新。
     * 注意：目前并非所有选项更新都支持（代码较多，不太可能更改）。
     */
    public updateOptions(o: GridStackOptions): GridStack {
      const opts = this.opts;
      if (o.acceptWidgets !== undefined) this._setupAcceptWidget();
      if (o.animate !== undefined) this.setAnimation();
      if (o.cellHeight) {
        this.cellHeight(o.cellHeight, true);
        delete o.cellHeight;
      }
      if (o.class && o.class !== opts.class) {
        if (opts.class) this.el.classList.remove(opts.class);
        this.el.classList.add(o.class);
      }
      if (typeof o.column === 'number' && !o.columnOpts) {
        this.column(o.column);
        delete o.column;
      } // 响应式列覆盖实际计数
      if (o.margin !== undefined) this.margin(o.margin);
      if (o.staticGrid !== undefined) this.setStatic(o.staticGrid);
      if (o.disableDrag !== undefined && !o.staticGrid) this.enableMove(!o.disableDrag);
      if (o.disableResize !== undefined && !o.staticGrid) this.enableResize(!o.disableResize);
      if (o.float !== undefined) this.float(o.float);
      if (o.row !== undefined) {
        opts.minRow = opts.maxRow = o.row;
      }
      if (o.children?.length) {
        this.load(o.children);
        delete o.children;
      }
      // TBD 如果我们真的需要这些（更复杂的代码）
      // alwaysShowResizeHandle, draggable, handle, handleClass, itemClass, layout, placeholderClass, placeholderText, resizable, removable, row,...
      // 其余的只是被复制...
      this.opts = {...this.opts, ...o};
      return this;
    }

    /**
     * 更新小部件的位置/大小和其他信息。注意：如果需要对所有节点调用此方法，请改用 load()，它将更新更改的内容。
     * @param els 要修改的小部件或对象选择器（注意：为多个项目设置相同的 x,y 将是不确定的，可能是意外的）。
     * @param opt 新的小部件选项（x,y,w,h 等）。仅设置的内容将被更新。
     */
    public update(els: GridStackElement, opt: GridStackWidget): GridStack {
      GridStack.getElements(els).forEach((el) => {
        const n = el?.gridstackNode;
        if (!n) return;
        const w = {...Utils.copyPos({}, n), ...Utils.cloneDeep(opt)}; // 创建一个副本以便修改，以防止重复使用或多个项目
        this.engine.nodeBoundFix(w);
        delete w.autoPosition;

        // 如果有任何更改，移动/调整小部件大小
        const keys = ['x', 'y', 'w', 'h'];
        let m: GridStackWidget;
        if (keys.some((k) => w[k] !== undefined && w[k] !== n[k])) {
          m = {};
          keys.forEach((k) => {
            m[k] = w[k] !== undefined ? w[k] : n[k];
            delete w[k];
          });
        }
        // 如果有任何 min/max 字段设置，也进行移动
        if (!m && (w.minW || w.minH || w.maxW || w.maxH)) {
          m = {}; // 将使用节点位置但验证值
        }

        // 检查内容是否更改
        if (w.content !== undefined) {
          const itemContent = el.querySelector('.grid-stack-item-content') as HTMLElement;
          if (itemContent && itemContent.textContent !== w.content) {
            n.content = w.content;
            GridStack.renderCB(itemContent, w);
            // 恢复任何子网格
            if (n.subGrid?.el) {
              itemContent.appendChild(n.subGrid.el);
              n.subGrid._updateStyles();
            }
          }
          delete w.content;
        }

        // 任何剩余字段都被分配，但检查拖动更改、调整大小约束
        let changed = false;
        let ddChanged = false;
        for (const key in w) {
          if (key[0] !== '_' && n[key] !== w[key]) {
            n[key] = w[key];
            changed = true;
            ddChanged =
              ddChanged ||
              (!this.opts.staticGrid &&
                (key === 'noResize' || key === 'noMove' || key === 'locked'));
          }
        }
        Utils.sanitizeMinMax(n);

        // 最后移动小部件并更新属性
        if (m) {
          const widthChanged = m.w !== undefined && m.w !== n.w;
          this.moveNode(n, m);
          if (widthChanged && n.subGrid) {
            // 如果我们正在动画，客户端大小尚未更改，因此强制更改（不精确大小）
            n.subGrid.onResize(this.hasAnimationCSS() ? n.w : undefined);
          } else {
            this.resizeToContentCheck(widthChanged, n);
          }
          delete n._orig; // 清除原始位置，因为我们已经移动了 #2669
        }
        if (m || changed) {
          this._writeAttr(el, n);
        }
        if (ddChanged) {
          this.prepareDragDrop(n.el);
        }
      });

      return this;
    }

    /**
     * 移动节点到指定位置
     * @param n 要移动的节点
     * @param m 移动选项
     */
    private moveNode(n: GridStackNode, m: GridStackMoveOpts) {
      const wasUpdating = n._updating;
      if (!wasUpdating) this.engine.cleanNodes().beginUpdate(n); // 开始更新节点
      this.engine.moveNode(n, m); // 调用引擎移动节点
      this._updateContainerHeight(); // 更新容器高度
      if (!wasUpdating) {
        this._triggerChangeEvent(); // 触发更改事件
        this.engine.endUpdate(); // 结束更新
      }
    }

    /**
     * 更新小部件高度以匹配内容高度，避免出现垂直滚动条或空白空间。
     * 注意：假设 resizeToContentParent='.grid-stack-item-content' 下只有一个子元素（大小与网格项减去填充一致），
     * 并且该子元素的大小为所需的内容大小。
     * @param el 网格项元素
     */
    public resizeToContent(el: GridItemHTMLElement) {
      if (!el) return;
      el.classList.remove('size-to-content-max'); // 移除最大内容大小的类
      if (!el.clientHeight) return; // 如果隐藏则跳过
      const n = el.gridstackNode;
      if (!n) return;
      const grid = n.grid;
      if (!grid || el.parentElement !== grid.el) return; // 如果不在网格中则跳过
      const cell = grid.getCellHeight(true); // 获取单元格高度
      if (!cell) return;
      let height = n.h ? n.h * cell : el.clientHeight; // 获取高度
      let item: Element;
      if (n.resizeToContentParent) item = el.querySelector(n.resizeToContentParent);
      if (!item) item = el.querySelector(GridStack.resizeToContentParent);
      if (!item) return;
      const padding = el.clientHeight - item.clientHeight; // 计算填充
      const itemH = n.h ? n.h * cell - padding : item.clientHeight; // 计算内容高度
      let wantedH: number;
      if (n.subGrid) {
        // 子网格 - 使用行数 * 单元格高度，并添加网格外的内容高度
        wantedH = n.subGrid.getRow() * n.subGrid.getCellHeight(true);
        const subRec = n.subGrid.el.getBoundingClientRect();
        const parentRec = n.subGrid.el.parentElement.getBoundingClientRect();
        wantedH += subRec.top - parentRec.top;
      } else if (n.subGridOpts?.children?.length) {
        return; // 如果尚未成为子网格，则跳过
      } else {
        const child = item.firstElementChild;
        if (!child) {
          console.error(
            `错误: GridStack.resizeToContent() 小部件 id:${n.id} '${GridStack.resizeToContentParent}'.firstElementChild 为空，请确保有一个 div 容器。跳过调整大小。`
          );
          return;
        }
        wantedH = child.getBoundingClientRect().height || itemH;
      }
      if (itemH === wantedH) return;
      height += wantedH - itemH;
      let h = Math.ceil(height / cell);
      // 检查最小/最大值和特殊大小限制
      const softMax = Number.isInteger(n.sizeToContent) ? (n.sizeToContent as number) : 0;
      if (softMax && h > softMax) {
        h = softMax;
        el.classList.add('size-to-content-max'); // 添加垂直滚动条
      }
      if (n.minH && h < n.minH) h = n.minH;
      else if (n.maxH && h > n.maxH) h = n.maxH;
      if (h !== n.h) {
        grid._ignoreLayoutsNodeChange = true;
        grid.moveNode(n, {h}); // 移动节点到新高度
        delete grid._ignoreLayoutsNodeChange;
      }
    }

    /**
     * 调用用户定义的 resize 回调函数（如果存在），否则调用内置版本。
     * @param el 网格项元素
     */
    private resizeToContentCBCheck(el: GridItemHTMLElement) {
      if (GridStack.resizeToContentCB) GridStack.resizeToContentCB(el);
      else this.resizeToContent(el);
    }

    /**
     * 旋转传入的节点（通过交换宽度和高度） - 用户在拖动时按下 'r' 键时调用。
     * @param els 要修改的小部件或选择器
     * @param relative 可选的相对于左上角的像素坐标，用于旋转时保持该单元格在光标下
     */
    public rotate(els: GridStackElement, relative?: Position): GridStack {
      GridStack.getElements(els).forEach((el) => {
        const n = el.gridstackNode;
        if (!Utils.canBeRotated(n)) return;
        const rot: GridStackWidget = {
          w: n.h,
          h: n.w,
          minH: n.minW,
          minW: n.minH,
          maxH: n.maxW,
          maxW: n.maxH
        };
        if (relative) {
          const pivotX = relative.left > 0 ? Math.floor(relative.left / this.cellWidth()) : 0;
          const pivotY =
            relative.top > 0
              ? Math.floor(relative.top / (this.opts.cellHeight as number))
              : 0;
          rot.x = n.x + pivotX - (n.h - (pivotY + 1));
          rot.y = n.y + pivotY - pivotX;
        }
        Object.keys(rot).forEach((k) => {
          if (rot[k] === undefined) delete rot[k];
        });
        const _orig = n._orig;
        this.update(el, rot);
        n._orig = _orig; // 恢复原始值，因为 move() 会删除它
      });
      return this;
    }

    /**
     * 更新边距，将同时设置所有四个边 - 请参阅 `GridStackOptions.margin` 的格式选项（CSS 字符串格式的 1,2,4 值或单个数字）。
     * @param value 边距值
     */
    public margin(value: numberOrString): GridStack {
      const isMultiValue = typeof value === 'string' && value.split(' ').length > 1;
      if (!isMultiValue) {
        const data = Utils.parseHeight(value);
        if (this.opts.marginUnit === data.unit && this.opts.margin === data.h) return;
      }
      this.opts.margin = value;
      this.opts.marginTop =
        this.opts.marginBottom =
        this.opts.marginLeft =
        this.opts.marginRight =
          undefined;
      this._initMargin();
      this._updateStyles();
      return this;
    }

    /**
     * 返回当前边距的数值（如果四个边不相等则返回 undefined）。
     */
    public getMargin(): number {
      return this.opts.margin as number;
    }

    /**
     * 检查网格高度是否小于垂直约束。如果网格没有高度约束，则始终返回 true。
     * @param node 包含 x,y,w,h,auto-position 选项的节点
     */
    public willItFit(node: GridStackWidget): boolean {
      if (arguments.length > 1) {
        console.warn(
          'gridstack.ts: `willItFit(x,y,w,h,autoPosition)` 已弃用。请使用 `willItFit({x, y,...})`。它将很快被移除。'
        );
        const a = arguments;
        let i = 0,
          w: GridStackWidget = {
            x: a[i++],
            y: a[i++],
            w: a[i++],
            h: a[i++],
            autoPosition: a[i++]
          };
        return this.willItFit(w);
      }
      return this.engine.willItFit(node);
    }

    /**
     * 触发更改事件。
     * @internal
     */
    protected _triggerChangeEvent(): GridStack {
      if (this.engine.batchMode) return this;
      const elements = this.engine.getDirtyNodes(true);
      if (elements && elements.length) {
        if (!this._ignoreLayoutsNodeChange) {
          this.engine.layoutsNodesChange(elements);
        }
        this._triggerEvent('change', elements);
      }
      this.engine.saveInitial();
      return this;
    }

    /**
     * 触发添加事件。
     * @internal
     */
    protected _triggerAddEvent(): GridStack {
      if (this.engine.batchMode) return this;
      if (this.engine.addedNodes?.length) {
        if (!this._ignoreLayoutsNodeChange) {
          this.engine.layoutsNodesChange(this.engine.addedNodes);
        }
        this.engine.addedNodes.forEach((n) => {
          delete n._dirty;
        });
        const addedNodes = [...this.engine.addedNodes];
        this.engine.addedNodes = [];
        this._triggerEvent('added', addedNodes);
      }
      return this;
    }

    /**
     * 触发移除事件。
     * @internal
     */
    public _triggerRemoveEvent(): GridStack {
      if (this.engine.batchMode) return this;
      if (this.engine.removedNodes?.length) {
        const removedNodes = [...this.engine.removedNodes];
        this.engine.removedNodes = [];
        this._triggerEvent('removed', removedNodes);
      }
      return this;
    }

    /**
     * 触发指定类型的事件。
     * @param type 事件类型
     * @param data 可选的事件数据
     * @internal
     */
    protected _triggerEvent(type: string, data?: GridStackNode[]): GridStack {
      const event = data
        ? new CustomEvent(type, {bubbles: false, detail: data})
        : new Event(type);
      this.el.dispatchEvent(event);
      return this;
    }

    /**
     * 设置 CSS 变量。
     * @param el 元素
     * @param varName 变量名
     * @param varValue 变量值
     */
    private setVar(el: HTMLElement, varName: string, varValue: string) {
      el.style.setProperty(varName, varValue);
    }

    /**
     * 更新 CSS 变量（用于 CSS 和内联样式）以支持基于行的布局和初始边距设置。
     * 变量在 DOM 中是作用域的，因此也适用于嵌套网格。
     * @internal
     */
    protected _updateStyles(): GridStack {
      this._updateContainerHeight();
      if (this.opts.cellHeight === 0) {
        return this;
      }
      this.setVar(
        this.el,
        '--gs-cell-height',
        `${this.opts.cellHeight}${this.opts.cellHeightUnit}`
      );
      this.setVar(
        this.el,
        '--gs-item-margin-top',
        `${this.opts.marginTop}${this.opts.marginUnit}`
      );
      this.setVar(
        this.el,
        '--gs-item-margin-bottom',
        `${this.opts.marginBottom}${this.opts.marginUnit}`
      );
      this.setVar(
        this.el,
        '--gs-item-margin-right',
        `${this.opts.marginRight}${this.opts.marginUnit}`
      );
      this.setVar(
        this.el,
        '--gs-item-margin-left',
        `${this.opts.marginLeft}${this.opts.marginUnit}`
      );
      return this;
    }

    /**
     * 更新容器高度。
     * @internal
     */
    protected _updateContainerHeight(): GridStack {
      if (!this.engine || this.engine.batchMode) return this;
      const parent = this.parentGridNode;
      let row = this.getRow() + this._extraDragRow;
      const cellHeight = this.opts.cellHeight as number;
      const unit = this.opts.cellHeightUnit;
      if (!cellHeight) return this;
      if (!parent) {
        const cssMinHeight = Utils.parseHeight(getComputedStyle(this.el)['minHeight']);
        if (cssMinHeight.h > 0 && cssMinHeight.unit === unit) {
          const minRow = Math.floor(cssMinHeight.h / cellHeight);
          if (row < minRow) {
            row = minRow;
          }
        }
      }
      this.el.setAttribute('gs-current-row', String(row));
      this.el.style.removeProperty('min-height');
      this.el.style.removeProperty('height');
      if (row) {
        this.el.style[parent ? 'minHeight' : 'height'] = row * cellHeight + unit;
      }
      if (parent && !parent.grid.engine.batchMode && Utils.shouldSizeToContent(parent)) {
        parent.grid.resizeToContentCBCheck(parent.el);
      }
      return this;
    }

    /** @internal 准备元素的方法 */
    protected _prepareElement(
      el: GridItemHTMLElement,
      triggerAddEvent = false,
      node?: GridStackNode
    ): GridStack {
      // 从元素读取节点信息，如果未提供节点则从属性中读取
      node = node || this._readAttr(el);
      el.gridstackNode = node; // 将节点信息绑定到元素
      node.el = el; // 将元素绑定到节点
      node.grid = this; // 将网格绑定到节点
      node = this.engine.addNode(node, triggerAddEvent); // 将节点添加到引擎中

      // 写入 DOM 尺寸和类名
      this._writeAttr(el, node);
      el.classList.add(gridDefaults.itemClass, this.opts.itemClass); // 添加默认类名和用户定义的类名
      const sizeToContent = Utils.shouldSizeToContent(node); // 检查是否需要根据内容调整大小
      sizeToContent
        ? el.classList.add('size-to-content') // 如果需要，添加相应的类名
        : el.classList.remove('size-to-content'); // 否则移除类名
      if (sizeToContent) this.resizeToContentCheck(false, node); // 如果需要调整大小，执行检查

      // 如果不是延迟加载，则准备拖拽和调整大小功能
      if (!Utils.lazyLoad(node)) this.prepareDragDrop(node.el);

      return this;
    }

    /**
     * 写入位置 x, y, w, h 属性到元素的方法
     * 此外，还会更新内联的 top 和 height 样式
     * @internal
     */
    protected _writePosAttr(el: HTMLElement, n: GridStackNode): GridStack {
      // 设置 x 属性
      if (n.x !== undefined && n.x !== null) {
        el.setAttribute('gs-x', String(n.x));
      }
      // 设置 y 属性
      if (n.y !== undefined && n.y !== null) {
        el.setAttribute('gs-y', String(n.y));
      }
      // 设置 w 属性，如果宽度大于 1
      n.w > 1 ? el.setAttribute('gs-w', String(n.w)) : el.removeAttribute('gs-w');
      // 设置 h 属性，如果高度大于 1
      n.h > 1 ? el.setAttribute('gs-h', String(n.h)) : el.removeAttribute('gs-h');
      // 避免在拖拽/调整大小期间覆盖元素的内联样式，但始终更新占位符
      if ((!n._moving && !n._resizing) || this._placeholder === el) {
        // 设置内联样式，引用 CSS 变量
        el.style.top = `calc(${n.y} * var(--gs-cell-height))`;
        // 高度默认为 --gs-cell-height，因此当 h = 1 时无需设置内联样式
        el.style.height = n.h > 1 ? `calc(${n.h} * var(--gs-cell-height))` : undefined;
      }
      return this;
    }

    /** @internal 将默认属性写回元素的方法 */
    protected _writeAttr(el: HTMLElement, node: GridStackNode): GridStack {
      if (!node) return this;
      this._writePosAttr(el, node);

      const attrs /*: GridStackWidget but strings */ = {
        // 其他属性
        // autoPosition: 'gs-auto-position', // 无需写出，因为已经在节点中，并且不会影响 CSS
        noResize: 'gs-no-resize',
        noMove: 'gs-no-move',
        locked: 'gs-locked',
        id: 'gs-id',
        sizeToContent: 'gs-size-to-content'
      };
      for (const key in attrs) {
        if (node[key]) {
          // 0 对于 x,y 是有效值，但已经在上面处理，并且不在列表中
          el.setAttribute(attrs[key], String(node[key]));
        } else {
          el.removeAttribute(attrs[key]);
        }
      }
      return this;
    }

    /** @internal 从元素读取默认属性的方法 */
    protected _readAttr(el: HTMLElement, clearDefaultAttr = true): GridStackWidget {
      const n: GridStackNode = {};
      n.x = Utils.toNumber(el.getAttribute('gs-x'));
      n.y = Utils.toNumber(el.getAttribute('gs-y'));
      n.w = Utils.toNumber(el.getAttribute('gs-w'));
      n.h = Utils.toNumber(el.getAttribute('gs-h'));
      n.autoPosition = Utils.toBool(el.getAttribute('gs-auto-position'));
      n.noResize = Utils.toBool(el.getAttribute('gs-no-resize'));
      n.noMove = Utils.toBool(el.getAttribute('gs-no-move'));
      n.locked = Utils.toBool(el.getAttribute('gs-locked'));
      const attr = el.getAttribute('gs-size-to-content');
      if (attr) {
        if (attr === 'true' || attr === 'false') n.sizeToContent = Utils.toBool(attr);
        else n.sizeToContent = parseInt(attr, 10);
      }
      n.id = el.getAttribute('gs-id');

      // 读取但从不写出
      n.maxW = Utils.toNumber(el.getAttribute('gs-max-w'));
      n.minW = Utils.toNumber(el.getAttribute('gs-min-w'));
      n.maxH = Utils.toNumber(el.getAttribute('gs-max-h'));
      n.minH = Utils.toNumber(el.getAttribute('gs-min-h'));

      // v8.x 优化以减少不必要的属性，这些属性不会渲染或是默认 CSS
      if (clearDefaultAttr) {
        if (n.w === 1) el.removeAttribute('gs-w');
        if (n.h === 1) el.removeAttribute('gs-h');
        if (n.maxW) el.removeAttribute('gs-max-w');
        if (n.minW) el.removeAttribute('gs-min-w');
        if (n.maxH) el.removeAttribute('gs-max-h');
        if (n.minH) el.removeAttribute('gs-min-h');
      }

      // 删除未找到的键（null 或 false 是默认值，除非 sizeToContent=false 覆盖）
      for (const key in n) {
        if (!n.hasOwnProperty(key)) return;
        if (!n[key] && n[key] !== 0 && key !== 'gs-size-to-content') {
          // 0 可以是有效值（主要是 x,y）
          delete n[key];
        }
      }

      return n;
    }

    /** @internal 设置静态类的方法 */
    protected _setStaticClass(): GridStack {
      const classes = ['grid-stack-static'];

      if (this.opts.staticGrid) {
        this.el.classList.add(...classes);
        this.el.setAttribute('gs-static', 'true');
      } else {
        this.el.classList.remove(...classes);
        this.el.removeAttribute('gs-static');
      }
      return this;
    }

    /**
     * 当网格大小调整时调用 - 检查是否需要启用/禁用单列模式，
     * 并记住我们使用的上一个列数，或者从父级获取列数，
     * 以及检查 cellHeight==='auto'（正方形）或 `sizeToContent` 网格项选项。
     */
    public onResize(clientWidth = this.el?.clientWidth): GridStack {
      if (!clientWidth) return; // 如果我们已被删除或尚未设置大小，则返回（稍后会再次调用）
      if (this.prevWidth === clientWidth) return; // 无操作
      this.prevWidth = clientWidth;
      // console.log('onResize ', clientWidth);

      this.batchUpdate();

      // 检查我们是否嵌套并从父级获取列数...
      let columnChanged = false;
      if (this._autoColumn && this.parentGridNode) {
        if (this.opts.column !== this.parentGridNode.w) {
          this.column(this.parentGridNode.w, this.opts.layout || 'list');
          columnChanged = true;
        }
      } else {
        // 否则检查动态列
        columnChanged = this.checkDynamicColumn();
      }

      // 使单元格内容再次为正方形
      if (this._isAutoCellHeight) this.cellHeight();

      // 更新任何嵌套网格或项目大小
      this.engine.nodes.forEach((n) => {
        if (n.subGrid) n.subGrid.onResize();
      });

      if (!this._skipInitialResize) this.resizeToContentCheck(columnChanged); // 等待列更改的动画（DOM 重排后我们才能正确调整大小）
      delete this._skipInitialResize;

      this.batchUpdate(false);

      return this;
    }

    /** 如果 shouldSizeToContent() 为 true，则调整给定节点（或所有节点）的内容大小 */
    private resizeToContentCheck(delay = false, n: GridStackNode = undefined) {
      if (!this.engine) return; // 我们在此期间已被删除！

      // 更新任何具有 sizeToContent 的网格项高度，但如果我们更改了列数，则等待 DOM $animation_speed 稳定
      // TODO: 是否有办法知道内容的最终（动画后）大小，以便我们可以同时为列宽和高度设置动画，而不是顺序设置动画？
      if (delay && this.hasAnimationCSS())
        return setTimeout(() => this.resizeToContentCheck(false, n), this.animationDelay);

      if (n) {
        if (Utils.shouldSizeToContent(n)) this.resizeToContentCBCheck(n.el);
      } else if (this.engine.nodes.some((n) => Utils.shouldSizeToContent(n))) {
        const nodes = [...this.engine.nodes]; // 如果在调整大小时顺序发生变化
        this.batchUpdate();
        nodes.forEach((n) => {
          if (Utils.shouldSizeToContent(n)) this.resizeToContentCBCheck(n.el);
        });
        this.batchUpdate(false);
      }
      // 无论 shouldSizeToContent 是否为 true，都调用此方法，因为在调整大小后小部件可能需要拉伸以占用可用空间
      if (this._gsEventHandler['resizecontent'])
        this._gsEventHandler['resizecontent'](null, n ? [n] : this.engine.nodes);
    }

    /** 添加或移除网格元素大小事件处理程序 */
    protected _updateResizeEvent(forceRemove = false): GridStack {
      // 仅在我们未嵌套（父级将调用我们）并且我们自动调整单元格大小或支持动态列（即正在执行工作）时添加事件
      // 或支持新的 sizeToContent 选项。
      const trackSize =
        !this.parentGridNode &&
        (this._isAutoCellHeight ||
          this.opts.sizeToContent ||
          this.opts.columnOpts ||
          this.engine.nodes.find((n) => n.sizeToContent));

      if (!forceRemove && trackSize && !this.resizeObserver) {
        this._sizeThrottle = Utils.throttle(
          () => this.onResize(),
          this.opts.cellHeightThrottle
        );
        this.resizeObserver = new ResizeObserver(() => this._sizeThrottle());
        this.resizeObserver.observe(this.el);
        this._skipInitialResize = true; // makeWidget 最初会在启动时调用
      } else if ((forceRemove || !trackSize) && this.resizeObserver) {
        this.resizeObserver.disconnect();
        delete this.resizeObserver;
        delete this._sizeThrottle;
      }

      return this;
    }

    /** @internal 将潜在的选择器转换为实际元素 */
    public static getElement(els: GridStackElement = '.grid-stack-item'): GridItemHTMLElement {
      return Utils.getElement(els);
    }
    /** @internal */
    public static getElements(els: GridStackElement = '.grid-stack-item'): GridItemHTMLElement[] {
      return Utils.getElements(els);
    }
    /** @internal */
    public static getGridElement(els: GridStackElement): GridHTMLElement {
      return GridStack.getElement(els);
    }
    /** @internal */
    public static getGridElements(els: string): GridHTMLElement[] {
      return Utils.getElements(els);
    }

    /** @internal 初始化边距 top/bottom/left/right 和单位 */
    protected _initMargin(): GridStack {
      let data: HeightData;
      let margin = 0;

      // 支持传递多个值，如 CSS（例如：'5px 10px 0 20px'）
      let margins: string[] = [];
      if (typeof this.opts.margin === 'string') {
        margins = this.opts.margin.split(' ');
      }
      if (margins.length === 2) {
        // top/bot, left/right 如 CSS
        this.opts.marginTop = this.opts.marginBottom = margins[0];
        this.opts.marginLeft = this.opts.marginRight = margins[1];
      } else if (margins.length === 4) {
        // 顺时针如 CSS
        this.opts.marginTop = margins[0];
        this.opts.marginRight = margins[1];
        this.opts.marginBottom = margins[2];
        this.opts.marginLeft = margins[3];
      } else {
        data = Utils.parseHeight(this.opts.margin);
        this.opts.marginUnit = data.unit;
        margin = this.opts.margin = data.h;
      }

      // 查看是否需要设置 top/bottom/left/right
      if (this.opts.marginTop === undefined) {
        this.opts.marginTop = margin;
      } else {
        data = Utils.parseHeight(this.opts.marginTop);
        this.opts.marginTop = data.h;
        delete this.opts.margin;
      }

      if (this.opts.marginBottom === undefined) {
        this.opts.marginBottom = margin;
      } else {
        data = Utils.parseHeight(this.opts.marginBottom);
        this.opts.marginBottom = data.h;
        delete this.opts.margin;
      }

      if (this.opts.marginRight === undefined) {
        this.opts.marginRight = margin;
      } else {
        data = Utils.parseHeight(this.opts.marginRight);
        this.opts.marginRight = data.h;
        delete this.opts.margin;
      }

      if (this.opts.marginLeft === undefined) {
        this.opts.marginLeft = margin;
      } else {
        data = Utils.parseHeight(this.opts.marginLeft);
        this.opts.marginLeft = data.h;
        delete this.opts.margin;
      }
      this.opts.marginUnit = data.unit; // 如果边被拼写出来，则使用这些单位...
      if (
        this.opts.marginTop === this.opts.marginBottom &&
        this.opts.marginLeft === this.opts.marginRight &&
        this.opts.marginTop === this.opts.marginRight
      ) {
        this.opts.margin = this.opts.marginTop; // 使检查 setMargin() 中的无操作更容易
      }
      return this;
    }

    static GDRev = '11.5.0-dev';

    /* ===========================================================================================
     * drag&drop methods that used to be stubbed out and implemented in dd-gridstack.ts
     * but caused loading issues in prod - see https://github.com/gridstack/gridstack.js/issues/2039
     * ===========================================================================================
     */

    /** 获取全局（但对该代码静态）的 DD 实现 */
    public static getDD(): DDGridStack {
      return dd;
    }

    /**
     * 调用此方法以设置从外部（例如工具栏）拖入的功能，指定类选择器和选项。
     * 在 GridStack.init() 期间作为选项调用，但也可以直接调用（使用最后的参数），
     * 以便动态创建的工具栏可以稍后设置。
     * @param dragIn 字符串选择器（例如：'.sidebar-item'）或 DOM 元素列表
     * @param dragInOptions 选项 - 参见 DDDragOpt。`(默认值: {handle: '.grid-stack-item-content', appendTo: 'body'})`
     * @param widgets GridStackWidget 定义，分配给每个元素，用于定义在放置时创建的内容
     * @param root 可选的根元素，默认为 document（对于 shadow dom，传递父 HTMLDocument）
     */
    public static setupDragIn(
      dragIn?: string | HTMLElement[],
      dragInOptions?: DDDragOpt,
      widgets?: GridStackWidget[],
      root: HTMLElement | Document = document
    ): void {
      if (dragInOptions?.pause !== undefined) {
        DDManager.pauseDrag = dragInOptions.pause;
      }

      dragInOptions = {appendTo: 'body', helper: 'clone', ...(dragInOptions || {})}; // 默认 handle:undefined = 整个项目可拖动
      const els = typeof dragIn === 'string' ? Utils.getElements(dragIn, root) : dragIn;
      els.forEach((el, i) => {
        if (!dd.isDraggable(el)) dd.dragIn(el, dragInOptions);
        if (widgets?.[i]) (el as GridItemHTMLElement).gridstackNode = widgets[i];
      });
    }

    /**
     * 启用/禁用特定网格元素的用户拖动功能。如果希望影响所有项目并影响未来项目，请使用 enableMove()。对于静态网格无效。
     * 如果您希望防止某个项目因碰撞而被其他项目推开，请使用 locked 属性。
     * @param els 要修改的小部件或选择器。
     * @param val 如果为 true，则小部件将可拖动，前提是父网格未设置为 noMove 或 static。
     */
    public movable(els: GridStackElement, val: boolean): GridStack {
      if (this.opts.staticGrid) return this; // 静态网格无法移动！
      GridStack.getElements(els).forEach((el) => {
        const n = el.gridstackNode;
        if (!n) return;
        val ? delete n.noMove : (n.noMove = true);
        this.prepareDragDrop(n.el); // 初始化拖动功能（如果需要），并进行调整
      });
      return this;
    }

    /**
     * 启用/禁用特定网格元素的用户调整大小功能。如果希望影响所有项目并影响未来项目，请使用 enableResize()。对于静态网格无效。
     * @param els 要修改的小部件或选择器。
     * @param val 如果为 true，则小部件将可调整大小，前提是父网格未设置为 noResize 或 static。
     */
    public resizable(els: GridStackElement, val: boolean): GridStack {
      if (this.opts.staticGrid) return this; // 静态网格无法调整大小！
      GridStack.getElements(els).forEach((el) => {
        const n = el.gridstackNode;
        if (!n) return;
        val ? delete n.noResize : (n.noResize = true);
        this.prepareDragDrop(n.el); // 初始化拖动功能（如果需要），并进行调整
      });
      return this;
    }

    /**
     * 临时禁用小部件的移动/调整大小功能。
     * 如果需要更永久的方式（会冻结资源），请改用 `setStatic(true)`。
     * 注意：对于静态网格无效。
     * 这是以下代码的快捷方式：
     * @example
     *  grid.enableMove(false);
     *  grid.enableResize(false);
     * @param recurse 如果为 true（默认值），子网格也会被更新。
     */
    public disable(recurse = true): GridStack {
      if (this.opts.staticGrid) return;
      this.enableMove(false, recurse);
      this.enableResize(false, recurse);
      this._triggerEvent('disable');
      return this;
    }

    /**
     * 重新启用小部件的移动/调整大小功能 - 参见 disable()。
     * 注意：对于静态网格无效。
     * 这是以下代码的快捷方式：
     * @example
     *  grid.enableMove(true);
     *  grid.enableResize(true);
     * @param recurse 如果为 true（默认值），子网格也会被更新。
     */
    public enable(recurse = true): GridStack {
      if (this.opts.staticGrid) return;
      this.enableMove(true, recurse);
      this.enableResize(true, recurse);
      this._triggerEvent('enable');
      return this;
    }

    /**
     * 启用/禁用小部件的移动功能。对于静态网格无效，本地定义的项目仍然优先。
     * @param recurse 如果为 true（默认值），子网格也会被更新。
     */
    public enableMove(doEnable: boolean, recurse = true): GridStack {
      if (this.opts.staticGrid) return this; // 静态网格无法移动！
      doEnable ? delete this.opts.disableDrag : (this.opts.disableDrag = true); // 在更新子节点之前先设置网格选项
      this.engine.nodes.forEach((n) => {
        this.prepareDragDrop(n.el);
        if (n.subGrid && recurse) n.subGrid.enableMove(doEnable, recurse);
      });
      return this;
    }

    /**
     * 启用/禁用小部件的调整大小功能。对于静态网格无效。
     * @param recurse 如果为 true（默认值），子网格也会被更新。
     */
    public enableResize(doEnable: boolean, recurse = true): GridStack {
      if (this.opts.staticGrid) return this; // 静态网格无法调整大小！
      doEnable ? delete this.opts.disableResize : (this.opts.disableResize = true); // 在更新子节点之前先设置网格选项
      this.engine.nodes.forEach((n) => {
        this.prepareDragDrop(n.el);
        if (n.subGrid && recurse) n.subGrid.enableResize(doEnable, recurse);
      });
      return this;
    }

    /** @internal 当需要取消拖拽（按下 Esc 键）时调用 */
    public cancelDrag() {
      const n = this._placeholder?.gridstackNode;
      if (!n) return;
      if (n._isExternal) {
        // 移除任何新插入的节点（从外部拖入）
        n._isAboutToRemove = true;
        this.engine.removeNode(n);
      } else if (n._isAboutToRemove) {
        // 恢复任何临时移除的节点（拖到垃圾箱上）
        GridStack._itemRemoving(n.el, false);
      }

      this.engine.restoreInitial();
    }

    /** @internal 移除任何拖拽和调整大小功能（在销毁时调用） */
    protected _removeDD(el: DDElementHost): GridStack {
      dd.draggable(el, 'destroy').resizable(el, 'destroy');
      if (el.gridstackNode) {
        delete el.gridstackNode._initDD; // 重置拖拽和调整大小初始化标志
      }
      delete el.ddElement;
      return this;
    }

    /** @internal 添加拖拽支持以允许外部小部件被添加 */
    protected _setupAcceptWidget(): GridStack {
      // 检查是否需要禁用功能
      if (this.opts.staticGrid || (!this.opts.acceptWidgets && !this.opts.removable)) {
        dd.droppable(this.el, 'destroy');
        return this;
      }

      // 定义共享变量
      let cellHeight: number, cellWidth: number;

      const onDrag = (event: DragEvent, el: GridItemHTMLElement, helper: GridItemHTMLElement) => {
        helper = helper || el;
        const node = helper.gridstackNode;
        if (!node) return;

        // 如果元素从外部拖入，则缩放以匹配网格的比例，并稍微调整其相对于鼠标的位置
        if (!node.grid?.el) {
          // 缩放 helper
          helper.style.transform = `scale(${1 / this.dragTransform.xScale},${
            1 / this.dragTransform.yScale
          })`;
          // 调整 helper 的位置以匹配鼠标
          const helperRect = helper.getBoundingClientRect();
          helper.style.left =
            helperRect.x +
            ((this.dragTransform.xScale - 1) * (event.clientX - helperRect.x)) /
              this.dragTransform.xScale +
            'px';
          helper.style.top =
            helperRect.y +
            ((this.dragTransform.yScale - 1) * (event.clientY - helperRect.y)) /
              this.dragTransform.yScale +
            'px';
          helper.style.transformOrigin = `0px 0px`;
        }

        let {top, left} = helper.getBoundingClientRect();
        const rect = this.el.getBoundingClientRect();
        left -= rect.left;
        top -= rect.top;
        const ui: DDUIData = {
          position: {
            top: top * this.dragTransform.xScale,
            left: left * this.dragTransform.yScale
          }
        };

        if (node._temporaryRemoved) {
          node.x = Math.max(0, Math.round(left / cellWidth));
          node.y = Math.max(0, Math.round(top / cellHeight));
          delete node.autoPosition;
          this.engine.nodeBoundFix(node);

          // 如果初始位置不适合，则尝试其他位置
          if (!this.engine.willItFit(node)) {
            node.autoPosition = true;
            if (!this.engine.willItFit(node)) {
              dd.off(el, 'drag'); // 停止调用
              return; // 网格已满或无法扩展
            }
            if (node._willFitPos) {
              // 使用自动位置
              Utils.copyPos(node, node._willFitPos);
              delete node._willFitPos;
            }
          }

          // 复用现有的节点拖拽方法
          this._onStartMoving(helper, event, ui, node, cellWidth, cellHeight);
        } else {
          // 复用现有的节点拖拽方法，进行碰撞检测
          this._dragOrResize(helper, event, ui, node, cellWidth, cellHeight);
        }
      };

      dd.droppable(this.el, {
        accept: (el: GridItemHTMLElement) => {
          const node: GridStackNode = el.gridstackNode || this._readAttr(el, false);
          // 接受自身的拖拽（忽略），以避免 HTML5 模式下显示“无法放置”图标
          if (node?.grid === this) return true;
          if (!this.opts.acceptWidgets) return false;
          // 检查接受方法或类匹配
          let canAccept = true;
          if (typeof this.opts.acceptWidgets === 'function') {
            canAccept = this.opts.acceptWidgets(el);
          } else {
            const selector =
              this.opts.acceptWidgets === true
                ? '.grid-stack-item'
                : (this.opts.acceptWidgets as string);
            canAccept = el.matches(selector);
          }
          // 最后检查是否还有空间
          if (canAccept && node && this.opts.maxRow) {
            const n = {w: node.w, h: node.h, minW: node.minW, minH: node.minH};
            canAccept = this.engine.willItFit(n);
          }
          return canAccept;
        }
      })
        /**
         * 进入网格区域
         */
        .on(
          this.el,
          'dropover',
          (event: Event, el: GridItemHTMLElement, helper: GridItemHTMLElement) => {
            let node = helper?.gridstackNode || el.gridstackNode;
            // 忽略自身的拖拽（除非临时移除）
            if (node?.grid === this && !node._temporaryRemoved) {
              return false;
            }

            // 如果是侧边栏项目，恢复其初始大小
            if (node?._sidebarOrig) {
              node.w = node._sidebarOrig.w;
              node.h = node._sidebarOrig.h;
            }

            // 修复快速拖拽时可能未触发的 leave 事件
            if (node?.grid && node.grid !== this && !node._temporaryRemoved) {
              const otherGrid = node.grid;
              otherGrid._leave(el, helper);
            }
            helper = helper || el;

            // 缓存单元格尺寸
            cellWidth = this.cellWidth();
            cellHeight = this.getCellHeight(true);

            // 如果是侧边栏项目，加载其属性
            if (!node) {
              const attr =
                helper.getAttribute('data-gs-widget') ||
                helper.getAttribute('gridstacknode');
              if (attr) {
                try {
                  node = JSON.parse(attr);
                } catch (error) {
                  console.error('Gridstack dropover: Bad JSON format: ', attr);
                }
                helper.removeAttribute('data-gs-widget');
                helper.removeAttribute('gridstacknode');
              }
              if (!node) node = this._readAttr(helper);
              node._sidebarOrig = {w: node.w, h: node.h};
            }
            if (!node.grid) {
              // 侧边栏项目
              if (!node.el) node = {...node};
              node._isExternal = true;
              helper.gridstackNode = node;
            }

            // 根据元素外部尺寸计算网格大小
            const w = node.w || Math.round(helper.offsetWidth / cellWidth) || 1;
            const h = node.h || Math.round(helper.offsetHeight / cellHeight) || 1;

            // 如果项目来自其他网格，复制并保存原始信息
            if (node.grid && node.grid !== this) {
              if (!el._gridstackNodeOrig) el._gridstackNodeOrig = node;
              el.gridstackNode = node = {...node, w, h, grid: this};
              delete node.x;
              delete node.y;
              this.engine.cleanupNode(node).nodeBoundFix(node);
              node._initDD =
                node._isExternal =
                node._temporaryRemoved =
                  true;
            } else {
              node.w = w;
              node.h = h;
              node._temporaryRemoved = true;
            }

            // 清除标记为完全移除的项目
            GridStack._itemRemoving(node.el, false);

            dd.on(el, 'drag', onDrag);
            onDrag(event as DragEvent, el, helper);
            return false;
          }
        )
        /**
         * 离开网格区域
         */
        .on(
          this.el,
          'dropout',
          (event, el: GridItemHTMLElement, helper: GridItemHTMLElement) => {
            const node = helper?.gridstackNode || el.gridstackNode;
            if (!node) return false;
            if (!node.grid || node.grid === this) {
              this._leave(el, helper);
              if (this._isTemp) {
                this.removeAsSubGrid(node);
              }
            }
            return false;
          }
        )
        /**
         * 释放鼠标
         */
        .on(this.el, 'drop', (event, el: GridItemHTMLElement, helper: GridItemHTMLElement) => {
          const node = helper?.gridstackNode || el.gridstackNode;
          if (node?.grid === this && !node._isExternal) return false;

          const wasAdded = !!this.placeholder.parentElement;
          const wasSidebar = el !== helper;
          this.placeholder.remove();
          delete this.placeholder.gridstackNode;

          const noAnim = wasAdded && this.opts.animate;
          if (noAnim) this.setAnimation(false);

          const origNode = el._gridstackNodeOrig;
          delete el._gridstackNodeOrig;
          if (wasAdded && origNode?.grid && origNode.grid !== this) {
            const oGrid = origNode.grid;
            oGrid.engine.removeNodeFromLayoutCache(origNode);
            oGrid.engine.removedNodes.push(origNode);
            oGrid._triggerRemoveEvent()._triggerChangeEvent();
            if (
              oGrid.parentGridNode &&
              !oGrid.engine.nodes.length &&
              oGrid.opts.subGridDynamic
            ) {
              oGrid.removeAsSubGrid();
            }
          }

          if (!node) return false;

          if (wasAdded) {
            this.engine.cleanupNode(node);
            node.grid = this;
          }
          delete node.grid?._isTemp;
          dd.off(el, 'drag');
          if (helper !== el) {
            helper.remove();
            el = helper;
          } else {
            el.remove();
          }
          this._removeDD(el);
          if (!wasAdded) return false;
          const subGrid = node.subGrid?.el?.gridstack;
          Utils.copyPos(node, this._readAttr(this.placeholder));
          Utils.removePositioningStyles(el);

          if (wasSidebar && (node.content || node.subGridOpts || GridStack.addRemoveCB)) {
            delete node.el;
            el = this.addWidget(node);
          } else {
            this._prepareElement(el, true, node);
            this.el.appendChild(el);
            this.resizeToContentCheck(false, node);
            if (subGrid) {
              subGrid.parentGridNode = node;
              subGrid._updateStyles();
            }
            this._updateContainerHeight();
          }
          this.engine.addedNodes.push(node);
          this._triggerAddEvent();
          this._triggerChangeEvent();

          this.engine.endUpdate();
          if (this._gsEventHandler['dropped']) {
            this._gsEventHandler['dropped'](
              {...event, type: 'dropped'},
              origNode && origNode.grid ? origNode : undefined,
              node
            );
          }

          if (noAnim) this.setAnimation(this.opts.animate, true);

          return false;
        });
      return this;
    }

    /** @internal 标记项目为移除状态 */
    private static _itemRemoving(el: GridItemHTMLElement, remove: boolean) {
      if (!el) return;
      const node = el ? el.gridstackNode : undefined;
      // 如果节点没有网格或元素包含拒绝移除的类，则直接返回
      if (!node?.grid || el.classList.contains(node.grid.opts.removableOptions.decline)) return;
      // 根据移除状态设置标志并更新样式
      remove ? (node._isAboutToRemove = true) : delete node._isAboutToRemove;
      remove
        ? el.classList.add('grid-stack-item-removing') // 添加移除样式
        : el.classList.remove('grid-stack-item-removing'); // 移除移除样式
    }

    /** @internal 如果用户指定了移除区域，则设置垃圾箱拖放区域 */
    protected _setupRemoveDrop(): GridStack {
      // 如果移除选项不是字符串，则直接返回
      if (typeof this.opts.removable !== 'string') return this;
      const trashEl = document.querySelector(this.opts.removable) as HTMLElement;
      if (!trashEl) return this;

      // 仅为垃圾箱注册一个静态的拖放回调，因为垃圾箱是共享资源
      // 并且原生拖放仅支持一个事件回调（为每个网格设置独立的 removableOptions 会使事情复杂化）
      if (!this.opts.staticGrid && !dd.isDroppable(trashEl)) {
        dd.droppable(trashEl, this.opts.removableOptions)
          .on(trashEl, 'dropover', (event, el) => GridStack._itemRemoving(el, true)) // 当项目拖入垃圾箱时标记为移除
          .on(trashEl, 'dropout', (event, el) => GridStack._itemRemoving(el, false)); // 当项目拖出垃圾箱时取消移除标记
      }
      return this;
    }

    /**
     * 为拖拽和调整大小准备元素 - 通常由 makeWidget() 调用，除非是延迟加载
     * @param el 网格项的 HTML 元素
     * @param [force=false] 是否强制重新初始化
     */
    public prepareDragDrop(el: GridItemHTMLElement, force = false): GridStack {
      const node = el?.gridstackNode;
      if (!node) return;
      const noMove = node.noMove || this.opts.disableDrag;
      const noResize = node.noResize || this.opts.disableResize;

      // 检查网格是否被禁用
      const disable = node.locked || this.opts.staticGrid || (noMove && noResize);
      if (force || disable) {
        if (node._initDD) {
          this._removeDD(el); // 移除所有拖拽和调整大小功能
          delete node._initDD;
        }
        if (disable) {
          el.classList.add('ui-draggable-disabled', 'ui-resizable-disabled'); // 添加禁用样式
          return this;
        }
      }

      if (!node._initDD) {
        // 在 3 个事件（开始、移动、结束）之间共享的变量
        let cellWidth: number;
        let cellHeight: number;

        /** 当项目开始移动或调整大小时调用 */
        const onStartMoving = (event: Event, ui: DDUIData) => {
          // 手动触发 'dragstart' / 'resizestart' 事件
          if (this._gsEventHandler[event.type]) {
            this._gsEventHandler[event.type](event, event.target);
          }
          cellWidth = this.cellWidth();
          cellHeight = this.getCellHeight(true); // 强制以像素为单位计算

          this._onStartMoving(el, event, ui, node, cellWidth, cellHeight);
        };

        /** 当项目正在拖拽或调整大小时调用 */
        const dragOrResize = (event: MouseEvent, ui: DDUIData) => {
          this._dragOrResize(el, event, ui, node, cellWidth, cellHeight);
        };

        /** 当项目停止移动或调整大小时调用 */
        const onEndMoving = (event: Event) => {
          this.placeholder.remove();
          delete this.placeholder.gridstackNode;
          delete node._moving;
          delete node._resizing;
          delete node._event;
          delete node._lastTried;
          const widthChanged = node.w !== node._orig.w;

          // 如果项目移动到另一个网格，则结束处理
          const target: GridItemHTMLElement = event.target as GridItemHTMLElement;
          if (!target.gridstackNode || target.gridstackNode.grid !== this) return;

          node.el = target;

          if (node._isAboutToRemove) {
            const grid = el.gridstackNode.grid;
            if (grid._gsEventHandler[event.type]) {
              grid._gsEventHandler[event.type](event, target);
            }
            grid.engine.nodes.push(node); // 临时添加回去以便正确移除
            grid.removeWidget(el, true, true);
          } else {
            Utils.removePositioningStyles(target);
            if (node._temporaryRemoved) {
              // 恢复项目到拖拽前的位置
              Utils.copyPos(node, node._orig);
              this._writePosAttr(target, node);
              this.engine.addNode(node);
            } else {
              // 移动到占位符的新位置
              this._writePosAttr(target, node);
            }
            if (this._gsEventHandler[event.type]) {
              this._gsEventHandler[event.type](event, target);
            }
          }
          this._extraDragRow = 0;
          this._updateContainerHeight();
          this._triggerChangeEvent();

          this.engine.endUpdate();

          if (event.type === 'resizestop') {
            if (Number.isInteger(node.sizeToContent)) node.sizeToContent = node.h; // 设置新的软限制
            this.resizeToContentCheck(widthChanged, node); // 如果宽度发生变化，等待动画完成
          }
        };

        dd.draggable(el, {
          start: onStartMoving,
          stop: onEndMoving,
          drag: dragOrResize
        }).resizable(el, {
          start: onStartMoving,
          stop: onEndMoving,
          resize: dragOrResize
        });
        node._initDD = true; // 标记为已初始化拖拽和调整大小支持
      }

      // 最后根据是否允许移动或调整大小进行微调
      dd.draggable(el, noMove ? 'disable' : 'enable').resizable(
        el,
        noResize ? 'disable' : 'enable'
      );

      return this;
    }

    /** @internal 处理实际的拖拽/调整大小开始事件 */
    protected _onStartMoving(
      el: GridItemHTMLElement,
      event: Event,
      ui: DDUIData,
      node: GridStackNode,
      cellWidth: number,
      cellHeight: number
    ): void {
      // 清理节点并开始更新
      this.engine.cleanNodes().beginUpdate(node);
      // 写入占位符的位置信息
      // @ts-ignore
      this._writePosAttr(this.placeholder, node);
      this.el.appendChild(this.placeholder);
      this.placeholder.gridstackNode = node;
      // console.log('_onStartMoving placeholder') // 测试

      // 如果元素在网格内，使用该网格的缩放比例作为参考
      if (node.grid?.el) {
        this.dragTransform = Utils.getValuesFromTransformedElement(el);
      }
      // 如果元素从外部拖入（不属于任何网格），使用当前网格作为缩放参考
      else if (this.placeholder && this.placeholder.closest('.grid-stack')) {
        const gridEl = this.placeholder.closest('.grid-stack') as HTMLElement;
        this.dragTransform = Utils.getValuesFromTransformedElement(gridEl);
      }
      // 备用方案
      else {
        this.dragTransform = {
          xScale: 1,
          xOffset: 0,
          yScale: 1,
          yOffset: 0
        };
      }

      // 将占位符设置为当前节点的元素
      node.el = this.placeholder;
      node._lastUiPosition = ui.position;
      node._prevYPix = ui.position.top;
      node._moving = event.type === 'dragstart'; // 'dropover' 事件初始时不移动，以便精确放置（会推开其他元素）
      node._resizing = event.type === 'resizestart';
      delete node._lastTried;

      // 如果是 'dropover' 且节点被临时移除，则重新添加节点
      if (event.type === 'dropover' && node._temporaryRemoved) {
        // console.log('engine.addNode x=' + node.x); // 测试
        this.engine.addNode(node); // 添加节点，修复冲突，更新属性并清除 _temporaryRemoved
        node._moving = true; // 在添加后标记为移动对象（需要在固定位置之前）
      }

      // 设置调整大小的最小/最大限制，考虑列数和位置（避免超出网格边界）
      this.engine.cacheRects(
        cellWidth,
        cellHeight,
        this.opts.marginTop as number,
        this.opts.marginRight as number,
        this.opts.marginBottom as number,
        this.opts.marginLeft as number
      );
      if (event.type === 'resizestart') {
        const colLeft = this.getColumn() - node.x;
        const rowLeft = (this.opts.maxRow || Number.MAX_SAFE_INTEGER) - node.y;
        dd.resizable(el, 'option', 'minWidth', cellWidth * Math.min(node.minW || 1, colLeft))
          .resizable(
            el,
            'option',
            'minHeight',
            cellHeight * Math.min(node.minH || 1, rowLeft)
          )
          .resizable(
            el,
            'option',
            'maxWidth',
            cellWidth * Math.min(node.maxW || Number.MAX_SAFE_INTEGER, colLeft)
          )
          .resizable(
            el,
            'option',
            'maxWidthMoveLeft',
            cellWidth * Math.min(node.maxW || Number.MAX_SAFE_INTEGER, node.x + node.w)
          )
          .resizable(
            el,
            'option',
            'maxHeight',
            cellHeight * Math.min(node.maxH || Number.MAX_SAFE_INTEGER, rowLeft)
          )
          .resizable(
            el,
            'option',
            'maxHeightMoveUp',
            cellHeight * Math.min(node.maxH || Number.MAX_SAFE_INTEGER, node.y + node.h)
          );
      }
    }

    /**
     * 处理拖拽或调整大小的逻辑。
     * Handles the logic for dragging or resizing grid items.
     *
     * @param el - 当前被拖拽或调整大小的 HTML 元素。
     *              The HTML element being dragged or resized.
     * @param event - 当前的鼠标事件。
     *                The current mouse event.
     * @param ui - 拖拽或调整大小的 UI 数据。
     *             The UI data for dragging or resizing.
     * @param node - 当前网格项的节点数据。
     *               The node data of the current grid item.
     * @param cellWidth - 单元格的宽度。
     *                    The width of a single grid cell.
     * @param cellHeight - 单元格的高度。
     *                     The height of a single grid cell.
     */
    protected _dragOrResize(
        el: GridItemHTMLElement,
        event: MouseEvent,
        ui: DDUIData,
        node: GridStackNode,
        cellWidth: number,
        cellHeight: number
    ): void {
        const p = {...node._orig}; // 可能为 undefined（_isExternal），这没问题（拖动仅设置 x,y，w,h 将默认为节点值）
        let resizing: boolean;
        let mLeft = this.opts.marginLeft as number,
            mRight = this.opts.marginRight as number,
            mTop = this.opts.marginTop as number,
            mBottom = this.opts.marginBottom as number;

        // 如果边距（用于通过中点）相对于单元格高度/宽度较大，则将其缩小 #1855
        const mHeight = Math.round(cellHeight * 0.1),
            mWidth = Math.round(cellWidth * 0.1);
        mLeft = Math.min(mLeft, mWidth);
        mRight = Math.min(mRight, mWidth);
        mTop = Math.min(mTop, mHeight);
        mBottom = Math.min(mBottom, mHeight);

        if (event.type === 'drag') {
            if (node._temporaryRemoved) return; // 由 dropover 处理
            const distance = ui.position.top - node._prevYPix;
            node._prevYPix = ui.position.top;
            if (this.opts.draggable.scroll !== false) {
          Utils.updateScrollPosition(el, ui.position, distance);
            }

            // 获取新位置，考虑到我们移动方向上的边距（需要通过边距的中点）
            const left =
          ui.position.left + (ui.position.left > node._lastUiPosition.left ? -mRight : mLeft);
            const top =
          ui.position.top + (ui.position.top > node._lastUiPosition.top ? -mBottom : mTop);
            p.x = Math.round(left / cellWidth);
            p.y = Math.round(top / cellHeight);

            // 如果我们在底部碰到其他东西，则增长网格，以便在尝试放置在其他项目下方时光标不会离开
            const prev = this._extraDragRow;
            if (this.engine.collide(node, p)) {
          const row = this.getRow();
          let extra = Math.max(0, p.y + node.h - row);
          if (this.opts.maxRow && row + extra > this.opts.maxRow) {
              extra = Math.max(0, this.opts.maxRow - row);
          }
          this._extraDragRow = extra;
            } else this._extraDragRow = 0;
            if (this._extraDragRow !== prev) this._updateContainerHeight();

            if (node.x === p.x && node.y === p.y) return; // 跳过相同位置
            // 不要跳过我们尝试过的位置，因为之前可能由于覆盖率 <50% 而失败
        } else if (event.type === 'resize') {
            if (p.x < 0) return;
            // 如果需要，滚动页面
            Utils.updateScrollResize(event, el, cellHeight);

            // 获取新大小
            p.w = Math.round((ui.size.width - mLeft) / cellWidth);
            p.h = Math.round((ui.size.height - mTop) / cellHeight);
            if (node.w === p.w && node.h === p.h) return;
            if (node._lastTried && node._lastTried.w === p.w && node._lastTried.h === p.h) return; // 跳过我们尝试过的（但失败了）

            // 如果我们在左/顶部调整大小，这可能会移动我们，因此也获取可能的新位置
            const left = ui.position.left + mLeft;
            const top = ui.position.top + mTop;
            p.x = Math.round(left / cellWidth);
            p.y = Math.round(top / cellHeight);

            resizing = true;
        }

        node._event = event;
        node._lastTried = p; // 设置为最后尝试的位置（如果我们到达那里，将会清除）
        const rect: GridStackPosition = {
            // 被拖动框的屏幕像素
            x: ui.position.left + mLeft,
            y: ui.position.top + mTop,
            w: (ui.size ? ui.size.width : node.w * cellWidth) - mLeft - mRight,
            h: (ui.size ? ui.size.height : node.h * cellHeight) - mTop - mBottom
        };
        if (this.engine.moveNodeCheck(node, {...p, cellWidth, cellHeight, rect, resizing})) {
            node._lastUiPosition = ui.position;
            this.engine.cacheRects(cellWidth, cellHeight, mTop, mRight, mBottom, mLeft);
            delete node._skipDown;
            if (resizing && node.subGrid) node.subGrid.onResize();
            this._extraDragRow = 0;
            this._updateContainerHeight();

            const target = event.target as GridItemHTMLElement;
            // 不要将侧边栏项目属性写回原始侧边栏元素
            if (!node._sidebarOrig) {
          this._writePosAttr(target, node);
            }
            if (this._gsEventHandler[event.type]) {
          this._gsEventHandler[event.type](event, target);
            }
        }
    }

    /** @internal 当项目通过光标移出事件或形状超出边界离开我们的区域时调用。
     * 从我们这里移除它，并标记为临时移除，如果这是我们的项目，否则从它来自的先前网格恢复先前的节点值。
     */
    protected _leave(el: GridItemHTMLElement, helper?: GridItemHTMLElement): void {
        helper = helper || el;
        const node = helper.gridstackNode;
        if (!node) return;

        // 当离开时移除 helper 的缩放
        helper.style.transform = helper.style.transformOrigin = null;
        dd.off(el, 'drag'); // 在外部时无需跟踪

        // 这在光标离开且形状超出时调用，因此只需执行一次
        if (node._temporaryRemoved) return;
        node._temporaryRemoved = true;

        this.engine.removeNode(node); // 同时移除占位符，否则这表明节点不在我们的列表中，这是一个更大的问题
        node.el = node._isExternal && helper ? helper : el; // 指向正在拖动的实际项目
        const sidebarOrig = node._sidebarOrig;
        if (node._isExternal) this.engine.cleanupNode(node);
        // 恢复侧边栏项目的初始大小信息，以在多个网格之间拖动时保持一致
        node._sidebarOrig = sidebarOrig;

        if (this.opts.removable === true) {
            // 布尔值 vs 类字符串
            // 项目离开我们并且我们应该在离开时移除（无需拖动到垃圾箱），将其标记为移除
            GridStack._itemRemoving(el, true);
        }

        // 最后，如果项目最初来自另一个网格，但离开了我们，将所有内容恢复到先前的信息
        if (el._gridstackNodeOrig) {
            // console.log('leave delete _gridstackNodeOrig') // 测试
            el.gridstackNode = el._gridstackNodeOrig;
            delete el._gridstackNodeOrig;
        } else if (node._isExternal) {
            // 项目来自外部，恢复所有节点到原始状态
            this.engine.restoreInitial();
        }
    }

    /**
     * 已移除的遗留方法，建议使用 batchUpdate(false) 替代
     */
    public commit(): GridStack {
        obsolete(this, this.batchUpdate(false), 'commit', 'batchUpdate', '5.2');
        return this;
    }
}
