/**
 * dd-resizable.ts 11.5.0-dev
 * Copyright (c) 2021-2024  Alain Dumesny - see GridStack root license
 */

import {DDResizableHandle} from './dd-resizable-handle';
import {DDBaseImplement, HTMLElementExtendOpt} from './dd-base-impl';
import {Utils} from './utils';
import {DDUIData, GridItemHTMLElement, Rect, Size} from './types';
import {DDManager} from './dd-manager';

// import { GridItemHTMLElement } from './types'; let count = 0; // TEST

// TODO: merge with DDDragOpt
/**
 * 可调整大小组件的配置选项接口
 */
export interface DDResizableOpt {
    /**
     * 当未激活时是否自动隐藏调整手柄
     */
    autoHide?: boolean;

    /**
     * 定义哪些边缘/角落可以用于调整大小（例如:'n,e,s,w,ne,se,sw,nw'）
     */
    handles?: string;

    /**
     * 可调整的最大高度（像素）
     */
    maxHeight?: number;

    /**
     * 向上调整时的最大高度（像素）
     */
    maxHeightMoveUp?: number;

    /**
     * 可调整的最大宽度（像素）
     */
    maxWidth?: number;

    /**
     * 向左调整时的最大宽度（像素）
     */
    maxWidthMoveLeft?: number;

    /**
     * 可调整的最小高度（像素）
     */
    minHeight?: number;

    /**
     * 可调整的最小宽度（像素）
     */
    minWidth?: number;

    /**
     * 调整大小开始时触发的回调函数
     */
    start?: (event: Event, ui: DDUIData) => void;
    /**
     * 调整大小结束时触发的回调函数
     */
    stop?: (event: Event) => void;
    /**
     * 调整大小时触发的回调函数
     */
    resize?: (event: Event, ui: DDUIData) => void;
}

/**
 * 表示矩形缩放的倒数值接口
 */
interface RectScaleReciprocal {
    /** X轴方向的缩放倒数值 */
    x: number;
    /** Y轴方向的缩放倒数值 */
    y: number;
}

/**
 * 可调整大小的拖拽组件类
 * 实现了元素的大小调整功能，支持多个调整手柄和自动隐藏
 *
 * @extends DDBaseImplement
 * @implements HTMLElementExtendOpt<DDResizableOpt>
 *
 * @example
 * ```typescript
 * const resizable = new DDResizable(element, {
 *   handles: 'n,e,s,w',
 *   autoHide: true
 * });
 * ```
 *
 * @property {DDResizableHandle[]} handlers - 调整大小的手柄数组
 * @property {Rect} originalRect - 元素的原始矩形尺寸
 * @property {RectScaleReciprocal} rectScale - 矩形缩放比例
 * @property {GridItemHTMLElement} el - 要调整大小的目标 HTML 元素
 * @property {DDResizableOpt} option - 可调整大小的配置选项
 *
 * @fires resizestart - 开始调整大小时触发
 * @fires resize - 调整大小过程中触发
 * @fires resizestop - 结束调整大小时触发
 *
 * @public
 */
export class DDResizable extends DDBaseImplement implements HTMLElementExtendOpt<DDResizableOpt> {
    /** @internal */
    protected handlers: DDResizableHandle[];
    /** @internal */
    protected originalRect: Rect;
    /** @internal */
    protected rectScale: RectScaleReciprocal = {x: 1, y: 1};
    /** @internal */
    protected temporalRect: Rect;
    /** @internal */
    protected scrollY: number;
    /** @internal */
    protected scrolled: number;
    /** @internal */
    protected scrollEl: HTMLElement;
    /** @internal */
    protected startEvent: MouseEvent;
    /** @internal 保存的值与 _originStyleProp[] 顺序一致 */
    protected elOriginStyleVal: string[];
    /** @internal */
    protected parentOriginStylePosition: string;
    /** @internal */
    protected static _originStyleProp = [
        'width',
        'height',
        'position',
        'left',
        'top',
        'opacity',
        'zIndex'
    ];
    /** @internal */
    protected sizeToContent: boolean;

