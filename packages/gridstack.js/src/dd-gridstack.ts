/**
 * dd-gridstack.ts 11.5.0-dev
 * Copyright (c) 2021-2024 Alain Dumesny - see GridStack root license
 */

import {GridItemHTMLElement, GridStackElement, DDDragOpt} from './types';
import {Utils} from './utils';
import {DDManager} from './dd-manager';
import {DDElement, DDElementHost} from './dd-element';
import {GridHTMLElement} from './gridstack';

/**
 * 拖放相关的选项接口
 * @interface DDDropOpt
 *
 * @example
 * const dropOpt: DDDropOpt = {
 *   accept: (el) => el.classList.contains('grid-item')
 * };
 */
export type DDDropOpt = {
    /**
     * 用于验证拖放元素是否可接受的回调函数
     * @param el 被拖放的网格元素
     * @returns 返回 true 表示接受该元素，false 表示拒绝
     */
    accept?: (el: GridItemHTMLElement) => boolean;
};

/**
 * 表示拖拽相关的操作选项类型。
 * 可以是以下值：
 * - 'enable': 启用拖拽功能
 * - 'disable': 禁用拖拽功能
 * - 'destroy': 销毁拖拽实例
 * - 'option': 设置拖拽选项
 * - string: 其他字符串命令
 * - any: 任意其他值
 */
export type DDOpts = 'enable' | 'disable' | 'destroy' | 'option' | string | any;

/**
 * 用于拖拽调整网格大小时的关键尺寸属性类型
 * @typedef {string} DDKey
 * - 'minWidth' - 最小宽度
 * - 'minHeight' - 最小高度
 * - 'maxWidth' - 最大宽度
 * - 'maxHeight' - 最大高度
 * - 'maxHeightMoveUp' - 向上移动时的最大高度
 * - 'maxWidthMoveLeft' - 向左移动时的最大宽度
 */
export type DDKey =
    | 'minWidth'
    | 'minHeight'
    | 'maxWidth'
    | 'maxHeight'
    | 'maxHeightMoveUp'
    | 'maxWidthMoveLeft';

/**
 * 表示可拖拽网格堆栈中使用的数值类型
 * @typedef {number | string} DDValue
 *
 * 该类型可以是:
 * - `number`: 数字值
 * - `string`: 字符串值
 */
export type DDValue = number | string;

/**
 * 回调函数类型,用于处理拖拽事件
 * @param event - 触发的事件对象
 * @param arg2 - 被拖拽的网格项HTML元素
 * @param helper - 可选的辅助HTML元素,通常用于拖拽时的视觉反馈
 */
export type DDCallback = (
    event: Event,
    arg2: GridItemHTMLElement,
    helper?: GridItemHTMLElement
) => void;

// let count = 0; // TEST

/**
 * 拖拽和放置操作管理类，用于处理网格布局中的拖拽、调整大小和放置功能
 *
 * @class DDGridStack
 * @description 该类管理网格布局中元素的拖拽（drag）、调整大小（resize）和放置（drop）行为
 *
 * @example
 * ```typescript
 * const ddManager = new DDGridStack();
 * ddManager.draggable(gridItem, {
 *   start: (event) => console.log('开始拖拽'),
 *   stop: (event) => console.log('停止拖拽')
 * });
 * ```
 *
 * @remarks
 * - 提供元素的拖拽功能配置
 * - 处理元素的大小调整功能
 * - 管理元素的放置交互
 * - 支持事件监听和取消
 * - 可以动态启用/禁用拖拽相关功能
 *
 * @public
 */
export class DDGridStack {
    /**
     * 设置或更新网格项的可调整大小功能
     * @param el 要设置可调整大小的网格项 HTML 元素
     * @param opts 调整大小的选项。可以是：
     * - 'disable': 禁用调整大小功能
     * - 'enable': 启用调整大小功能
     * - 'destroy': 销毁调整大小功能
     * - 'option': 设置特定选项
     * - 或包含 start/stop/resize 回调函数的配置对象
     * @param key 当 opts 为 'option' 时使用的选项键名
     * @param value 当 opts 为 'option' 时使用的选项值
     * @returns 当前 DDGridStack 实例，支持链式调用
     *
     * @example
     * ```typescript
     * // 启用调整大小
     * gridstack.resizable(element, 'enable');
     *
     * // 设置特定选项
     * gridstack.resizable(element, 'option', 'handles', 'e,w');
     * ```
     *
     * @description
     * 此方法处理网格项的可调整大小功能，支持：
     * - 处理调整大小句柄的显示位置（n,e,s,w,se,sw,ne,nw）
     * - 自动隐藏调整大小句柄（基于 alwaysShowResizeHandle 选项）
     * - 集成网格的全局调整大小选项
     * - 支持自定义开始、停止和调整大小的回调函数
     */
    public resizable(
      el: GridItemHTMLElement,
      opts: DDOpts,
      key?: DDKey,
      value?: DDValue
    ): DDGridStack {
      this._getDDElements(el, opts).forEach((dEl) => {
        if (opts === 'disable' || opts === 'enable') {
          dEl.ddResizable && dEl.ddResizable[opts](); // can't create DD as it requires options for setupResizable()
        } else if (opts === 'destroy') {
          dEl.ddResizable && dEl.cleanResizable();
        } else if (opts === 'option') {
          dEl.setupResizable({[key]: value});
        } else {
          const n = dEl.el.gridstackNode;
          const grid = n.grid;
          let handles =
            dEl.el.getAttribute('gs-resize-handles') ||
            grid.opts.resizable.handles ||
            'e,s,se';
          if (handles === 'all') handles = 'n,e,s,w,se,sw,ne,nw';
          const autoHide = !grid.opts.alwaysShowResizeHandle;
          dEl.setupResizable({
            ...grid.opts.resizable,
            ...{handles, autoHide},
            ...{
              start: opts.start,
              stop: opts.stop,
              resize: opts.resize
            }
          });
        }
      });
      return this;
    }

