/**
 * dd-resizable-handle.ts 11.5.0-dev
 * Copyright (c) 2021-2024  Alain Dumesny - see GridStack root license
 */

import {isTouch, pointerdown, touchend, touchmove, touchstart} from './dd-touch';
import {GridItemHTMLElement} from './gridstack';

export interface DDResizableHandleOpt {
    /** 开始调整大小时触发的回调函数 */
    start?: (event) => void;
    /** 调整大小过程中触发的回调函数 */
    move?: (event) => void;
    /** 结束调整大小时触发的回调函数 */
    stop?: (event) => void;
}
export class DDResizableHandle {
    /** @internal */
    protected el: HTMLElement;
    /** @internal 在移动足够像素开始调整大小后为 true */
    protected moving = false;
    /** @internal */
    protected mouseDownEvent: MouseEvent;
    /** @internal */
    protected static prefix = 'ui-resizable-';

    /**
     * 为网格项创建一个新的可调整大小的句柄。
     * @param host - 将要变为可调整大小的网格项 HTML 元素
     * @param dir - 调整大小句柄的方向/方位
     * @param option - 可调整大小句柄的配置选项
     *
     * 构造函数初始化事件绑定（确保正确的 this 上下文），
     * 并通过调用内部 _init() 方法来设置调整大小句柄。
     */
    constructor(
        protected host: GridItemHTMLElement,
        protected dir: string,
        protected option: DDResizableHandleOpt
    ) {
        this._mouseDown = this._mouseDown.bind(this);
        this._mouseMove = this._mouseMove.bind(this);
        this._mouseUp = this._mouseUp.bind(this);
        this._keyEvent = this._keyEvent.bind(this);

        this._init();
    }

    /** @internal */
    protected _init(): DDResizableHandle {
        const el = (this.el = document.createElement('div'));
        el.classList.add('ui-resizable-handle');
        el.classList.add(`${DDResizableHandle.prefix}${this.dir}`);
        el.style.zIndex = '100';
        el.style.userSelect = 'none';
        this.host.appendChild(this.el);
        this.el.addEventListener('mousedown', this._mouseDown);

        if (isTouch) {
            this.el.addEventListener('touchstart', touchstart);
            this.el.addEventListener('pointerdown', pointerdown);
        }
        return this;
    }

    public destroy(): DDResizableHandle {
        if (this.moving) this._mouseUp(this.mouseDownEvent);
        this.el.removeEventListener('mousedown', this._mouseDown);
        if (isTouch) {
            this.el.removeEventListener('touchstart', touchstart);
            this.el.removeEventListener('pointerdown', pointerdown);
        }
        this.host.removeChild(this.el);
        delete this.el;
        delete this.host;
        return this;
    }

    /** @internal */
    protected _mouseDown(e: MouseEvent): void {
        this.mouseDownEvent = e;
        document.addEventListener('mousemove', this._mouseMove, {capture: true, passive: true});
        document.addEventListener('mouseup', this._mouseUp, true);
        if (isTouch) {
            this.el.addEventListener('touchmove', touchmove);
            this.el.addEventListener('touchend', touchend);
        }
        e.stopPropagation();
        e.preventDefault();
    }

    /** @internal */
    protected _mouseMove(e: MouseEvent): void {
        const s = this.mouseDownEvent;
        if (this.moving) {
            this._triggerEvent('move', e);
        } else if (Math.abs(e.x - s.x) + Math.abs(e.y - s.y) > 2) {
            this.moving = true;
            this._triggerEvent('start', this.mouseDownEvent);
            this._triggerEvent('move', e);
            document.addEventListener('keydown', this._keyEvent);
        }
        e.stopPropagation();
    }

    /** @internal */
    protected _mouseUp(e: MouseEvent): void {
        if (this.moving) {
            this._triggerEvent('stop', e);
            document.removeEventListener('keydown', this._keyEvent);
        }
        document.removeEventListener('mousemove', this._mouseMove, true);
        document.removeEventListener('mouseup', this._mouseUp, true);
        if (isTouch) {
            this.el.removeEventListener('touchmove', touchmove);
            this.el.removeEventListener('touchend', touchend);
        }
        delete this.moving;
        delete this.mouseDownEvent;
        e.stopPropagation();
        e.preventDefault();
    }

    /** @internal */
    protected _keyEvent(e: KeyboardEvent): void {
        if (e.key === 'Escape') {
            this.host.gridstackNode?.grid?.engine.restoreInitial();
            this._mouseUp(this.mouseDownEvent);
        }
    }

    /** @internal */
    protected _triggerEvent(name: string, event: MouseEvent): DDResizableHandle {
        if (this.option[name]) this.option[name](event);
        return this;
    }
}