    // have to be public else complains for HTMLElementExtendOpt ?
    constructor(public el: GridItemHTMLElement, public option: DDResizableOpt = {}) {
        super();
        // 创建变量事件绑定，以便我们可以轻松移除并且仍然看起来像 TS 方法（不像匿名函数）
        this._mouseOver = this._mouseOver.bind(this);
        this._mouseOut = this._mouseOut.bind(this);
        this.enable();
        this._setupAutoHide(this.option.autoHide);
        this._setupHandlers();
    }

    /**
     * 绑定事件监听器
     * @param event - 事件名称 ('resizestart' | 'resize' | 'resizestop')
     * @param callback - 事件触发时的回调函数
     */
    public on(
        event: 'resizestart' | 'resize' | 'resizestop',
        callback: (event: Event) => void
    ): void {
        super.on(event, callback);
    }

    /**
     * 移除事件监听器
     * @param event - 事件名称 ('resizestart' | 'resize' | 'resizestop')
     */
    public off(event: 'resizestart' | 'resize' | 'resizestop'): void {
        super.off(event);
    }

    /**
     * 启用可调整大小功能
     */
    public enable(): void {
        super.enable();
        this.el.classList.remove('ui-resizable-disabled');
        this._setupAutoHide(this.option.autoHide);
    }

    /**
     * 禁用可调整大小功能
     */
    public disable(): void {
        super.disable();
        this.el.classList.add('ui-resizable-disabled');
        this._setupAutoHide(false);
    }

    /**
     * 销毁可调整大小实例，清理资源
     */
    public destroy(): void {
        this._removeHandlers();
        this._setupAutoHide(false);
        delete this.el;
        super.destroy();
    }

    /**
     * 更新可调整大小组件的选项
     * @param opts - 新的配置选项
     * @returns 当前的 DDResizable 实例
     */
    public updateOption(opts: DDResizableOpt): DDResizable {
        const updateHandles = opts.handles && opts.handles !== this.option.handles;
        const updateAutoHide = opts.autoHide && opts.autoHide !== this.option.autoHide;
        Object.keys(opts).forEach((key) => (this.option[key] = opts[key]));
        if (updateHandles) {
            this._removeHandlers();
            this._setupHandlers();
        }
        if (updateAutoHide) {
            this._setupAutoHide(this.option.autoHide);
        }
        return this;
    }

    /**
     * @internal 开启或关闭自动隐藏功能
     * @param auto - 是否启用自动隐藏
     * @returns 当前的 DDResizable 实例
     */
    protected _setupAutoHide(auto: boolean): DDResizable {
        if (auto) {
            this.el.classList.add('ui-resizable-autohide');
            // 使用 mouseover 而不是 mouseenter 以获得更好的性能并支持嵌套情况
            this.el.addEventListener('mouseover', this._mouseOver);
            this.el.addEventListener('mouseout', this._mouseOut);
        } else {
            this.el.classList.remove('ui-resizable-autohide');
            this.el.removeEventListener('mouseover', this._mouseOver);
            this.el.removeEventListener('mouseout', this._mouseOut);
            if (DDManager.overResizeElement === this) {
                delete DDManager.overResizeElement;
            }
        }
        return this;
    }

    /** @internal */
    protected _mouseOver(e: Event): void {
        // 如果已经有一个子元素处于悬停状态，则忽略当前事件。
        if (DDManager.overResizeElement || DDManager.dragElement) return;
        DDManager.overResizeElement = this;
        // 移除自动隐藏的类名以显示调整手柄。
        this.el.classList.remove('ui-resizable-autohide');
    }

    /** @internal */
    protected _mouseOut(e: Event): void {
        // 如果当前悬停的元素不是自身，则忽略当前事件。
        if (DDManager.overResizeElement !== this) return;
        delete DDManager.overResizeElement;
        // 添加自动隐藏的类名以隐藏调整手柄。
        this.el.classList.add('ui-resizable-autohide');
    }

    /**
     * 初始化调整大小的手柄
     * @returns 当前的 DDResizable 实例
     */
    protected _setupHandlers(): DDResizable {
        this.handlers = this.option.handles
            .split(',')
            .map((dir) => dir.trim())
            .map(
                (dir) =>
                    new DDResizableHandle(this.el, dir, {
                        start: (event: MouseEvent) => {
                            this._resizeStart(event);
                        },
                        stop: (event: MouseEvent) => {
                            this._resizeStop(event);
                        },
                        move: (event: MouseEvent) => {
                            this._resizing(event, dir);
                        }
                    })
            );
        return this;
    }

