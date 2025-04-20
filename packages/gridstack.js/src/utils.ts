/**
 * utils.ts 11.5.0-dev
 * Copyright (c) 2021-2024 Alain Dumesny - see GridStack root license
 */

import {
    GridStackElement,
    GridStackNode,
    GridStackOptions,
    numberOrString,
    GridStackPosition,
    GridStackWidget
} from './types';

/**
 * 高度数据接口，包含值和单位 */
export interface HeightData {
    /**
     * 高度值 */
    h: number;
    /**
     * 高度单位（px、em、rem等） */
    unit: string;
}

/**
 * 拖动变换数据接口 */
export interface DragTransform {
    /**
     * x轴上的缩放因子 */
    xScale: number;
    /**
     * y轴上的缩放因子 */
    yScale: number;
    /**
     * x轴上的偏移量 */
    xOffset: number;
    /**
     * y轴上的偏移量 */
    yOffset: number;
}

/**
 * 检查过时的方法名称 */
// eslint-disable-next-line
export function obsolete(
    self,
    f,
    oldName: string,
    newName: string,
    rev: string
): (...args: any[]) => any {
    const wrapper = (...args) => {
        console.warn(
            'gridstack.js: Function `' +
                oldName +
                '` is deprecated in ' +
                rev +
                ' and has been replaced ' +
                'with `' +
                newName +
                '`. It will be **removed** in a future release'
        );
        return f.apply(self, args);
    };
    wrapper.prototype = f.prototype;
    return wrapper;
}

/**
 * 检查过时的网格选项（可用于任何字段，但消息是关于选项的） */
export function obsoleteOpts(
    opts: GridStackOptions,
    oldName: string,
    newName: string,
    rev: string
): void {
    if (opts[oldName] !== undefined) {
        opts[newName] = opts[oldName];
        console.warn(
            'gridstack.js: Option `' +
                oldName +
                '` is deprecated in ' +
                rev +
                ' and has been replaced with `' +
                newName +
                '`. It will be **removed** in a future release'
        );
    }
}

/**
 * 检查已删除的过时网格选项 */
export function obsoleteOptsDel(
    opts: GridStackOptions,
    oldName: string,
    rev: string,
    info: string
): void {
    if (opts[oldName] !== undefined) {
        console.warn('gridstack.js: Option `' + oldName + '` is deprecated in ' + rev + info);
    }
}

/**
 * 检查过时的jQuery元素属性 */
export function obsoleteAttr(el: HTMLElement, oldName: string, newName: string, rev: string): void {
    const oldAttr = el.getAttribute(oldName);
    if (oldAttr !== null) {
        el.setAttribute(newName, oldAttr);
        console.warn(
            'gridstack.js: attribute `' +
                oldName +
                '`=' +
                oldAttr +
                ' is deprecated on this object in ' +
                rev +
                ' and has been replaced with `' +
                newName +
                '`. It will be **removed** in a future release'
        );
    }
}

/**
 * 实用工具方法
 */
export class Utils {
    /**
     * 根据各种可能的输入类型获取HTML元素。
     *
     * @param els - 元素选择器。可以是：
     *    - CSS选择器字符串（例如，'.my-class'，'#my-id'）
     *    - 数字ID字符串（例如，'123'）
     *    - HTMLElement实例
     *
     * @param root - 从中搜索元素的根元素或文档。
     *    - 默认为全局document。
     *
     * @returns 匹配选择器的HTMLElement对象数组。
     *    - 如果传递单个HTMLElement，则返回仅包含该元素的数组。
     *    - 如果未找到元素，则返回空数组。
     *
     * @remarks 该函数对用作选择器的数字ID有特殊处理。
     *    - 如果选择器以数字开头，则假定它是ID并使用getElementById。
     *    - 如果选择器不匹配任何内容且不以'.'或'#'开头，它会尝试将'.'然后'#'附加到选择器作为后备选项。
     */
    static getElements(
        els: GridStackElement,
        root: HTMLElement | Document = document
    ): HTMLElement[] {
        if (typeof els === 'string') {
            const doc = 'getElementById' in root ? (root as Document) : undefined;

            // Note: very common for people use to id='1,2,3' which is only legal as HTML5 id, but not CSS selectors
            // so if we start with a number, assume it's an id and just return that one item...
            // see https://github.com/gridstack/gridstack.js/issues/2234#issuecomment-1523796562
            if (doc && !isNaN(+els[0])) {
                // start with digit
                const el = doc.getElementById(els);
                return el ? [el] : [];
            }

            let list = root.querySelectorAll(els);
            if (!list.length && els[0] !== '.' && els[0] !== '#') {
                list = root.querySelectorAll('.' + els);
                if (!list.length) {
                    list = root.querySelectorAll('#' + els);
                }
            }
            return Array.from(list) as HTMLElement[];
        }
        return [els];
    }

