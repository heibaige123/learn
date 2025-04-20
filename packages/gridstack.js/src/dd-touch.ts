/**
 * touch.ts 11.5.0-dev
 * Copyright (c) 2021-2024 Alain Dumesny - see GridStack root license
 */

import {DDManager} from './dd-manager';
import {Utils} from './utils';

/**
 * 检测当前环境是否支持触摸操作
 * 通过检查以下条件：
 * - document 或 window 对象上是否有 ontouchstart 事件
 * - 是否支持 DocumentTouch 接口
 * - 设备是否支持多点触控（通过 maxTouchPoints）
 * - 是否支持 IE 的触摸事件（msMaxTouchPoints）
 */
export const isTouch: boolean =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    ('ontouchstart' in document ||
        'ontouchstart' in window ||
        // 不使用 TouchEvent 检测，因为在 Windows 10 Chrome 桌面版上会返回 true
        // || !!window.TouchEvent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).DocumentTouch && document instanceof (window as any).DocumentTouch) ||
        navigator.maxTouchPoints > 0 ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).msMaxTouchPoints > 0);

/**
 * 触摸处理辅助类
 */
class DDTouch {
    /**
     * 标记触摸是否正在被处理
     */
    public static touchHandled: boolean;

    /**
     * 延迟指针离开事件的超时
     */
    public static pointerLeaveTimeout: number;
}

/**
 * Get the x,y position of a touch event
 * 获取触摸事件的x,y位置
 */
// function getTouchCoords(e: TouchEvent): TouchCoord {
//   return {
//     x: e.changedTouches[0].pageX,
//     y: e.changedTouches[0].pageY
//   };
// }

/**
 * Simulate a mouse event based on a corresponding touch event
 * @param {Object} e A touch event
 * @param {String} simulatedType The corresponding mouse event
 *
 * 基于相应的触摸事件模拟鼠标事件
 * @param {Object} e 触摸事件
 * @param {String} simulatedType 相应的鼠标事件
 */
function simulateMouseEvent(e: TouchEvent, simulatedType: string) {
    // 忽略多点触摸事件
    if (e.touches.length > 1) return;

    // 防止"忽略尝试取消cancelable=false的touchmove事件"错误
    if (e.cancelable) e.preventDefault();

    // 将模拟事件分派给目标元素
    Utils.simulateMouseEvent(e.changedTouches[0], simulatedType);
}

/**
 * Simulate a mouse event based on a corresponding Pointer event
 * @param {Object} e A pointer event
 * @param {String} simulatedType The corresponding mouse event
 *
 * 基于相应的指针事件模拟鼠标事件
 * @param {Object} e 指针事件
 * @param {String} simulatedType 相应的鼠标事件
 */
function simulatePointerMouseEvent(e: PointerEvent, simulatedType: string) {
    // 防止"忽略尝试取消cancelable=false的touchmove事件"错误
    if (e.cancelable) e.preventDefault();

    // 将模拟事件分派给目标元素
    Utils.simulateMouseEvent(e, simulatedType);
}

/**
 * 处理touchstart事件
 * @param {Object} e 部件元素的touchstart事件
 */
export function touchstart(e: TouchEvent): void {
    // 如果另一个部件已经被处理，则忽略该事件
    if (DDTouch.touchHandled) return;
    DDTouch.touchHandled = true;

    // 模拟鼠标事件
    simulateMouseEvent(e, 'mousedown');
}

/**
 * 处理touchmove事件
 * @param {Object} e 文档的touchmove事件
 */
export function touchmove(e: TouchEvent): void {
    // 如果不是由我们处理的事件，则忽略
    if (!DDTouch.touchHandled) return;

    simulateMouseEvent(e, 'mousemove');
}

/**
 * 处理touchend事件
 * @param {Object} e 文档的touchend事件
 */
export function touchend(e: TouchEvent): void {
    // 如果未处理，则忽略事件
    if (!DDTouch.touchHandled) return;

    // 当我们在自己上释放时取消延迟离开事件，这发生在我们得到这个之前！
    if (DDTouch.pointerLeaveTimeout) {
        window.clearTimeout(DDTouch.pointerLeaveTimeout);
        delete DDTouch.pointerLeaveTimeout;
    }

    const wasDragging = !!DDManager.dragElement;

    // 模拟mouseup事件
    simulateMouseEvent(e, 'mouseup');
    // simulateMouseEvent(event, 'mouseout');

    // 如果触摸交互没有移动，它应该触发一个点击
    if (!wasDragging) {
        simulateMouseEvent(e, 'click');
    }

    // 取消设置标志以允许其他部件继承触摸事件
    DDTouch.touchHandled = false;
}

/**
 * 注意我们不会得到touchenter/touchleave（已弃用）
 * 请参阅 https://stackoverflow.com/questions/27908339/js-touch-equivalent-for-mouseenter
 * 所以我们使用PointerEvent来获取enter/leave并发送匹配的鼠标事件。
 */
export function pointerdown(e: PointerEvent): void {
    // 如果是鼠标事件则直接返回
    if (e.pointerType === 'mouse') return;
    // 释放指针捕获，确保后续事件正常触发
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
}

/**
 * 处理指针进入事件以模拟mouseenter
 * @param e 指针事件
 */
export function pointerenter(e: PointerEvent): void {
    // 忽略我们在自己上pointerdown时得到的初始事件
    if (!DDManager.dragElement) {
        return;
    }
    // 如果是鼠标事件则直接返回
    if (e.pointerType === 'mouse') return;
    // 模拟mouseenter事件
    simulatePointerMouseEvent(e, 'mouseenter');
}

/**
 * 处理指针离开事件以模拟mouseleave
 * @param e 指针事件
 */
export function pointerleave(e: PointerEvent): void {
    // 忽略在释放鼠标之前在自己身上收到的离开事件
    // 通过延迟发送事件并让mouseup事件取消我们
    if (!DDManager.dragElement) {
        return;
    }
    if (e.pointerType === 'mouse') return;
    DDTouch.pointerLeaveTimeout = window.setTimeout(() => {
        delete DDTouch.pointerLeaveTimeout;
        simulatePointerMouseEvent(e, 'mouseleave');
    }, 10);
}
