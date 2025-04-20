/**
 * dd-droppable.ts 11.5.0-dev
 * Copyright (c) 2021-2024  Alain Dumesny - see GridStack root license
 */

import {DDDraggable} from './dd-draggable';
import {DDManager} from './dd-manager';
import {DDBaseImplement, HTMLElementExtendOpt} from './dd-base-impl';
import {Utils} from './utils';
import {DDElementHost} from './dd-element';
import {isTouch, pointerenter, pointerleave} from './dd-touch';
import {DDUIData} from './types';

/** 可放置元素的配置选项接口 */
export interface DDDroppableOpt {
    /**
     * 定义哪些元素可以被放置到此区域
     * - 可以是CSS选择器字符串
     * - 或者是一个返回boolean的判断函数
     */
    accept?: string | ((el: HTMLElement) => boolean);

    /**
     * 元素被放置时的回调函数
     * @param event - 拖拽事件对象
     * @param ui - 包含拖拽元素和位置信息的UI数据对象
     */
    drop?: (event: DragEvent, ui: DDUIData) => void;

    /**
     * 拖拽元素进入可放置区域时的回调函数
     * @param event - 拖拽事件对象
     * @param ui - 包含拖拽元素和位置信息的UI数据对象
     */
    over?: (event: DragEvent, ui: DDUIData) => void;

    /**
     * 拖拽元素离开可放置区域时的回调函数
     * @param event - 拖拽事件对象
     * @param ui - 包含拖拽元素和位置信息的UI数据对象
     */
    out?: (event: DragEvent, ui: DDUIData) => void;
}

// let count = 0; // TEST

export class DDDroppable extends DDBaseImplement implements HTMLElementExtendOpt<DDDroppableOpt> {
    /**
     * 自定义函数,用于确定是否接受拖拽元素
     * @param el - 被拖拽的HTML元素
     * @returns 如果接受拖拽返回true,否则返回false
     */
    public accept: (el: HTMLElement) => boolean;

    /**
     * 创建一个可放置（Droppable）元素的构造函数
     * @param el - HTML元素，将被设置为可放置区域
     * @param option - 可放置区域的配置选项对象，默认为空对象
     *
     * @remarks
     * 构造函数会执行以下操作:
     * - 绑定鼠标进入事件处理器
     * - 绑定鼠标离开事件处理器
     * - 启用可放置功能
     * - 设置接受条件
     */
    constructor(public el: HTMLElement, public option: DDDroppableOpt = {}) {
        super();
        // create var event binding so we can easily remove and still look like TS methods (unlike anonymous functions)
        this._mouseEnter = this._mouseEnter.bind(this);
        this._mouseLeave = this._mouseLeave.bind(this);
        this.enable();
        this._setupAccept();
    }

    /**
     * 为可放置区域添加事件监听器
     * @param event - 事件类型,可以是:
     * - 'drop': 元素被放置时触发
     * - 'dropover': 可拖动元素进入可放置区域时触发
     * - 'dropout': 可拖动元素离开可放置区域时触发
     * @param callback - 事件发生时的回调函数,接收一个DragEvent类型的事件对象作为参数
     */
    public on(event: 'drop' | 'dropover' | 'dropout', callback: (event: DragEvent) => void): void {
        super.on(event, callback);
    }

    /**
     * 移除指定的拖放事件监听器
     * @param event - 要移除监听的事件类型，可以是以下值之一：
     *   - 'drop': 当元素被放置时触发
     *   - 'dropover': 当可拖动元素进入可放置区域时触发
     *   - 'dropout': 当可拖动元素离开可放置区域时触发
     */
    public off(event: 'drop' | 'dropover' | 'dropout'): void {
        super.off(event);
    }

    /**
     * 启用拖拽放置功能
     *
     * 如果元素未被禁用,添加必要的CSS类和事件监听器来启用拖拽放置功能。
     * 具体会:
     * - 添加 'ui-droppable' CSS类
     * - 移除 'ui-droppable-disabled' CSS类
     * - 添加鼠标进入/离开事件监听
     * - 在触摸设备上添加指针进入/离开事件监听
     *
     * 当元素已经启用时(disabled === false),该方法不会进行任何操作。
     */
    public enable(): void {
        if (this.disabled === false) return;
        super.enable();
        this.el.classList.add('ui-droppable');
        this.el.classList.remove('ui-droppable-disabled');
        this.el.addEventListener('mouseenter', this._mouseEnter);
        this.el.addEventListener('mouseleave', this._mouseLeave);
        if (isTouch) {
            this.el.addEventListener('pointerenter', pointerenter);
            this.el.addEventListener('pointerleave', pointerleave);
        }
    }