    /**
     * 根据输入的选择器获取HTMLElement，或者如果输入已经是HTMLElement则直接返回该元素。
     *
     * @param els - 元素标识符或HTMLElement：可以是字符串选择器（id、类、属性或简单名称）或HTMLElement。
     * @param root - 用于搜索的根元素或文档。默认为document。
     * @returns 找到的HTMLElement或原始元素（如果它已经是HTMLElement）。如果未找到元素，则返回null。
     *
     * @example
     * // 通过ID获取元素
     * const element = Utils.getElement('#myElement');
     *
     * @example
     * // 通过类获取元素
     * const element = Utils.getElement('.myClass');
     *
     * @example
     * // 通过属性获取元素
     * const element = Utils.getElement('[data-gs-id=1]');
     *
     * @example
     * // 通过可能是ID或元素名称的字符串获取元素
     * const element = Utils.getElement('myElement');
     *
     * @example
     * // 在特定的根元素内搜索
     * const element = Utils.getElement('.child', parentElement);
     */
    static getElement(els: GridStackElement, root: HTMLElement | Document = document): HTMLElement {
        if (typeof els === 'string') {
            const doc = 'getElementById' in root ? (root as Document) : undefined;
            if (!els.length) return null;
            if (doc && els[0] === '#') {
                return doc.getElementById(els.substring(1));
            }
            if (els[0] === '#' || els[0] === '.' || els[0] === '[') {
                return root.querySelector(els);
            }

            // if we start with a digit, assume it's an id (error calling querySelector('#1')) as class are not valid CSS
            if (doc && !isNaN(+els[0])) {
                // start with digit
                return doc.getElementById(els);
            }

            // finally try string, then id, then class
            let el = root.querySelector(els);
            if (doc && !el) {
                el = doc.getElementById(els);
            }
            if (!el) {
                el = root.querySelector('.' + els);
            }
            return el as HTMLElement;
        }
        return els;
    }

    /**
     * 确定一个节点是否应该被懒加载。
     *
     * @param n - 要检查懒加载的GridStackNode
     * @returns 如果节点应该根据节点的lazyLoad属性或网格选项进行懒加载则返回true，
     *          否则返回false。具体来说，当以下条件满足时返回true：
     *          - 节点的lazyLoad属性为真，或者
     *          - 网格的lazyLoad选项为真且节点的lazyLoad不是明确设置为false
     */

    static lazyLoad(n: GridStackNode): boolean {
        return n.lazyLoad || (n.grid?.opts?.lazyLoad && n.lazyLoad !== false);
    }

    /**
     * 创建一个带有指定类名的div元素
     *
     * @param classes - 要添加到div元素的CSS类名数组
     * @param parent - 可选的父元素，如果提供，创建的div将被添加到这个父元素中
     * @returns 创建的div元素
     *
     * @example
     * // 创建一个带有'grid-stack-item'类的div
     * const itemDiv = Utils.createDiv(['grid-stack-item']);
     *
     * @example
     * // 创建一个带有多个类并添加到容器的div
     * const contentDiv = Utils.createDiv(['grid-stack-content', 'widget'], containerElement);
     */
    static createDiv(classes: string[], parent?: HTMLElement): HTMLElement {
        const el = document.createElement('div');
        classes.forEach((c) => {
            if (c) el.classList.add(c);
        });
        parent?.appendChild(el);
        return el;
    }

    /**
     * 根据节点配置和网格选项确定节点是否应该根据内容调整大小。
     *
     * @param n - 要检查的网格节点
     * @param strict - 如果为true，要求明确设置sizeToContent=true或grid.opts.sizeToContent=true且节点值未定义。
     *                 如果为false（默认），允许更宽松的条件，任何真值都有效。
     * @returns 如果节点应该根据内容调整大小则返回true，否则返回false
     */

    static shouldSizeToContent(n: GridStackNode | undefined, strict = false): boolean {
        return (
            n?.grid &&
            (strict
                ? n.sizeToContent === true ||
                  (n.grid.opts.sizeToContent === true && n.sizeToContent === undefined)
                : !!n.sizeToContent || (n.grid.opts.sizeToContent && n.sizeToContent !== false))
        );
    }

    /**
     * 检查两个网格位置是否重叠或相交。
     *
     * @param a - 第一个网格位置
     * @param b - 第二个网格位置
     * @returns 如果位置相交/重叠则返回`true`，否则返回`false`
     *
     * 逻辑使用不相交条件的反面：
     * - a完全在b下方 `(a.y >= b.y + b.h)`
     * - a完全在b上方 `(a.y + a.h <= b.y)`
     * - a完全在b右侧 `(a.x >= b.x + b.w)`
     * - a完全在b左侧 `(a.x + a.w <= b.x)`
     */
    static isIntercepted(a: GridStackPosition, b: GridStackPosition): boolean {
        return !(a.y >= b.y + b.h || a.y + a.h <= b.y || a.x + a.w <= b.x || a.x >= b.x + b.w);
    }

    /**
     * 检查两个网格位置是否彼此接触（共享边缘或角落）。
     *
     * @param a - 第一个网格位置
     * @param b - 第二个网格位置
     * @returns 如果两个位置彼此接触（共享边缘或角落）则返回 true，否则返回 false
     *
     * @remarks 通过扩展 b 的范围来检测接触：
     * - 扩展 b 的每个边缘 0.5 个单位
     * - 检查扩展区域是否与 a 相交
     * 这样可以检测到边缘接触和角落接触
     */
    static isTouching(a: GridStackPosition, b: GridStackPosition): boolean {
        return Utils.isIntercepted(a, {
            x: b.x - 0.5,
            y: b.y - 0.5,
            w: b.w + 1,
            h: b.h + 1
        });
    }

