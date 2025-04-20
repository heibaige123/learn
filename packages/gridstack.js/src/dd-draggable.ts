/**
 * dd-draggable.ts 12.0.0-dev
 * Copyright (c) 2021-2024  Alain Dumesny - see GridStack root license
 */

import {DDManager} from './dd-manager';
import {DragTransform, Utils} from './utils';
import {DDBaseImplement, HTMLElementExtendOpt} from './dd-base-impl';
import {GridItemHTMLElement, DDUIData, GridStackNode, GridStackPosition, DDDragOpt} from './types';
import {DDElementHost} from './dd-element';
import {isTouch, touchend, touchmove, touchstart, pointerdown} from './dd-touch';
import {GridHTMLElement} from './gridstack';

/** 拖拽对象偏移量接口 */
interface DragOffset {
    /** 元素左边距离视口左边的距离 */
    left: number;
    /** 元素顶部距离视口顶部的距离 */
    top: number;
    /** 元素宽度（考虑了缩放比例） */
    width: number;
    /** 元素高度（考虑了缩放比例） */
    height: number;
    /** 鼠标位置相对元素左边的偏移量 */
    offsetLeft: number;
    /** 鼠标位置相对元素顶部的偏移量 */
    offsetTop: number;
}

/** 网格节点旋转接口，继承自GridStackNode */
interface GridStackNodeRotate extends GridStackNode {
    /** 原始旋转位置信息 */
    _origRotate?: GridStackPosition;
}

/** 拖拽事件类型 */
type DDDragEvent = 'drag' | 'dragstart' | 'dragstop';

/**
 * make sure we are not clicking on known object that handles mouseDown
 *
 * CSS选择器字符串，用于定义在拖拽操作中需要跳过的HTML元素
 *
 * 包含以下元素：
 * - input：输入框
 * - textarea：文本域
 * - button：按钮
 * - select：下拉选择框
 * - option：下拉选项
 * - [contenteditable="true"]：可编辑内容的元素
 * - .ui-resizable-handle：可调整大小的UI句柄
 *
 * 当用户在这些元素上点击时，不会触发拖拽操作
 */
const skipMouseDown =
    'input,textarea,button,select,option,[contenteditable="true"],.ui-resizable-handle';

// let count = 0; // TEST

/**
 * 一个可拖拽元素的封装类，提供了对 HTML 元素的拖拽功能实现。
 * 继承自 DDBaseImplement 类并实现 HTMLElementExtendOpt<DDDragOpt> 接口。
 *
 * 主要功能：
 * - 处理鼠标/触摸事件实现拖拽
 * - 支持拖拽助手（helper）元素
 * - 支持拖拽约束和边界
 * - 支持拖拽过程中的各种事件回调
 * - 支持键盘交互（Esc取消、R旋转）
 *
 * @example
 * ```typescript
 * const dragEl = document.querySelector('.draggable');
 * const dragInstance = new DDDraggable(dragEl, {
 *   handle: '.drag-handle',
 *   helper: 'clone'
 * });
 * ```
 *
 * 配置选项包括：
 * - handle: 指定拖拽手柄元素的选择器
 * - cancel: 指定不触发拖拽的元素选择器
 * - appendTo: 指定helper元素要附加到的父元素
 * - helper: 可以是 'clone' 或返回元素的函数
 * - start: 拖拽开始回调
 * - drag: 拖拽过程回调
 * - stop: 拖拽结束回调
 */
export class DDDraggable extends DDBaseImplement implements HTMLElementExtendOpt<DDDragOpt> {
    /**
     * HTML 元素的拖拽辅助器，由 GridStackDDNative 内部使用。
     * 用于在拖拽过程中提供视觉反馈或替代原始元素。
     */
    public helper: HTMLElement; // 被 GridStackDDNative 使用

    /**
     * @internal
     *
     * 存储最近一次的鼠标按下事件。
     * 当用户在元素上按下鼠标按键时被设置，用于跟踪拖拽操作的起始点。
     */
    protected mouseDownEvent: MouseEvent;