    /**
     * 为网格项设置拖拽功能
     *
     * @param el - 需要添加拖拽功能的网格项 HTML 元素
     * @param opts - 拖拽选项配置。可以是以下值：
     *               - 'disable': 禁用拖拽
     *               - 'enable': 启用拖拽
     *               - 'destroy': 销毁拖拽功能
     *               - 'option': 设置特定拖拽选项
     *               - 或一个包含 start/stop/drag 回调函数的对象
     * @param key - 当 opts 为 'option' 时使用的选项键名
     * @param value - 当 opts 为 'option' 时使用的选项值
     *
     * @returns 当前 DDGridStack 实例，支持链式调用
     *
     * @example
     * ```typescript
     * // 启用拖拽
     * gridstack.draggable(element, 'enable');
     *
     * // 设置特定选项
     * gridstack.draggable(element, 'option', 'handle', '.my-handle');
     * ```
     */
    public draggable(
        el: GridItemHTMLElement,
        opts: DDOpts,
        key?: DDKey,
        value?: DDValue
    ): DDGridStack {
        this._getDDElements(el, opts).forEach((dEl) => {
            if (opts === 'disable' || opts === 'enable') {
                dEl.ddDraggable && dEl.ddDraggable[opts](); // can't create DD as it requires options for setupDraggable()
            } else if (opts === 'destroy') {
                dEl.ddDraggable && dEl.cleanDraggable();
            } else if (opts === 'option') {
                dEl.setupDraggable({[key]: value});
            } else {
                const grid = dEl.el.gridstackNode.grid;
                dEl.setupDraggable({
                    ...grid.opts.draggable,
                    ...{
                        // containment: (grid.parentGridNode && grid.opts.dragOut === false) ? grid.el.parentElement : (grid.opts.draggable.containment || null),
                        start: opts.start,
                        stop: opts.stop,
                        drag: opts.drag
                    }
                });
            }
        });
        return this;
    }

    /**
     * 为元素设置拖拽功能
     * @param el - 需要设置拖拽的网格元素
     * @param opts - 拖拽选项配置对象
     * @returns 当前实例,支持链式调用
     */
    public dragIn(el: GridStackElement, opts: DDDragOpt): DDGridStack {
        this._getDDElements(el).forEach((dEl) => dEl.setupDraggable(opts));
        return this;
    }

    /**
     * 使元素可被拖拽放置（droppable）
     * @param el 需要设置为可放置目标的 HTML 元素
     * @param opts 可以是以下几种类型:
     * - DDOpts: droppable 选项配置对象
     * - DDDropOpt: 简单的字符串命令 ('disable' | 'enable' | 'destroy' | 'option')
     * - 用于配置 droppable 行为的选项对象
     * @param key 当 opts 为 'option' 时使用的选项键名
     * @param value 当 opts 为 'option' 时使用的选项值
     * @returns 当前 DDGridStack 实例，支持链式调用
     *
     * @description
     * 该方法用于配置网格项的放置行为。它可以:
     * - 启用/禁用元素的放置功能
     * - 销毁放置功能
     * - 设置单个放置选项
     * - 配置完整的放置行为
     *
     * 如果 opts.accept 是函数，会对其进行特殊处理以确保正确的上下文绑定。
     */
    public droppable(
        el: GridItemHTMLElement,
        opts: DDOpts | DDDropOpt,
        key?: DDKey,
        value?: DDValue
    ): DDGridStack {
        if (typeof opts.accept === 'function' && !opts._accept) {
            opts._accept = opts.accept;
            opts.accept = (el) => opts._accept(el);
        }
        this._getDDElements(el, opts).forEach((dEl) => {
            if (opts === 'disable' || opts === 'enable') {
                dEl.ddDroppable && dEl.ddDroppable[opts]();
            } else if (opts === 'destroy') {
                dEl.ddDroppable && dEl.cleanDroppable();
            } else if (opts === 'option') {
                dEl.setupDroppable({[key]: value});
            } else {
                dEl.setupDroppable(opts);
            }
        });
        return this;
    }