    /**
     * 计算两个网格位置重叠的面积
     *
     * @param a - 第一个网格位置
     * @param b - 第二个网格位置
     * @returns 重叠区域的面积（单位为网格单元）。如果没有重叠，则返回0
     *
     * @remarks
     * 算法通过找出重叠区域的边界来计算面积：
     * 1. 找出重叠矩形的左边界 x0（a和b的x最大值）
     * 2. 找出重叠矩形的右边界 x1（a和b的右边界的最小值）
     * 3. 如果 `x1 <= x0`，则没有水平重叠，返回0
     * 4. 找出重叠矩形的上边界 y0（a和b的y最大值）
     * 5. 找出重叠矩形的下边界 y1（a和b的下边界的最小值）
     * 6. 如果 `y1 <= y0`，则没有垂直重叠，返回0
     * 7. 计算面积：(x1 - x0) * (y1 - y0)
     */
    static areaIntercept(a: GridStackPosition, b: GridStackPosition): number {
        const x0 = a.x > b.x ? a.x : b.x;
        const x1 = a.x + a.w < b.x + b.w ? a.x + a.w : b.x + b.w;
        if (x1 <= x0) return 0; // no overlap 没有重叠
        const y0 = a.y > b.y ? a.y : b.y;
        const y1 = a.y + a.h < b.y + b.h ? a.y + a.h : b.y + b.h;
        if (y1 <= y0) return 0; // no overlap 没有重叠
        return (x1 - x0) * (y1 - y0);
    }

    /**
     * 返回面积 */
    static area(a: GridStackPosition): number {
        return a.w * a.h;
    }

    /**
     *
     * @param nodes array to sort
     * @param dir 1 for ascending, -1 for descending (optional)
     *
     * 对节点数组进行排序
     * @param nodes 要排序的数组
     * @param dir 1表示升序，-1表示降序（可选）
     **/
    static sort(nodes: GridStackNode[], dir: 1 | -1 = 1): GridStackNode[] {
        const und = 10000;
        return nodes.sort((a, b) => {
            const diffY = dir * ((a.y ?? und) - (b.y ?? und));
            if (diffY === 0) return dir * ((a.x ?? und) - (b.x ?? und));
            return diffY;
        });
    }

    /**
     * 通过id查找项目
     * */
    static find(nodes: GridStackNode[], id: string): GridStackNode | undefined {
        return id ? nodes.find((n) => n.id === id) : undefined;
    }

    /**
     * 将值转换为布尔值
     * */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static toBool(v: unknown): boolean {
        if (typeof v === 'boolean') {
            return v;
        }
        if (typeof v === 'string') {
            v = v.toLowerCase();
            return !(v === '' || v === 'no' || v === 'false' || v === '0');
        }
        return Boolean(v);
    }

    /**
     * 将字符串转换为数字
     * */
    static toNumber(value: null | string): number {
        return value === null || value.length === 0 ? undefined : Number(value);
    }

    /**
     * 解析高度值并提取数值和单位部分
     *
     * @param val - 要解析的高度值，可以是数字或带单位的字符串（如'10px'、'2em'等）
     * @returns 包含高度数值和单位的HeightData对象
     *
     * @example
     * // 解析像素值
     * const result1 = Utils.parseHeight('100px'); // {h: 100, unit: 'px'}
     *
     * @example
     * // 解析百分比值
     * const result2 = Utils.parseHeight('50%'); // {h: 50, unit: '%'}
     *
     * @example
     * // 解析数字（默认单位为px）
     * const result3 = Utils.parseHeight(75); // {h: 75, unit: 'px'}
     *
     * @throws 如果提供的字符串格式无效，则抛出错误
     */
    static parseHeight(val: numberOrString): HeightData {
        let h: number;
        let unit = 'px';
        if (typeof val === 'string') {
            if (val === 'auto' || val === '') h = 0;
            else {
                const match = val.match(
                    /^(-[0-9]+\.[0-9]+|[0-9]*\.[0-9]+|-[0-9]+|[0-9]+)(px|em|rem|vh|vw|%|cm|mm)?$/
                );
                if (!match) {
                    throw new Error(`Invalid height val = ${val}`);
                }
                unit = match[2] || 'px';
                h = parseFloat(match[1]);
            }
        } else {
            h = val;
        }
        return {h, unit};
    }