    /**
     * @internal
     *
     * 拖拽过程中用于存储偏移量的对象。
     *
     * - 包括相对于X轴和Y轴的位置偏移值
     * - 包括初始拖拽点相对于目标元素的偏移位置
     */
    protected dragOffset: DragOffset;

    /**
     * @internal 拖拽元素原始样式的存储数组
     * 用于在拖拽结束时恢复元素的初始样式
     */
    protected dragElementOriginStyle: Record<string, string>;

    /**
     * @internal 要拖拽的HTML元素数组
     * */
    protected dragEls: HTMLElement[];

    /**
     *  @internal 当我们正在拖动项目时为true */
    protected dragging: boolean;

    /**
     * @internal 最后一次拖拽事件
     * 用于存储最近一次触发的拖拽事件对象。
     * 在拖拽过程中，此属性会被更新为最新的拖拽事件，
     * 以便在需要时访问事件的相关信息。
     */
    protected lastDrag: DragEvent;

    /**
     * @internal 父元素原始样式位置
     * 用于存储拖拽元素父容器的原始 position 样式值。
     * 在拖拽过程中可能会临时修改父容器的 position 样式，
     * 拖拽结束后需要恢复为原始值。
     */
    protected parentOriginStylePosition: string | null;

    /**
     * @internal 助手元素的容器
     * 用于存储拖拽助手元素的父容器引用。
     * 在拖拽过程中，助手元素的样式和位置会基于此容器进行计算和调整。
     */
    protected helperContainment: HTMLElement;

    /**
     * @internal 拖拽过程中更改并在之后恢复的样式属性
     *
     * 这些属性在拖拽过程中可能会被修改，
     * 拖拽结束后需要恢复到原始状态。
     */
    protected static originStyleProp: Array<keyof CSSStyleDeclaration> = [
        'width',
        'height',
        'transform',
        'transformOrigin',
        'transition',
        'pointerEvents',
        'position',
        'left',
        'top',
        'minWidth',
        'willChange'
    ];

    /**
     * 用于存储拖拽操作的超时计时器ID
     * 在拖拽事件处理过程中用于控制时间延迟
     */
    protected dragTimeout: number | undefined;

    /**
     * @internal
     *
     * 拖拽变换参数对象，用于控制拖拽元素的缩放和偏移
     * @property {number} xScale - X轴缩放比例
     * @property {number} yScale - Y轴缩放比例
     * @property {number} xOffset - X轴偏移量(像素)
     * @property {number} yOffset - Y轴偏移量(像素)
     */
    protected dragTransform: DragTransform = {
        xScale: 1,
        yScale: 1,
        xOffset: 0,
        yOffset: 0
    };

    /**
     * 创建一个新的拖拽实例
     * @param el 需要拖拽的网格项HTML元素
     * @param option 拖拽选项配置对象
     *
     * @description
     * 构造函数完成以下初始化工作:
     * 1. 确定实际要拖拽的元素(可以是单个元素或多个句柄元素)
     * 2. 处理句柄选择器的情况
     * 3. 绑定鼠标和键盘事件处理器
     * 4. 启用拖拽功能
     *
     * @example
     * ```typescript
     * const dragInstance = new DDDraggable(gridElement, {
     *   handle: '.drag-handle'
     * });
     * ```
     */
    constructor(public el: GridItemHTMLElement, public option: DDDragOpt = {}) {
        super();

        // 获取实际需要拖拽的元素，可以是单个元素或多个句柄元素
        const handleName = option?.handle?.substring(1);
        const n = el.gridstackNode;
        this.dragEls =
            !handleName || el.classList.contains(handleName)
                ? [el]
                : n?.subGrid
                ? [el.querySelector(option.handle) || el]
                : Array.from(el.querySelectorAll(option.handle));
        if (this.dragEls.length === 0) {
            this.dragEls = [el];
        }

        // 创建事件绑定，便于后续移除，同时保持TS方法的外观
        this._mouseDown = this._mouseDown.bind(this);
        this._mouseMove = this._mouseMove.bind(this);
        this._mouseUp = this._mouseUp.bind(this);
        this._keyEvent = this._keyEvent.bind(this);

        // 启用拖拽功能
        this.enable();
    }

