/**
 * dd-elements.ts 11.5.0-dev
 * Copyright (c) 2021-2024 Alain Dumesny - see GridStack root license
 */

import {DDResizable, DDResizableOpt} from './dd-resizable';
import {DDDragOpt, GridItemHTMLElement} from './types';
import {DDDraggable} from './dd-draggable';
import {DDDroppable, DDDroppableOpt} from './dd-droppable';

/** DDElement 宿主元素接口，继承自 GridItemHTMLElement */
export interface DDElementHost extends GridItemHTMLElement {
  /** DDElement 实例属性 */
  ddElement?: DDElement;
}

/**
 * DDElement 类用于管理元素的拖拽、放置和调整大小功能
 */
export class DDElement {
  /**
   * 初始化或获取元素的 DDElement 实例
   * @param el 目标 DOM 元素
   * @returns DDElement 实例
   */
  static init(el: DDElementHost): DDElement {
    if (!el.ddElement) {el.ddElement = new DDElement(el);}
    return el.ddElement;
  }

  /** 拖拽、放置和调整大小的实例 */
  public ddDraggable?: DDDraggable;
  /** 放置功能实例 */
  public ddDroppable?: DDDroppable;
  /** 调整大小功能实例 */
  public ddResizable?: DDResizable;

  constructor(public el: DDElementHost) { }

  /**
   * 为元素绑定事件监听器
   * @param eventName 事件名称 ('drag'|'dragstart'|'dragstop'|'drop'|'dropover'|'dropout'|'resizestart'|'resize'|'resizestop')
   * @param callback 鼠标事件回调函数
   * @returns 当前 DDElement 实例
   */
  public on(eventName: string, callback: (event: MouseEvent) => void): DDElement {
    if (this.ddDraggable && ['drag', 'dragstart', 'dragstop'].indexOf(eventName) > -1) {
      this.ddDraggable.on(eventName as 'drag' | 'dragstart' | 'dragstop', callback);
    } else if (this.ddDroppable && ['drop', 'dropover', 'dropout'].indexOf(eventName) > -1) {
      this.ddDroppable.on(eventName as 'drop' | 'dropover' | 'dropout', callback);
    } else if (this.ddResizable && ['resizestart', 'resize', 'resizestop'].indexOf(eventName) > -1) {
      this.ddResizable.on(eventName as 'resizestart' | 'resize' | 'resizestop', callback);
    }
    return this;
  }

  /**
   * 移除事件监听器
   * @param eventName 事件名称 ('drag'|'dragstart'|'dragstop'|'drop'|'dropover'|'dropout'|'resizestart'|'resize'|'resizestop')
   * @returns 当前 DDElement 实例
   */
  public off(eventName: string): DDElement {
    if (this.ddDraggable && ['drag', 'dragstart', 'dragstop'].indexOf(eventName) > -1) {
      this.ddDraggable.off(eventName as 'drag' | 'dragstart' | 'dragstop');
    } else if (this.ddDroppable && ['drop', 'dropover', 'dropout'].indexOf(eventName) > -1) {
      this.ddDroppable.off(eventName as 'drop' | 'dropover' | 'dropout');
    } else if (this.ddResizable && ['resizestart', 'resize', 'resizestop'].indexOf(eventName) > -1) {
      this.ddResizable.off(eventName as 'resizestart' | 'resize' | 'resizestop');
    }
    return this;
  }

  /**
   * 设置拖拽功能
   * @param opts 拖拽配置选项对象
   * @returns 当前 DDElement 实例
   */
  public setupDraggable(opts: DDDragOpt): DDElement {
    if (!this.ddDraggable) {
      // 如果没有拖拽实例，创建一个新的
      this.ddDraggable = new DDDraggable(this.el, opts);
    } else {
      // 如果已存在拖拽实例，更新其配置
      this.ddDraggable.updateOption(opts);
    }
    return this;
  }

  /**
   * 清理拖拽功能
   * @returns 当前实例
   */
  public cleanDraggable(): DDElement {
    if (this.ddDraggable) {
      this.ddDraggable.destroy();
      delete this.ddDraggable;
    }
    return this;
  }

  /**
   * 设置调整大小功能
   * @param opts 调整大小配置选项
   * @returns 当前实例
   */
  public setupResizable(opts: DDResizableOpt): DDElement {
    if (!this.ddResizable) {
      this.ddResizable = new DDResizable(this.el, opts);
    } else {
      this.ddResizable.updateOption(opts);
    }
    return this;
  }

  /**
   * 清理调整大小功能
   * @returns 当前实例
   */
  public cleanResizable(): DDElement {
    if (this.ddResizable) {
      this.ddResizable.destroy();
      delete this.ddResizable;
    }
    return this;
  }

  /**
   * 设置放置功能
   * @param opts 放置配置选项
   * @returns 当前实例
   */
  public setupDroppable(opts: DDDroppableOpt): DDElement {
    if (!this.ddDroppable) {
      this.ddDroppable = new DDDroppable(this.el, opts);
    } else {
      this.ddDroppable.updateOption(opts);
    }
    return this;
  }

  /**
   * 清理放置功能
   * @returns 当前实例
   */
  public cleanDroppable(): DDElement {
    if (this.ddDroppable) {
      this.ddDroppable.destroy();
      delete this.ddDroppable;
    }
    return this;
  }
}