    /**
     * 将目标中未设置的字段复制为使用给定的默认源值 */
    // eslint-disable-next-line
    /** 将源对象中的所有未在目标对象中设置的字段复制到目标对象中
     *
     * 递归地设置默认值，用源对象中的值填充目标对象中的未定义字段
     *
     * @param target - 要填充默认值的目标对象
     * @param sources - 一个或多个源对象，包含要用作默认值的属性
     * @returns 修改后的目标对象
     *
     * @example
     * // 设置默认配置
     * const options = Utils.defaults({width: 100}, defaultOptions);
     *
     * @example
     * // 深度合并多个对象中的未设置字段
     * const result = Utils.defaults({}, objA, objB, objC);
     *
     * @remarks
     * - 只有当目标对象中的字段为null或undefined时，才会从源对象复制
     * - 对于对象类型的字段，会递归进行相同的默认值设置
     * - 源对象按照传入顺序应用，后面的源对象不会覆盖已设置的值
     */
    static defaults(target, ...sources): object {
        sources.forEach((source) => {
            for (const key in source) {
                if (!source.hasOwnProperty(key)) return;
                if (target[key] === null || target[key] === undefined) {
                    target[key] = source[key];
                } else if (typeof source[key] === 'object' && typeof target[key] === 'object') {
                    // 属性是对象，递归添加其字段... #1373
                    this.defaults(target[key], source[key]);
                }
            }
        });

        return target;
    }

    /**
     * 比较两个对象是否完全相等（仅检查一层深度）
     *
     * @param a - 第一个要比较的对象
     * @param b - 第二个要比较的对象
     * @returns 如果两个对象相等则返回true，否则返回false
     *
     * @remarks
     * - 如果参数不是对象类型，使用宽松相等（==）比较
     * - 如果类型不同，返回false
     * - 如果是对象类型：
     *   - 首先检查属性数量是否相同
     *   - 然后检查每个属性的值是否严格相等（===）
     *   - 仅检查一层深度，不递归检查嵌套对象
     */
    static same(a: unknown, b: unknown): boolean {
        if (typeof a !== 'object') return a == b;
        if (typeof a !== typeof b) return false;
        // else we have object, check just 1 level deep for being same things...
        if (Object.keys(a).length !== Object.keys(b).length) return false;
        for (const key in a) {
            if (a[key] !== b[key]) return false;
        }
        return true;
    }

    /**
     * 从一个网格部件复制大小和位置属性到另一个部件
     *
     * @param a - 目标网格部件，接收复制的属性
     * @param b - 源网格部件，提供要复制的属性
     * @param doMinMax - 是否同时复制最小/最大尺寸限制，默认为false
     * @returns 修改后的目标网格部件
     *
     * @remarks
     * - 仅复制已定义的属性（undefined值不会覆盖目标值）
     * - 可选择是否复制minW/minH/maxW/maxH等尺寸限制
     */
    static copyPos(a: GridStackWidget, b: GridStackWidget, doMinMax = false): GridStackWidget {
        if (b.x !== undefined) a.x = b.x;
        if (b.y !== undefined) a.y = b.y;
        if (b.w !== undefined) a.w = b.w;
        if (b.h !== undefined) a.h = b.h;
        if (doMinMax) {
            if (b.minW) a.minW = b.minW;
            if (b.minH) a.minH = b.minH;
            if (b.maxW) a.maxW = b.maxW;
            if (b.maxH) a.maxH = b.maxH;
        }
        return a;
    }

    /**
     * 检查两个网格位置是否完全相同
     *
     * @param a - 第一个网格位置
     * @param b - 第二个网格位置
     * @returns 如果两个位置有相同的x、y、w、h值则返回true，否则返回false
     *
     * @remarks
     * - 如果任一参数为null/undefined，返回false
     * - w和h属性如果未定义则默认为1
     * - x和y必须完全相等
     */
    static samePos(a: GridStackPosition, b: GridStackPosition): boolean {
        return (
            a &&
            b &&
            a.x === b.x &&
            a.y === b.y &&
            (a.w || 1) === (b.w || 1) &&
            (a.h || 1) === (b.h || 1)
        );
    }

    /**
     * 清理节点的最小/最大尺寸限制
     *
     * 删除节点中值为0、undefined或null的最小/最大尺寸属性。
     *
     * @param node - 要清理的网格节点
     *
     * @remarks
     * 检查并删除以下属性（如果它们的值为假值）：
     * - minW: 最小宽度
     * - minH: 最小高度
     * - maxW: 最大宽度
     * - maxH: 最大高度
     */
    static sanitizeMinMax(node: GridStackNode) {
        // 移除为0、undefined或null的属性
        if (!node.minW) {
            delete node.minW;
        }
        if (!node.minH) {
            delete node.minH;
        }
        if (!node.maxW) {
            delete node.maxW;
        }
        if (!node.maxH) {
            delete node.maxH;
        }
    }