    /**
     * 为拖拽事件绑定回调函数
     * @param event - 拖拽事件类型，如 'dragstart'、'drag'、'dragend' 等
     * @param callback - 拖拽事件触发时要执行的回调函数
     * @returns void
     * @fires DDDragEvent 当拖拽事件发生时触发
     * @inheritdoc 继承自父类的事件监听方法
     */
    public on(event: DDDragEvent, callback: (event: DragEvent) => void): void {
        super.on(event, callback);
    }

    /**
     * 取消注册事件监听器
     *
     * @param event - 要取消注册的拖拽事件
     * @returns 无返回值
     *
     * @extends 继承自父类的off方法
     *
     * @remarks
     * 此方法用于移除之前通过on()方法注册的拖拽事件监听器。
     * 它会调用父类的off方法来执行实际的事件监听器移除操作。
     */
    public off(event: DDDragEvent): void {
        super.off(event);
    }

    /**
     * 启用拖拽功能。
     * 如果拖拽功能已经启用，则直接返回。
     * 否则，为所有拖拽元素添加相关的事件监听器（鼠标和触摸事件），
     * 并移除禁用状态的样式类。
     *
     * @remarks
     * 此方法会为每个拖拽元素添加以下事件监听器：
     * - mousedown：处理鼠标按下事件
     * - touchstart：处理触摸开始事件（仅在触摸设备上）
     * - pointerdown：处理指针按下事件（仅在触摸设备上）
     *
     * @override
     * 重写父类的 enable 方法
     *
     * @returns void
     */
    public enable(): void {
        if (this.disabled === false) return;
        super.enable();
        this.dragEls.forEach((dragEl) => {
            dragEl.addEventListener('mousedown', this._mouseDown);
            if (isTouch) {
                dragEl.addEventListener('touchstart', touchstart);
                dragEl.addEventListener('pointerdown', pointerdown);
                // dragEl.style.touchAction = 'none'; // not needed unlike pointerdown doc comment
            }
        });
        this.el.classList.remove('ui-draggable-disabled');
    }

    /**
     * 禁用拖拽功能。
     * 如果拖拽功能已经禁用，则直接返回。
     * 否则，为所有拖拽元素移除相关的事件监听器（鼠标和触摸事件），
     * 并添加禁用状态的样式类。
     *
     * @param forDestroy - 是否用于销毁操作，默认为 false。
     * 如果为 true，则不会添加禁用状态的样式类。
     *
     * @override
     * 重写父类的 disable 方法
     *
     * @returns void
     */
    public disable(forDestroy = false): void {
        if (this.disabled === true) return;
        super.disable();
        this.dragEls.forEach((dragEl) => {
            dragEl.removeEventListener('mousedown', this._mouseDown);
            if (isTouch) {
                dragEl.removeEventListener('touchstart', touchstart);
                dragEl.removeEventListener('pointerdown', pointerdown);
            }
        });
        if (!forDestroy) this.el.classList.add('ui-draggable-disabled');
    }

    /**
     * 销毁拖拽实例并清理所有相关资源
     *
     * 该方法执行以下清理操作：
     * - 清除所有定时器
     * - 清理未完成的拖拽操作
     * - 禁用拖拽功能
     * - 删除元素引用
     * - 删除辅助元素
     * - 删除配置选项
     * - 调用父类销毁方法
     */
    public destroy(): void {
        if (this.dragTimeout) window.clearTimeout(this.dragTimeout);
        delete this.dragTimeout;
        if (this.mouseDownEvent) this._mouseUp(this.mouseDownEvent);
        this.disable(true);
        delete this.el;
        delete this.helper;
        delete this.option;
        super.destroy();
    }

