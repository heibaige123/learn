/**
 * dd-base-impl.ts 12.0.0-dev
 * Copyright (c) 2021-2024  Alain Dumesny - see GridStack root license
 */

/**
 * 定义事件回调函数的类型
 * @param event 触发的事件对象
 * @returns 布尔值或无返回值
 */
export type EventCallback = (event: Event) => boolean | void;

/**
 * 拖放功能的基础抽象实现类
 * 提供事件注册、启用/禁用功能的基本结构
 */
export abstract class DDBaseImplement {
    /**
     * 获取组件的禁用状态
     * 注意：要改变状态需调用enable()/disable()方法，不能直接修改
     * @returns 当前禁用状态
     */
    public get disabled(): boolean {
        return this._disabled;
    }

    /**
     * @internal
     * 存储组件的禁用状态
     */
    protected _disabled: boolean; // initial state to differentiate from false

    /**
     * @internal
     * 存储注册的事件回调函数
     */
    protected _eventRegister: {
        [eventName: string]: EventCallback;
    } = {};

    /**
     * 注册事件监听器
     * @param event 事件名称
     * @param callback 事件触发时执行的回调函数
     */
    public on(event: string, callback: EventCallback): void {
        this._eventRegister[event] = callback;
    }

    /**
     * 移除事件监听器
     * @param event 要移除的事件名称
     */
    public off(event: string): void {
        delete this._eventRegister[event];
    }

    /**
     * 启用组件
     */
    public enable(): void {
        this._disabled = false;
    }

    /**
     * 禁用组件
     */
    public disable(): void {
        this._disabled = true;
    }

    /**
     * 销毁组件，清除所有事件监听器
     */
    public destroy(): void {
        delete this._eventRegister;
    }

    /**
     * 触发指定事件
     * @param eventName 要触发的事件名称
     * @param event 事件对象
     * @returns 回调函数的返回值或void
     */
    public triggerEvent(eventName: string, event: Event): boolean | void {
        if (!this.disabled && this._eventRegister && this._eventRegister[eventName])
            return this._eventRegister[eventName](event);
    }
}

/**
 * HTML元素扩展选项接口
 * 用于将HTML元素与拖放功能关联
 */
export interface HTMLElementExtendOpt<T> {
    /** 要扩展的HTML元素 */
    el: HTMLElement;
    /** 配置选项 */
    option: T;
    /**
     * 更新配置选项
     * @param T 新的配置选项
     * @returns 更新后的DDBaseImplement实例
     */
    updateOption(T): DDBaseImplement;
}