    /**
     * 移除第一个对象中与第二个对象相同的字段，以及内部字段（以'_'开头的字段）
     *
     * @param a - 要清理的对象
     * @param b - 用于比较的对象
     *
     * @remarks
     * - 移除 a 中以'_'开头的字段
     * - 如果 a 中字段值与 b 中相同字段的值相等，则移除该字段
     * - 递归处理嵌套对象，如果嵌套对象为空则移除该字段
     * - 如果 a 或 b 不是对象类型，直接返回
     *
     * @example
     * const a = {
     *   _internal: 123,
     *   name: 'test',
     *   size: 10,
     *   child: { x: 1 }
     * };
     * const b = {
     *   name: 'test',
     *   size: 20,
     *   child: { x: 1 }
     * };
     * Utils.removeInternalAndSame(a, b);
     * // 结果: a = { size: 10 }
     * // 因为:
     * // - _internal 被移除（内部字段）
     * // - name 被移除（与 b 相同）
     * // - child 被移除（与 b 相同）
     */
    static removeInternalAndSame(a: unknown, b: unknown): void {
        if (typeof a !== 'object' || typeof b !== 'object') return;
        for (let key in a) {
            const aVal = a[key];
            const bVal = b[key];
            if (key[0] === '_' || aVal === bVal) {
                delete a[key];
            } else if (aVal && typeof aVal === 'object' && bVal !== undefined) {
                Utils.removeInternalAndSame(aVal, bVal);
                if (!Object.keys(aVal).length) {
                    delete a[key];
                }
            }
        }
    }

    /**
     * 删除内部字段和默认值以便保存
     *
     * @param n - 需要清理的网格节点
     * @param removeEl - 是否同时移除el引用，默认为true
     *
     * @remarks
     * 此方法会删除:
     * - 所有以'_'开头的内部字段
     * - 所有值为null或undefined的字段
     * - grid引用
     * - el DOM引用(如果removeEl为true)
     * - 所有为默认值的布尔标志
     * - 宽度和高度如果是默认值(1)或等于最小值
     */
    static removeInternalForSave(n: GridStackNode, removeEl = true): void {
        // 删除所有内部字段(以'_'开头)和空值
        for (let key in n) {
            if (key[0] === '_' || n[key] === null || n[key] === undefined) delete n[key];
        }

        // 删除grid引用
        delete n.grid;
        // 可选删除el DOM引用
        if (removeEl) delete n.el;

        // 删除默认值（将在读取时重新创建）
        if (!n.autoPosition) delete n.autoPosition; // 自动定位为false
        if (!n.noResize) delete n.noResize; // 允许调整大小
        if (!n.noMove) delete n.noMove; // 允许移动
        if (!n.locked) delete n.locked; // 未锁定

        // 删除默认或最小的尺寸值
        if (n.w === 1 || n.w === n.minW) delete n.w; // 宽度为1或最小宽度
        if (n.h === 1 || n.h === n.minH) delete n.h; // 高度为1或最小高度
    }

    /** return the closest parent (or itself) matching the given class */
    // static closestUpByClass(el: HTMLElement, name: string): HTMLElement {
    //   while (el) {
    //     if (el.classList.contains(name)) return el;
    //     el = el.parentElement
    //   }
    //   return null;
    // }

    /**
     * 节流函数，用于限制函数的调用频率
     *
     * @param func - 要节流的函数
     * @param delay - 延迟时间（毫秒）
     * @returns 节流后的函数
     *
     * @remarks
     * - 在延迟期间，多次调用只会执行一次
     * - isWaiting 标志用于跟踪是否在等待期间
     * - 使用 setTimeout 来延迟执行
     *
     * @example
     * // 创建一个节流函数，最少间隔100ms执行一次
     * const throttledFunc = Utils.throttle(() => {
     *   console.log('处理事件');
     * }, 100);
     *
     * // 多次快速调用，但函数最多每100ms执行一次
     * element.addEventListener('mousemove', throttledFunc);
     */
    static throttle(func: () => void, delay: number): () => void {
        let isWaiting = false;
        return (...args) => {
            if (!isWaiting) {
                isWaiting = true;
                setTimeout(() => {
                    func(...args);
                    isWaiting = false;
                }, delay);
            }
        };
    }

    /**
     * 删除一个HTML元素中的定位样式（position、left、top、width、height）
     * @param el - 要删除定位样式的HTML元素
     */

    static removePositioningStyles(el: HTMLElement): void {
        const style = el.style;
        if (style.position) {
            style.removeProperty('position');
        }
        if (style.left) {
            style.removeProperty('left');
        }
        if (style.top) {
            style.removeProperty('top');
        }
        if (style.width) {
            style.removeProperty('width');
        }
        if (style.height) {
            style.removeProperty('height');
        }
    }

    /**
     * 获取可滚动的元素
     *
     * @param el - 可选的起始HTML元素。如果未提供，则返回文档的滚动元素。
     * @returns 如果传入元素可滚动则返回该元素，否则返回最近的可滚动父元素，
     *          如果都没有则返回文档的滚动元素
     *
     * @remarks
     * - 如果未提供元素，返回document.scrollingElement或document.documentElement(IE支持)
     * - 检查元素的overflow和overflowY样式是否包含'auto'或'scroll'值
     * - 如果当前元素不可滚动，则递归检查其父元素
     *
     * @example
     * // 获取元素的最近可滚动父元素
     * const scrollEl = Utils.getScrollElement(myElement);
     *
     * @example
     * // 获取文档的滚动元素
     * const docScrollEl = Utils.getScrollElement();
     */
    static getScrollElement(el?: HTMLElement): HTMLElement {
        if (!el) return (document.scrollingElement as HTMLElement) || document.documentElement; // IE支持
        const style = getComputedStyle(el);
        const overflowRegex = /(auto|scroll)/;

        if (overflowRegex.test(style.overflow + style.overflowY)) {
            return el;
        } else {
            return this.getScrollElement(el.parentElement);
        }
    }