    /**
     * 禁用元素的可放置（droppable）功能
     *
     * 该方法用于禁用一个元素的拖拽放置功能。具体功能包括：
     * - 如果元素已经被禁用，则直接返回
     * - 移除 'ui-droppable' CSS类
     * - 如果不是销毁操作，则添加 'ui-droppable-disabled' CSS类
     * - 移除鼠标进入和离开事件监听器
     * - 如果是触摸设备，还会移除指针进入和离开事件监听器
     *
     * @param forDestroy - 是否为销毁操作。如果为true，则不会添加disabled CSS类。默认为false
     */
    public disable(forDestroy = false): void {
        if (this.disabled === true) return;
        super.disable();
        this.el.classList.remove('ui-droppable');
        if (!forDestroy) this.el.classList.add('ui-droppable-disabled');
        this.el.removeEventListener('mouseenter', this._mouseEnter);
        this.el.removeEventListener('mouseleave', this._mouseLeave);
        if (isTouch) {
            this.el.removeEventListener('pointerenter', pointerenter);
            this.el.removeEventListener('pointerleave', pointerleave);
        }
    }

    /**
     * 销毁当前的可放置（droppable）实例。
     * 该方法会执行以下操作：
     * - 禁用可放置功能
     * - 移除所有相关的CSS类
     * - 调用父类的销毁方法
     */
    public destroy(): void {
        this.disable(true);
        this.el.classList.remove('ui-droppable');
        this.el.classList.remove('ui-droppable-disabled');
        super.destroy();
    }

    /**
     * 更新可放置元素的选项配置
     *
     * 该方法允许动态更新 DDDroppable（可放置）实例的配置选项。它会遍历传入的选项对象，
     * 将新的选项值更新到当前实例的选项中，并重新设置接受条件。
     *
     * @param opts - 新的可放置选项配置对象
     * @returns 返回当前 DDDroppable 实例，支持链式调用
     */
    public updateOption(opts: DDDroppableOpt): DDDroppable {
        Object.keys(opts).forEach((key) => (this.option[key] = opts[key]));
        this._setupAccept();
        return this;
    }

    /**
     * 当光标进入我们的区域时调用 - 为可能的放置做准备并跟踪离开
     *
     * 该方法处理拖拽元素进入可放置区域的逻辑：
     * 1. 检查是否有正在拖拽的元素，如果没有则直接返回
     * 2. 验证拖拽的元素是否可以放置在当前区域，如果不可以则返回
     * 3. 阻止默认事件行为和事件冒泡
     * 4. 确保在进入新的可放置区域前，先触发之前可放置区域的离开事件
     * 5. 更新全局拖放管理器中的当前可放置元素为this
     * 6. 创建一个自定义的"dropover"事件
     * 7. 如果配置了over回调函数，则调用该函数
     * 8. 触发"dropover"自定义事件
     * 9. 添加UI高亮样式类"ui-droppable-over"
     *
     * @param e - 鼠标进入事件对象
     */
    protected _mouseEnter(e: MouseEvent): void {
      if (!DDManager.dragElement) return;
      if (!this._canDrop(DDManager.dragElement.el)) return;
      e.preventDefault();
      e.stopPropagation();

      // 确保在进入新的可放置区域前，触发之前区域的离开事件
      if (DDManager.dropElement && DDManager.dropElement !== this) {
        DDManager.dropElement._mouseLeave(e as DragEvent, true); // calledByEnter = true
      }
      DDManager.dropElement = this;

      const ev = Utils.initEvent<DragEvent>(e, {target: this.el, type: 'dropover'});
      if (this.option.over) {
        this.option.over(ev, this._ui(DDManager.dragElement));
      }
      this.triggerEvent('dropover', ev);
      this.el.classList.add('ui-droppable-over');
    }