    /** @internal */
    protected _resizeStart(event: MouseEvent): DDResizable {
        this.sizeToContent = Utils.shouldSizeToContent(this.el.gridstackNode, true); // 严格为 true，而不是数字
        this.originalRect = this.el.getBoundingClientRect();
        this.scrollEl = Utils.getScrollElement(this.el);
        this.scrollY = this.scrollEl.scrollTop;
        this.scrolled = 0;
        this.startEvent = event;
        this._setupHelper();
        this._applyChange();
        const ev = Utils.initEvent<MouseEvent>(event, {type: 'resizestart', target: this.el});
        if (this.option.start) {
            this.option.start(ev, this._ui());
        }
        this.el.classList.add('ui-resizable-resizing');
        this.triggerEvent('resizestart', ev);
        return this;
    }

    /** @internal */
    protected _resizing(event: MouseEvent, dir: string): DDResizable {
        this.scrolled = this.scrollEl.scrollTop - this.scrollY;
        this.temporalRect = this._getChange(event, dir);
        this._applyChange();
        const ev = Utils.initEvent<MouseEvent>(event, {type: 'resize', target: this.el});
        if (this.option.resize) {
            this.option.resize(ev, this._ui());
        }
        this.triggerEvent('resize', ev);
        return this;
    }

    /** @internal */
    protected _resizeStop(event: MouseEvent): DDResizable {
        const ev = Utils.initEvent<MouseEvent>(event, {type: 'resizestop', target: this.el});
        // 清理样式属性，以便停止处理程序可以重新构建样式属性
        this._cleanHelper();
        if (this.option.stop) {
            this.option.stop(ev); // 注意：ui() 未被 gridstack 使用，因此不传递
        }
        this.el.classList.remove('ui-resizable-resizing');
        this.triggerEvent('resizestop', ev);
        // 删除临时属性以释放内存
        delete this.startEvent;
        delete this.originalRect;
        delete this.temporalRect;
        delete this.scrollY;
        delete this.scrolled;
        return this;
    }

    /** @internal */
    protected _setupHelper(): DDResizable {
        this.elOriginStyleVal = DDResizable._originStyleProp.map((prop) => this.el.style[prop]);
        this.parentOriginStylePosition = this.el.parentElement.style.position;

        const parent = this.el.parentElement;
        const dragTransform = Utils.getValuesFromTransformedElement(parent);
        this.rectScale = {
            x: dragTransform.xScale,
            y: dragTransform.yScale
        };

        if (getComputedStyle(this.el.parentElement).position === 'static') {
            this.el.parentElement.style.position = 'relative';
        }
        this.el.style.position = 'absolute';
        this.el.style.opacity = '0.8';
        this.el.style.zIndex = '1000'; // 添加 zIndex 以确保调整大小时元素位于顶部
        return this;
    }

    /** @internal */
    protected _cleanHelper(): DDResizable {
        DDResizable._originStyleProp.forEach((prop, i) => {
            this.el.style[prop] = this.elOriginStyleVal[i] || '';
        });
        if (this.parentOriginStylePosition) {
            this.el.parentElement.style.position = this.parentOriginStylePosition;
        } else {
            this.el.parentElement.style.removeProperty('position');
        }
        return this;
    }