    /**
     * 根据元素位置更新滚动位置
     *
     * @param el - 要滚动的HTML元素
     * @param position - 包含top属性的位置对象
     * @param distance - 滚动距离
     *
     * @remarks
     * 此方法检查元素是否在视口中,并根据需要调整滚动位置:
     * - 如果元素在视口上方或下方,会滚动到适当位置使其可见
     * - 如果元素高度大于视口,则直接按给定距离滚动
     * - 否则滚动距离会基于元素超出视口的部分计算
     * - 滚动后会更新传入的position对象的top值
     */
    static updateScrollPosition(el: HTMLElement, position: {top: number}, distance: number): void {
        // 检查widget是否在视图中
        const rect = el.getBoundingClientRect();
        const innerHeightOrClientHeight =
            window.innerHeight || document.documentElement.clientHeight;
        if (rect.top < 0 || rect.bottom > innerHeightOrClientHeight) {
            // 设置第一个可滚动父元素的scrollTop
            // 如果父元素比el大,则尽可能设置低以使整个widget显示在屏幕上
            const offsetDiffDown = rect.bottom - innerHeightOrClientHeight; // 元素底部超出视口的距离
            const offsetDiffUp = rect.top; // 元素顶部超出视口的距离
            const scrollEl = this.getScrollElement(el);
            if (scrollEl !== null) {
                const prevScroll = scrollEl.scrollTop;
                if (rect.top < 0 && distance < 0) {
                    // 向上移动
                    if (el.offsetHeight > innerHeightOrClientHeight) {
                        // 如果元素高度大于视口,直接按距离滚动
                        scrollEl.scrollTop += distance;
                    } else {
                        // 取较小值:distance或offsetDiffUp
                        scrollEl.scrollTop +=
                            Math.abs(offsetDiffUp) > Math.abs(distance) ? distance : offsetDiffUp;
                    }
                } else if (distance > 0) {
                    // 向下移动
                    if (el.offsetHeight > innerHeightOrClientHeight) {
                        // 如果元素高度大于视口,直接按距离滚动
                        scrollEl.scrollTop += distance;
                    } else {
                        // 取较小值:distance或offsetDiffDown
                        scrollEl.scrollTop += offsetDiffDown > distance ? distance : offsetDiffDown;
                    }
                }
                // 根据滚动量更新widget的y位置
                position.top += scrollEl.scrollTop - prevScroll;
            }
        }
    }

    /**
     * @param event `MouseEvent` that triggers the resize
     * @param el `HTMLElement` that's being resized
     * @param distance Distance from the V edges to start scrolling
     *
     * @internal 用于滚动页面的函数
     *
     * @param event 触发调整大小的`MouseEvent`
     * @param el 正在调整大小的`HTMLElement`
     * @param distance 从V边缘开始滚动的距离
     */
    static updateScrollResize(event: MouseEvent, el: HTMLElement, distance: number): void {
        const scrollEl = this.getScrollElement(el);
        const height = scrollEl.clientHeight;
        // #1727 event.clientY is relative to viewport, so must compare this against position of scrollEl getBoundingClientRect().top
        // #1745 Special situation if scrollEl is document 'html': here browser spec states that
        // clientHeight is height of viewport, but getBoundingClientRect() is rectangle of html element;
        // this discrepancy arises because in reality scrollbar is attached to viewport, not html element itself.
        const offsetTop =
            scrollEl === this.getScrollElement() ? 0 : scrollEl.getBoundingClientRect().top;
        const pointerPosY = event.clientY - offsetTop;
        const top = pointerPosY < distance;
        const bottom = pointerPosY > height - distance;

        if (top) {
            // This also can be done with a timeout to keep scrolling while the mouse is
            // in the scrolling zone. (will have smoother behavior)
            scrollEl.scrollBy({
                behavior: 'smooth',
                top: pointerPosY - distance
            });
        } else if (bottom) {
            scrollEl.scrollBy({
                behavior: 'smooth',
                top: distance - (height - pointerPosY)
            });
        }
    }