    /**
     * 更新拖拽选项配置
     * @param opts - 新的拖拽选项配置对象
     * @returns 返回当前 DDDraggable 实例以支持链式调用
     * @description 通过传入的选项对象更新现有的拖拽配置。这个方法会遍历传入对象的所有属性，
     * 并用这些新的属性值更新当前实例的选项配置。
     */
    public updateOption(opts: DDDragOpt): DDDraggable {
        Object.keys(opts).forEach((key) => (this.option[key] = opts[key]));
        return this;
    }

    /**
     * 处理鼠标按下事件的受保护方法
     *
     * 该方法实现了以下功能：
     * - 确保只处理左键点击事件
     * - 验证点击目标是否在允许的元素范围内
     * - 设置必要的事件监听器（mousemove, mouseup, 触摸事件等）
     * - 阻止默认事件行为并处理焦点
     *
     * @param e - 鼠标事件对象
     * @returns {boolean}
     *   - 如果事件已被处理或不应被处理，返回 true
     *   - 如果事件被成功处理并设置了事件监听器，返回 true
     *
     * @protected
     *
     * @remarks
     * - 使用 DDManager.mouseHandled 确保同一时间只有一个组件处理鼠标事件
     * - 支持触摸设备，会额外添加触摸相关的事件监听
     * - 会自动移除当前活动元素的焦点
     */
    protected _mouseDown(e: MouseEvent): boolean {
        // don't let more than one widget handle mouseStart
        if (DDManager.mouseHandled) return;
        if (e.button !== 0) return true; // only left click

        // make sure we are not clicking on known object that handles mouseDown, or ones supplied by the user
        if (
            !this.dragEls.find((el) => el === e.target) &&
            (e.target as HTMLElement).closest(skipMouseDown)
        )
            return true;
        if (this.option.cancel) {
            if ((e.target as HTMLElement).closest(this.option.cancel)) return true;
        }

        this.mouseDownEvent = e;
        delete this.dragging;
        delete DDManager.dragElement;
        delete DDManager.dropElement;
        // document handler so we can continue receiving moves as the item is 'fixed' position, and capture=true so WE get a first crack
        document.addEventListener('mousemove', this._mouseMove, {capture: true, passive: true}); // true=capture, not bubble
        document.addEventListener('mouseup', this._mouseUp, true);
        if (isTouch) {
            e.currentTarget.addEventListener('touchmove', touchmove);
            e.currentTarget.addEventListener('touchend', touchend);
        }

        e.preventDefault();
        // preventDefault() prevents blur event which occurs just after mousedown event.
        // if an editable content has focus, then blur must be call
        if (document.activeElement) (document.activeElement as HTMLElement).blur();

        DDManager.mouseHandled = true;
        return true;
    }

    /**
     * 在拖拽过程中调用拖拽事件处理函数
     *
     * 当正在进行拖拽操作时,此方法会:
     * 1. 初始化一个拖拽事件对象
     * 2. 如果配置了drag回调函数,则调用它
     * 3. 触发'drag'事件
     *
     * @param e - 原生的DragEvent事件对象
     * @protected
     *
     * @remarks
     * - 如果没有正在进行的拖拽操作(dragging为false),此方法会直接返回
     * - 事件对象会被初始化,target设置为当前元素,type设置为'drag'
     * - 会调用配置的drag回调函数(如果存在),并传入事件对象和当前UI状态
     */
    protected _callDrag(e: DragEvent): void {
        if (!this.dragging) return;
        const ev = Utils.initEvent<DragEvent>(e, {target: this.el, type: 'drag'});
        if (this.option.drag) {
            this.option.drag(ev, this.ui());
        }
        this.triggerEvent('drag', ev);
    }