    /**
     * 当元素离开我们的可放置区域时调用，如果有正在跟踪的移动项目则停止跟踪
     *
     * 该方法处理拖拽元素离开可放置区域的逻辑：
     * 1. 检查是否有正在拖拽的元素且当前可放置元素就是this，如果不是则直接返回
     * 2. 阻止默认事件行为和事件冒泡
     * 3. 创建一个自定义的"dropout"事件
     * 4. 如果配置了out回调函数，则调用该函数
     * 5. 触发"dropout"自定义事件
     * 6. 如果当前全局跟踪的可放置元素是this，则清除该引用
     * 7. 处理嵌套可放置区域的特殊情况：
     *    - 如果不是由_mouseEnter调用的（calledByEnter=false），则尝试查找父级可放置元素
     *    - 向上遍历DOM树查找第一个具有ddDroppable特性的父元素
     *    - 如果找到父级可放置元素，模拟鼠标进入该元素，以维持正确的拖放层次结构
     *
     * @param e - 鼠标离开事件对象
     * @param calledByEnter - 是否由_mouseEnter方法调用，默认为false。用于防止在嵌套元素间切换时的事件循环
     */
    protected _mouseLeave(e: MouseEvent, calledByEnter = false): void {
        // console.log(`${count++} Leave ${this.el.id || (this.el as GridHTMLElement).gridstack.opts.id}`); // TEST
        if (!DDManager.dragElement || DDManager.dropElement !== this) return;
        e.preventDefault();
        e.stopPropagation();

        const ev = Utils.initEvent<DragEvent>(e, {target: this.el, type: 'dropout'});
        if (this.option.out) {
            this.option.out(ev, this._ui(DDManager.dragElement));
        }
        this.triggerEvent('dropout', ev);

        if (DDManager.dropElement === this) {
            delete DDManager.dropElement;
            // console.log('not tracking'); // TEST

            // if we're still over a parent droppable, send it an enter as we don't get one from leaving nested children
            if (!calledByEnter) {
                let parentDrop: DDDroppable;
                let parent: DDElementHost = this.el.parentElement;
                while (!parentDrop && parent) {
                    parentDrop = parent.ddElement?.ddDroppable;
                    parent = parent.parentElement;
                }
                if (parentDrop) {
                    parentDrop._mouseEnter(e);
                }
            }
        }
    }

    /**
     * 处理拖拽元素被放置时的事件
     *
     * @param e - 鼠标事件对象
     * @fires drop - 当元素被放置时触发
     *
     * @description
     * 该方法会：
     * 1. 阻止默认的放置行为
     * 2. 初始化一个自定义的拖拽事件
     * 3. 如果配置了drop回调函数，则执行该回调
     * 4. 触发'drop'事件
     *
     * @example
     * ```typescript
     * droppable.drop(mouseEvent);
     * ```
     */
    public drop(e: MouseEvent): void {
        e.preventDefault();
        const ev = Utils.initEvent<DragEvent>(e, {target: this.el, type: 'drop'});
        if (this.option.drop) {
            this.option.drop(ev, this._ui(DDManager.dragElement));
        }
        this.triggerEvent('drop', ev);
    }

    /**
     *
     * 检查一个元素是否可以被放置
     * @param el - 要检查的HTML元素
     * @returns {boolean} 如果元素存在且满足accept条件则返回true，否则返回false
     *
     * - 如果没有设置accept条件，任何存在的元素都可以放置
     * - 如果设置了accept条件，则元素必须同时满足存在且通过accept检查
     */
    protected _canDrop(el: HTMLElement): boolean {
        return el && (!this.accept || this.accept(el));
    }

    /**
     * 根据配置初始化可接受的拖拽元素条件
     *
     * 如果 option.accept 是字符串类型，会设置 accept 函数来检查元素是否:
     * - 包含指定的 CSS 类名
     * - 或匹配指定的 CSS 选择器
     *
     * 如果 option.accept 是函数类型，直接将其设置为 accept 函数
     *
     * @returns {DDDroppable} 返回当前实例，支持链式调用
     */
    protected _setupAccept(): DDDroppable {
        if (!this.option.accept) return this;
        if (typeof this.option.accept === 'string') {
            this.accept = (el: HTMLElement) =>
                el.classList.contains(this.option.accept as string) ||
                el.matches(this.option.accept as string);
        } else {
            this.accept = this.option.accept;
        }
        return this;
    }

    /**
     * 生成UI数据对象
     *
     * @param drag - DDDraggable实例对象
     * @returns DDUIData - 返回包含拖拽元素和UI数据的对象
     * @internal - 内部使用的protected方法
     *
     * @remarks
     * 该方法将DDDraggable实例的UI数据与其关联的DOM元素组合成一个新的对象。
     * 通过展开运算符合并drag.ui()返回的数据和draggable元素引用。
     */
    protected _ui(drag: DDDraggable): DDUIData {
        return {
            draggable: drag.el,
            ...drag.ui()
        };
    }
}