    /**
     * 检查一个元素是否可以接受拖拽放置
     * @param el - 需要检查的元素，类型为 DDElementHost
     * @returns 如果元素可以接受拖拽放置则返回 true，否则返回 false
     * @description
     * 判断条件:
     * 1. 元素必须存在
     * 2. 元素必须有 ddElement 属性
     * 3. ddElement 必须有 ddDroppable 属性
     * 4. ddDroppable 不能被禁用（disabled 不为 true）
     */
    public isDroppable(el: DDElementHost): boolean {
        return !!(el?.ddElement?.ddDroppable && !el.ddElement.ddDroppable.disabled);
    }

    /**
     * 检查一个 DOM 元素是否可拖动
     * @param el 要检查的 DOM 元素，需要包含 ddElement 和 ddDraggable 属性
     * @returns {boolean} 如果元素可拖动返回 true，否则返回 false
     * @description
     * - 元素必须具有 ddElement 属性
     * - ddElement 必须具有 ddDraggable 属性
     * - ddDraggable 的 disabled 属性必须为 false
     */
    public isDraggable(el: DDElementHost): boolean {
        return !!(el?.ddElement?.ddDraggable && !el.ddElement.ddDraggable.disabled);
    }

    /**
     * 检查一个元素是否可以调整大小
     * @param el - 要检查的元素对象，需要实现 DDElementHost 接口
     * @returns true 表示元素可以调整大小，false 表示不可以
     *
     * 注意:该方法会检查以下条件:
     * - 元素必须存在 ddElement 属性
     * - ddElement 必须有 ddResizable 属性
     * - ddResizable 的 disabled 属性不能为 true
     */
    public isResizable(el: DDElementHost): boolean {
        return !!(el?.ddElement?.ddResizable && !el.ddElement.ddResizable.disabled);
    }

    /**
     * 为网格项元素绑定拖拽相关事件监听器
     *
     * @param el - 需要绑定事件的网格项 HTML 元素
     * @param name - 事件名称
     * @param callback - 事件回调函数，接收三个参数:
     *   - event: 原始事件对象
     *   - element: 当前被拖拽的元素或事件目标元素
     *   - helper: 拖拽时的辅助元素(如果存在)
     * @returns 当前 DDGridStack 实例，支持链式调用
     */
    public on(el: GridItemHTMLElement, name: string, callback: DDCallback): DDGridStack {
        this._getDDElements(el).forEach((dEl) =>
            dEl.on(name, (event: Event) => {
                callback(
                    event,
                    DDManager.dragElement
                        ? DDManager.dragElement.el
                        : (event.target as GridItemHTMLElement),
                    DDManager.dragElement ? DDManager.dragElement.helper : null
                );
            })
        );
        return this;
    }

    /**
     * 移除指定元素上的事件监听器
     * @param el - 需要移除事件监听的网格项 HTML 元素
     * @param name - 要移除的事件名称
     * @returns 返回当前 DDGridStack 实例，支持链式调用
     */
    public off(el: GridItemHTMLElement, name: string): DDGridStack {
        this._getDDElements(el).forEach((dEl) => dEl.off(name));
        return this;
    }

    /**
     * 获取与指定DOM元素相关联的拖拽元素（DDElement）数组
     *
     * @param els - 要获取拖拽元素的GridStack元素或元素集合
     * @param opts - 拖拽操作的选项配置
     *              'destroy' - 销毁拖拽元素
     *              'disable' - 禁用拖拽功能
     *
     * @returns 返回DDElement数组。如果没有找到相应元素或元素不满足条件，则返回空数组
     *
     * @description
     * 该方法会根据传入的GridStack元素，返回对应的拖拽元素数组。
     * 如果元素是网格本身或opts不是'destroy'或'disable'，则会创建新的拖拽元素（如果不存在）。
     * 如果元素已经有关联的拖拽元素，则直接使用现有的。
     * 最终会过滤掉所有null值，只返回有效的拖拽元素。
     */
    protected _getDDElements(els: GridStackElement, opts?: DDOpts): DDElement[] {
        // don't force create if we're going to destroy it, unless it's a grid which is used as drop target for it's children
        const create =
            (els as GridHTMLElement).gridstack || (opts !== 'destroy' && opts !== 'disable');
        const hosts = Utils.getElements(els) as DDElementHost[];
        if (!hosts.length) return [];
        const list = hosts
            .map((e) => e.ddElement || (create ? DDElement.init(e) : null))
            .filter((d) => d); // remove nulls
        return list;
    }
}