    /**
     * 处理鼠标移动事件的监听函数
     *
     * 该函数处理拖拽过程中的鼠标移动,包括以下主要功能:
     * - 如果已经在拖拽中,会触发拖拽跟随和拖拽回调
     * - 如果是拖拽开始(移动超过3像素),会初始化拖拽相关的状态和辅助元素
     * - 支持拖拽延迟处理
     *
     * @param e - 拖拽事件对象
     * @returns {boolean} - 返回true表示事件已处理
     *
     * @example
     * // 内部方法,通常不需要直接调用
     * this._mouseMove(dragEvent);
     */
    protected _mouseMove(e: DragEvent): boolean {
        const s = this.mouseDownEvent;
        this.lastDrag = e;

        if (this.dragging) {
            this._dragFollow(e);
            if (DDManager.pauseDrag) {
                const pause = Number.isInteger(DDManager.pauseDrag)
                    ? (DDManager.pauseDrag as number)
                    : 100;
                if (this.dragTimeout) window.clearTimeout(this.dragTimeout);
                this.dragTimeout = window.setTimeout(() => this._callDrag(e), pause);
            } else {
                this._callDrag(e);
            }
        } else if (Math.abs(e.clientX - s.clientX) + Math.abs(e.clientY - s.clientY) > 3) {
            /**
             * 不开始拖拽，除非移动超过3像素
             */
            this.dragging = true;
            DDManager.dragElement = this;
            const grid = this.el.gridstackNode?.grid;
            if (grid) {
                DDManager.dropElement = (grid.el as DDElementHost).ddElement.ddDroppable;
            } else {
                delete DDManager.dropElement;
            }
            this.helper = this._createHelper();
            this._setupHelperContainmentStyle();
            this.dragTransform = Utils.getValuesFromTransformedElement(this.helperContainment);
            this.dragOffset = this._getDragOffset(e, this.el, this.helperContainment);
            this._setupHelperStyle(e);

            const ev = Utils.initEvent<DragEvent>(e, {target: this.el, type: 'dragstart'});
            if (this.option.start) {
                this.option.start(ev, this.ui());
            }
            this.triggerEvent('dragstart', ev);
            document.addEventListener('keydown', this._keyEvent);
        }
        return true;
    }

    /**
     * 处理鼠标抬起（或触摸结束）事件的方法
     *
     * 该方法执行以下操作：
     * 1. 移除所有相关的事件监听器（mousemove, mouseup, touchmove, touchend）
     * 2. 清理拖拽状态和相关数据
     * 3. 重置元素的样式和位置
     * 4. 处理拖拽停止事件
     * 5. 处理元素放置（drop）操作
     *
     * @protected
     * @param e - 鼠标事件或触摸事件对象
     * @remarks
     * - 如果元素正在拖拽中，会触发 dragstop 事件
     * - 如果存在放置目标（dropElement），会执行放置操作
     * - 方法执行完成后会清理所有相关的临时状态和引用
     *
     * @fires dragstop - 当拖拽操作结束时触发
     */
    protected _mouseUp(e: MouseEvent): void {
        document.removeEventListener('mousemove', this._mouseMove, true);
        document.removeEventListener('mouseup', this._mouseUp, true);
        if (isTouch && e.currentTarget) {
            // destroy() during nested grid call us again wit fake _mouseUp
            e.currentTarget.removeEventListener('touchmove', touchmove, true);
            e.currentTarget.removeEventListener('touchend', touchend, true);
        }
        if (this.dragging) {
            delete this.dragging;
            delete (this.el.gridstackNode as GridStackNodeRotate)?._origRotate;
            document.removeEventListener('keydown', this._keyEvent);

            // reset the drop target if dragging over ourself (already parented, just moving during stop callback below)
            if (DDManager.dropElement?.el === this.el.parentElement) {
                delete DDManager.dropElement;
            }

            this.helperContainment.style.position = this.parentOriginStylePosition || null;
            if (this.helper !== this.el) this.helper.remove(); // hide now
            this._removeHelperStyle();

            const ev = Utils.initEvent<DragEvent>(e, {target: this.el, type: 'dragstop'});
            if (this.option.stop) {
                this.option.stop(ev); // NOTE: destroy() will be called when removing item, so expect NULL ptr after!
            }
            this.triggerEvent('dragstop', ev);

            // call the droppable method to receive the item
            if (DDManager.dropElement) {
                DDManager.dropElement.drop(e);
            }
        }
        delete this.helper;
        delete this.mouseDownEvent;
        delete DDManager.dragElement;
        delete DDManager.dropElement;
        delete DDManager.mouseHandled;
        e.preventDefault();
    }