    /**
     * 浅克隆对象，创建原始对象的一级复制。
     *
     * 此方法创建一个新对象，其中包含原始对象的所有顶级属性。
     * 对于简单值类型会创建副本，但对于嵌套对象和数组仅复制引用。
     *
     * @template T - 要克隆的对象类型
     * @param obj - 要克隆的对象
     * @returns 原始对象的浅克隆
     *
     * @remarks
     * - 如果输入是null、undefined或非对象，则原样返回。
     * - 如果输入是数组，则返回一个新数组，其中包含原始数组的所有元素。
     * - 如果输入是对象，则返回一个包含所有原始属性的新对象。
     * - 注意：此方法不会深度克隆嵌套对象或数组。
     */
    static clone<T>(obj: T): T {
        if (obj === null || obj === undefined || typeof obj !== 'object') {
            return obj;
        }
        // return Object.assign({}, obj);
        if (obj instanceof Array) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [...obj] as any;
        }
        return {...obj};
    }

    /**
     * 创建对象的深度克隆。
     *
     * 此方法对输入对象执行深度复制，递归地克隆嵌套对象。
     * 它会跳过`skipFields`数组中指定的某些字段，如'parentGrid'、'el'、'grid'、'subGrid'和'engine'。
     * 名称以'__'开头的属性也会被跳过，同样函数和循环依赖也不会被复制。
     *
     * @template T - 要克隆的对象类型
     * @param obj - 要创建深度克隆的对象
     * @returns 输入对象的深度克隆
     */
    static cloneDeep<T>(obj: T): T {
        // list of fields we will skip during cloneDeep (nested objects, other internal)
        const skipFields = ['parentGrid', 'el', 'grid', 'subGrid', 'engine'];
        // return JSON.parse(JSON.stringify(obj)); // doesn't work with date format ?
        const ret = Utils.clone(obj);
        for (const key in ret) {
            // NOTE: we don't support function/circular dependencies so skip those properties for now...
            if (
                ret.hasOwnProperty(key) &&
                typeof ret[key] === 'object' &&
                key.substring(0, 2) !== '__' &&
                !skipFields.find((k) => k === key)
            ) {
                ret[key] = Utils.cloneDeep(obj[key]);
            }
        }
        return ret;
    }

    /**
     * 深度克隆给定的HTML节点，同时移除唯一ID字段
     *
     * @param el - 要克隆的HTML元素
     * @returns 克隆后的HTML元素（不包含原始ID属性）
     *
     * @example
     * // 克隆一个元素并移除其ID
     * const clone = Utils.cloneNode(originalElement);
     *
     * @remarks
     * 此方法使用原生的cloneNode(true)方法创建深度复制，
     * 然后移除ID属性以避免DOM中出现重复ID。
     * 这对于需要复制元素但不希望ID冲突的情况很有用。
     */
    public static cloneNode(el: HTMLElement): HTMLElement {
        const node = el.cloneNode(true) as HTMLElement;
        node.removeAttribute('id');
        return node;
    }

    /**
     * 将元素附加到父元素
     *
     * @param el - 要附加的HTML元素
     * @param parent - 目标父元素，可以是字符串选择器或HTMLElement对象
     *
     * @example
     * // 通过选择器将元素附加到父元素
     * Utils.appendTo(newElement, '#container');
     *
     * @example
     * // 直接将元素附加到DOM节点
     * Utils.appendTo(newElement, parentNode);
     */
    public static appendTo(el: HTMLElement, parent: string | HTMLElement): void {
        let parentNode: HTMLElement;
        if (typeof parent === 'string') {
            parentNode = Utils.getElement(parent);
        } else {
            parentNode = parent;
        }
        if (parentNode) {
            parentNode.appendChild(el);
        }
    }

    /**
     * 向HTML元素添加样式
     *
     * @param el - 要应用样式的HTML元素
     * @param styles - 包含样式属性和值的对象。值可以是字符串或字符串数组（用于提供后备值）
     *
     * @example
     * // 添加单个样式
     * Utils.addElStyles(element, { color: 'red' });
     *
     * @example
     * // 添加多个样式
     * Utils.addElStyles(element, {
     *   color: 'red',
     *   backgroundColor: 'blue'
     * });
     *
     * @example
     * // 添加带有后备值的样式（如CSS前缀）
     * Utils.addElStyles(element, {
     *   display: ['-ms-grid', 'grid']
     * });
     */
    public static addElStyles(
        el: HTMLElement,
        styles: {
            [prop: string]: string | string[];
        }
    ): void {
        if (styles instanceof Object) {
            for (const s in styles) {
                if (styles.hasOwnProperty(s)) {
                    if (Array.isArray(styles[s])) {
                        // 支持后备值
                        (styles[s] as string[]).forEach((val) => {
                            el.style[s] = val;
                        });
                    } else {
                        el.style[s] = styles[s];
                    }
                }
            }
        }
    }

    /**
     * 使用现有事件的属性初始化一个新事件对象
     *
     * @param e - 源事件对象(DragEvent或MouseEvent)
     * @param info - 包含新事件类型和可选目标的配置对象
     * @returns 初始化后的新事件对象
     *
     * @remarks
     * 此方法从源事件复制关键属性到新事件对象，包括：
     * - 修饰键状态(alt, ctrl, meta, shift)
     * - 位置信息(pageX/Y, clientX/Y, screenX/Y)
     * - 默认鼠标按钮状态和事件行为特性
     */
    public static initEvent<T>(
        e: DragEvent | MouseEvent,
        info: {type: string; target?: EventTarget}
    ): T {
        const evt = {type: info.type};
        const obj = {
            button: 0,
            which: 0,
            buttons: 1,
            bubbles: true,
            cancelable: true,
            target: info.target ? info.target : e.target
        };
        ['altKey', 'ctrlKey', 'metaKey', 'shiftKey'].forEach((p) => (evt[p] = e[p])); // 修饰键
        ['pageX', 'pageY', 'clientX', 'clientY', 'screenX', 'screenY'].forEach(
            (p) => (evt[p] = e[p])
        ); // 位置信息
        return {...evt, ...obj} as unknown as T;
    }

    /**
     * 通过创建并分发指定类型的新MouseEvent来模拟鼠标事件。
     *
     * @param e - 用作模拟事件模板的原始MouseEvent或Touch对象
     * @param simulatedType - 要模拟的鼠标事件类型（例如，'mousedown'、'mouseup'、'click'）
     * @param target - 可选的目标元素，用于分发事件。如果未提供，则使用原始事件的目标
     *
     * @remarks
     * 此方法创建一个新的MouseEvent，其属性从原始事件复制而来，
     * 然后在指定的目标或原始事件的目标上分发它。
     * 这对于以编程方式响应其他输入事件而触发鼠标事件很有用。
     */
    public static simulateMouseEvent(
        e: MouseEvent | Touch,
        simulatedType: string,
        target?: EventTarget
    ): void {
        const me = e as MouseEvent;
        const simulatedEvent = new MouseEvent(simulatedType, {
            bubbles: true,
            composed: true,
            cancelable: true,
            view: window,
            detail: 1,
            screenX: e.screenX,
            screenY: e.screenY,
            clientX: e.clientX,
            clientY: e.clientY,
            ctrlKey: me.ctrlKey ?? false,
            altKey: me.altKey ?? false,
            shiftKey: me.shiftKey ?? false,
            metaKey: me.metaKey ?? false,
            button: 0,
            relatedTarget: e.target
        });

        (target || e.target).dispatchEvent(simulatedEvent);
    }

    /**
     *
     * 计算变换后父元素的缩放和偏移值。
     *
     * 此方法在父元素内创建一个临时div元素，测量其边界客户端矩形，
     * 然后计算由于CSS变换应用于父元素的缩放因子和偏移量。
     *
     * @param parent - 要获取变换值的HTMLElement
     * @returns 一个包含缩放因子和偏移量的DragTransform对象：
     *          - xScale: x轴上的逆缩放因子
     *          - yScale: y轴上的逆缩放因子
     *          - xOffset: 左侧偏移值
     *          - yOffset: 顶部偏移值
     */
    public static getValuesFromTransformedElement(parent: HTMLElement): DragTransform {
        const transformReference = document.createElement('div');
        Utils.addElStyles(transformReference, {
            opacity: '0',
            position: 'fixed',
            top: 0 + 'px',
            left: 0 + 'px',
            width: '1px',
            height: '1px',
            zIndex: '-999999'
        });
        parent.appendChild(transformReference);
        const transformValues = transformReference.getBoundingClientRect();
        parent.removeChild(transformReference);
        transformReference.remove();
        return {
            xScale: 1 / transformValues.width,
            yScale: 1 / transformValues.height,
            xOffset: transformValues.left,
            yOffset: transformValues.top
        };
    }

    /**
     *
     * 交换给定对象的两个字段值
     *
     * @param o - 要操作的对象
     * @param a - 第一个字段名
     * @param b - 第二个字段名
     *
     * @example
     * // 交换对象中的x和y值
     * const pos = {x: 10, y: 20};
     * Utils.swap(pos, 'x', 'y'); // 现在pos为 {x: 20, y: 10}
     */
    public static swap(o: unknown, a: string, b: string): void {
        if (!o) return;
        const tmp = o[a];
        o[a] = o[b];
        o[b] = tmp;
    }

    /** returns true if event is inside the given element rectangle */
    // Note: Safari Mac has null event.relatedTarget which causes #1684 so check if DragEvent is inside the coordinates instead
    //    this.el.contains(event.relatedTarget as HTMLElement)
    // public static inside(e: MouseEvent, el: HTMLElement): boolean {
    //   // srcElement, toElement, target: all set to placeholder when leaving simple grid, so we can't use that (Chrome)
    //   const target: HTMLElement = e.relatedTarget || (e as any).fromElement;
    //   if (!target) {
    //     const { bottom, left, right, top } = el.getBoundingClientRect();
    //     return (e.x < right && e.x > left && e.y < bottom && e.y > top);
    //   }
    //   return el.contains(target);
    // }

    /**
     * 判断一个网格节点是否可以旋转
     *
     * @param n - 要检查的网格节点
     * @returns 如果节点可以旋转则返回true，否则返回false
     *
     * 以下情况节点不能旋转：
     * - 节点为空
     * - 节点宽度等于高度（已经是正方形）
     * - 节点被锁定
     * - 节点设置了noResize标志
     * - 网格设置了disableResize选项
     * - 节点的最小宽度等于最大宽度（宽度被固定）
     * - 节点的最小高度等于最大高度（高度被固定）
     */
    public static canBeRotated(n: GridStackNode): boolean {
        return !(
            !n ||
            n.w === n.h ||
            n.locked ||
            n.noResize ||
            n.grid?.opts.disableResize ||
            (n.minW && n.minW === n.maxW) ||
            (n.minH && n.minH === n.maxH)
        );
    }
}