    /** @internal */
    protected _getChange(event: MouseEvent, dir: string): Rect {
        const oEvent = this.startEvent;
        const newRect = {
            // 注意：originalRect 是一个复杂对象，而不是简单的 Rect，因此需要复制。
            width: this.originalRect.width,
            height: this.originalRect.height + this.scrolled,
            left: this.originalRect.left,
            top: this.originalRect.top - this.scrolled
        };

        const offsetX = event.clientX - oEvent.clientX;
        const offsetY = this.sizeToContent ? 0 : event.clientY - oEvent.clientY; // 防止垂直调整大小
        let moveLeft: boolean;
        let moveUp: boolean;

        if (dir.includes('e')) {
            newRect.width += offsetX;
        } else if (dir.includes('w')) {
            newRect.width -= offsetX;
            newRect.left += offsetX;
            moveLeft = true;
        }
        if (dir.includes('s')) {
            newRect.height += offsetY;
        } else if (dir.includes('n')) {
            newRect.height -= offsetY;
            newRect.top += offsetY;
            moveUp = true;
        }
        const constrain = this._constrainSize(newRect.width, newRect.height, moveLeft, moveUp);
        if (Math.round(newRect.width) !== Math.round(constrain.width)) {
            // 四舍五入以忽略轻微的舍入误差
            if (dir.includes('w')) {
                newRect.left += newRect.width - constrain.width;
            }
            newRect.width = constrain.width;
        }
        if (Math.round(newRect.height) !== Math.round(constrain.height)) {
            if (dir.includes('n')) {
                newRect.top += newRect.height - constrain.height;
            }
            newRect.height = constrain.height;
        }
        return newRect;
    }

    /** @internal 约束尺寸到设置的最小/最大值 */
    protected _constrainSize(
        oWidth: number,
        oHeight: number,
        moveLeft: boolean,
        moveUp: boolean
    ): Size {
        const o = this.option;
        const maxWidth = (moveLeft ? o.maxWidthMoveLeft : o.maxWidth) ?? Number.MAX_SAFE_INTEGER;
        const minWidth = (o.minWidth ?? 0) / this.rectScale.x;
        const maxHeight = (moveUp ? o.maxHeightMoveUp : o.maxHeight) ?? Number.MAX_SAFE_INTEGER;
        const minHeight = (o.minHeight ?? 0) / this.rectScale.y;
        const width = Math.min(maxWidth, Math.max(minWidth, oWidth));
        const height = Math.min(maxHeight, Math.max(minHeight, oHeight));
        return {width, height};
    }

    /** @internal */
    protected _applyChange(): DDResizable {
        let containmentRect = {left: 0, top: 0, width: 0, height: 0};
        if (this.el.style.position === 'absolute') {
            const containmentEl = this.el.parentElement;
            const {left, top} = containmentEl.getBoundingClientRect();
            containmentRect = {left, top, width: 0, height: 0};
        }
        if (!this.temporalRect) return this;
        Object.keys(this.temporalRect).forEach((key) => {
            const value = this.temporalRect[key];
            const scaleReciprocal =
                key === 'width' || key === 'left'
                    ? this.rectScale.x
                    : key === 'height' || key === 'top'
                    ? this.rectScale.y
                    : 1;
            this.el.style[key] = (value - containmentRect[key]) * scaleReciprocal + 'px';
        });
        return this;
    }

    /** @internal */
    protected _removeHandlers(): DDResizable {
        this.handlers.forEach((handle) => handle.destroy());
        delete this.handlers;
        return this;
    }
    /** @internal */
    protected _ui = (): DDUIData => {
        const containmentEl = this.el.parentElement;
        const containmentRect = containmentEl.getBoundingClientRect();
        const newRect = {
            // 注意：originalRect 是一个复杂对象，而不是简单的 Rect，因此需要复制。
            width: this.originalRect.width,
            height: this.originalRect.height + this.scrolled,
            left: this.originalRect.left,
            top: this.originalRect.top - this.scrolled
        };
        const rect = this.temporalRect || newRect;
        return {
            position: {
                left: (rect.left - containmentRect.left) * this.rectScale.x,
                top: (rect.top - containmentRect.top) * this.rectScale.y
            },
            size: {
                width: rect.width * this.rectScale.x,
                height: rect.height * this.rectScale.y
            }
            /* Gridstack 仅需要上面设置的 position... 保留以备不时之需。
      element: [this.el], // 表示要调整大小的元素的对象
      helper: [], // TODO: 尚未支持 - 表示正在调整大小的辅助对象
      originalElement: [this.el], // 我们不在此处包装，因此简化为 this.el // 表示调整大小之前的原始元素的对象
      originalPosition: { // 表示调整大小之前的 { left, top } 位置
      left: this.originalRect.left - containmentRect.left,
      top: this.originalRect.top - containmentRect.top
      },
      originalSize: { // 表示调整大小之前的 { width, height } 尺寸
      width: this.originalRect.width,
      height: this.originalRect.height
      }
      */
        };
    };
}