    /**
     * 处理键盘事件
     * - 当按下 'Escape' 键时：
     *   - 如果存在原始旋转状态，则恢复到原始状态
     *   - 取消拖拽操作
     *   - 触发鼠标抬起事件
     * - 当按下 'r' 或 'R' 键时：
     *   - 检查节点是否可以旋转
     *   - 保存原始旋转状态
     *   - 执行旋转操作
     *   - 更新拖拽偏移量和辅助元素尺寸
     *   - 交换原始宽高值
     *   - 触发鼠标移动事件
     *
     * @param e - 键盘事件对象
     * @protected
     */
    protected _keyEvent(e: KeyboardEvent): void {
        const n = this.el.gridstackNode as GridStackNodeRotate;
        const grid = n?.grid || (DDManager.dropElement?.el as GridHTMLElement)?.gridstack;

        if (e.key === 'Escape') {
            if (n && n._origRotate) {
                n._orig = n._origRotate;
                delete n._origRotate;
            }
            grid?.cancelDrag();
            this._mouseUp(this.mouseDownEvent);
        } else if (n && grid && (e.key === 'r' || e.key === 'R')) {
            if (!Utils.canBeRotated(n)) return;
            n._origRotate = n._origRotate || {...n._orig}; // store the real orig size in case we Esc after doing rotation
            delete n._moving; // force rotate to happen (move waits for >50% coverage otherwise)
            grid.setAnimation(false) // immediate rotate so _getDragOffset() gets the right dom size below
                .rotate(n.el, {top: -this.dragOffset.offsetTop, left: -this.dragOffset.offsetLeft})
                .setAnimation();
            n._moving = true;
            this.dragOffset = this._getDragOffset(this.lastDrag, n.el, this.helperContainment);
            this.helper.style.width = this.dragOffset.width + 'px';
            this.helper.style.height = this.dragOffset.height + 'px';
            Utils.swap(n._orig, 'w', 'h');
            delete n._rect;
            this._mouseMove(this.lastDrag);
        }
    }

    /**
     * 根据配置创建拖拽助手元素。
     *
     * 助手元素可以是:
     * - 原始元素本身
     * - 通过helper函数返回的元素
     * - 原始元素的克隆体
     *
     * @returns 创建的助手HTMLElement元素
     *
     * @remarks
     * 如果助手元素没有父元素,会根据appendTo选项将其添加到DOM中:
     * - 'parent': 添加到原始元素的父元素
     * - 其他值: 直接添加到指定的appendTo元素
     *
     * 在创建助手元素时会保存原始元素的样式属性,以便后续恢复。
     */
    protected _createHelper(): HTMLElement {
        let helper = this.el;
        if (typeof this.option.helper === 'function') {
            helper = this.option.helper(this.el);
        } else if (this.option.helper === 'clone') {
            helper = Utils.cloneNode(this.el);
        }
        if (!helper.parentElement) {
            const appendTarget =
                this.option.appendTo === 'parent' ? this.el.parentElement : this.option.appendTo;
            Utils.appendTo(helper, appendTarget);
        }
        this.dragElementOriginStyle = DDDraggable.originStyleProp.reduce((styleMap, prop) => {
            styleMap[prop] = this.el.style[prop] as string;
            return styleMap;
        }, {} as Record<string, string>);
        return helper;
    }

    /**
     * @internal 设置辅助元素的样式
     *
     * 该方法完成以下设置:
     * - 添加拖拽中的CSS类
     * - 设置pointer-events为none以允许鼠标事件穿透到下方元素
     * - 根据拖拽偏移量设置宽高
     * - 设置willChange优化属性
     * - 设置position为fixed以支持跨网格拖拽
     * - 立即定位到鼠标位置
     * - 临时禁用过渡动画然后恢复
     *
     * @param e - 拖拽事件对象
     * @returns 当前实例以支持链式调用
     * @protected
     */
    protected _setupHelperStyle(e: DragEvent): DDDraggable {
        // 添加拖拽状态的CSS类
        this.helper.classList.add('ui-draggable-dragging');

        // TODO: 考虑使用style.cssText一次性设置所有样式？
        const style = this.helper.style;

        // 允许鼠标事件穿透到下方元素,用于检测enter/leave事件
        style.pointerEvents = 'none';

        // 设置helper元素的尺寸
        style.width = this.dragOffset.width + 'px';
        style.height = this.dragOffset.height + 'px';

        // 优化渲染性能
        style.willChange = 'left, top';

        // 使用fixed定位以支持跨网格拖拽
        style.position = 'fixed';

        // 定位到当前鼠标位置
        this._dragFollow(e);

        // 暂时禁用过渡动画
        style.transition = 'none';

        // 延时恢复过渡动画
        setTimeout(() => {
            if (this.helper) {
                style.transition = null;
            }
        }, 0);

        return this;
    }

    /**
     * 该方法执行以下操作:
     * - 移除拖拽时添加的 'ui-draggable-dragging' 类
     * - 如果元素不会被移除且存在原始样式,则还原元素的原始样式
     * - 处理样式过渡动画,防止在切换定位方式时出现偏移
     * - 清除保存的原始样式引用
     *
     * @returns {DDDraggable} 返回当前 DDDraggable 实例,支持链式调用
     *
     * @remarks
     * 该方法在拖拽结束时被调用,用于清理拖拽过程中添加的临时样式。
     * 为了避免动画问题,会暂时禁用过渡效果,并在短暂延时后恢复。
     *
     * @internal
     * 这是一个受保护的方法,仅供内部使用。
     */
    protected _removeHelperStyle(): DDDraggable {
        this.helper.classList.remove('ui-draggable-dragging');
        const node = (this.helper as GridItemHTMLElement)?.gridstackNode;
        // don't bother restoring styles if we're gonna remove anyway...
        if (!node?._isAboutToRemove && this.dragElementOriginStyle) {
            const helper = this.helper;
            // don't animate, otherwise we animate offseted when switching back to 'absolute' from 'fixed'.
            // TODO: this also removes resizing animation which doesn't have this issue, but others.
            // Ideally both would animate ('move' would immediately restore 'absolute' and adjust coordinate to match,
            // then trigger a delay (repaint) to restore to final dest with animate) but then we need to make sure 'resizestop'
            // is called AFTER 'transitionend' event is received (see https://github.com/gridstack/gridstack.js/issues/2033)
            const transition = this.dragElementOriginStyle['transition'] || null;
            helper.style.transition = this.dragElementOriginStyle['transition'] = 'none'; // can't be NULL #1973
            DDDraggable.originStyleProp.forEach(
                // @ts-ignore
                (prop) => (helper.style[prop] = this.dragElementOriginStyle[prop] || null)
            );
            setTimeout(() => (helper.style.transition = transition), 50); // recover animation from saved vars after a pause (0 isn't enough #1973)
        }
        delete this.dragElementOriginStyle;
        return this;
    }

    /**
     * 在拖拽过程中更新被拖拽元素(helper)的位置
     *
     * @param e - 拖拽事件对象
     * @protected
     *
     * @remarks
     * 此方法根据鼠标的当前位置(clientX/clientY)和预设的偏移量(dragOffset)计算并设置helper元素的新位置。
     * 计算时会考虑拖拽变换比例(dragTransform)来调整最终位置。
     *
     * helper元素的位置通过设置style的left和top属性来更新。
     * containmentRect用于处理元素容器的边界，当前默认值为{left: 0, top: 0}。
     */
    protected _dragFollow(e: DragEvent): void {
        const containmentRect = {left: 0, top: 0};
        // if (this.helper.style.position === 'absolute') { // we use 'fixed'
        //   const { left, top } = this.helperContainment.getBoundingClientRect();
        //   containmentRect = { left, top };
        // }
        const style = this.helper.style;
        const offset = this.dragOffset;
        style.left =
            (e.clientX + offset.offsetLeft - containmentRect.left) * this.dragTransform.xScale +
            'px';
        style.top =
            (e.clientY + offset.offsetTop - containmentRect.top) * this.dragTransform.yScale + 'px';
    }

    /**
     * 设置帮助元素的容器样式
     *
     * 主要功能:
     * - 获取并存储帮助元素的父容器
     * - 如果帮助元素不是fixed定位,检查父容器的定位
     * - 如果父容器是static定位,将其改为relative定位
     * - 保存父容器原始的position样式值
     *
     * @returns 当前DDDraggable实例,支持链式调用
     * @protected
     */
    protected _setupHelperContainmentStyle(): DDDraggable {
        this.helperContainment = this.helper.parentElement;
        if (this.helper.style.position !== 'fixed') {
            this.parentOriginStylePosition = this.helperContainment.style.position;
            if (getComputedStyle(this.helperContainment).position.match(/static/)) {
                this.helperContainment.style.position = 'relative';
            }
        }
        return this;
    }

    /**
     * 获取拖拽元素的偏移量信息
     *
     * 该方法计算拖拽元素相对于视口和鼠标位置的各种偏移量
     *
     * @param event - 拖拽事件对象
     * @param el - 要拖拽的元素
     * @param parent - 拖拽元素的父元素
     * @returns {DragOffset} 包含以下属性的偏移量对象:
     * - left: 元素左边距离视口左边的距离
     * - top: 元素顶部距离视口顶部的距离
     * - offsetLeft: 鼠标位置相对元素左边的偏移量
     * - offsetTop: 鼠标位置相对元素顶部的偏移量
     * - width: 元素宽度(考虑了缩放比例)
     * - height: 元素高度(考虑了缩放比例)
     *
     * @protected
     */
    protected _getDragOffset(event: DragEvent, el: HTMLElement, parent: HTMLElement): DragOffset {
        // 处理祖先元素可能具有的transform/perspective CSS属性导致的视点变化
        let xformOffsetX = 0;
        let xformOffsetY = 0;
        if (parent) {
            xformOffsetX = this.dragTransform.xOffset;
            xformOffsetY = this.dragTransform.yOffset;
        }

        // 获取目标元素的边界矩形
        const targetOffset = el.getBoundingClientRect();

        // 返回计算得到的偏移量信息
        return {
            left: targetOffset.left,
            top: targetOffset.top,
            offsetLeft: -event.clientX + targetOffset.left - xformOffsetX,
            offsetTop: -event.clientY + targetOffset.top - xformOffsetY,
            width: targetOffset.width * this.dragTransform.xScale,
            height: targetOffset.height * this.dragTransform.yScale
        };
    }

    /**
     * 获取拖拽元素的 UI 数据
     *
     * @returns {DDUIData} 返回包含位置信息的 UI 数据对象，具体包括：
     *   - position: 辅助元素相对于容器的当前 CSS 位置
     *     - top: 垂直位置（已应用 y 轴缩放比例）
     *     - left: 水平位置（已应用 x 轴缩放比例）
     *
     * @remarks
     * 该方法计算拖拽辅助元素相对于其父容器的位置，并应用缩放变换。
     * 位置值会根据 dragTransform 中定义的 xScale 和 yScale 进行相应调整。
     */
    public ui(): DDUIData {
        const containmentEl = this.helperContainment || this.el.parentElement;
        const containmentRect = containmentEl.getBoundingClientRect();
        const offset = this.helper.getBoundingClientRect();
        return {
            position: {
                // 当前辅助元素的 CSS 位置，包含 { top, left } 对象
                top: (offset.top - containmentRect.top) / this.dragTransform.yScale,
                left: (offset.left - containmentRect.left) / this.dragTransform.xScale
            }
            /* 当前未被 GridStack 使用的字段...
        helper: [this.helper], // 表示正在拖拽的辅助元素的对象数组
        offset: { top: offset.top, left: offset.left } // 辅助元素的当前偏移位置，包含 { top, left } 对象
        */
        };
    }
}
