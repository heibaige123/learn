/**
 * gridstack-engine.ts 11.5.0-dev
 * Copyright (c) 2021-2024  Alain Dumesny - see GridStack root license
 */

import {Utils} from './utils';
import {
    GridStackNode,
    ColumnOptions,
    GridStackPosition,
    GridStackMoveOpts,
    SaveFcn,
    CompactOptions
} from './types';

/** 更新 DOM 属性的回调函数，因为此类是通用的（没有 HTML 或其他信息），用于处理已更改的项目 - 请参阅 _notify() */
type OnChangeCB = (nodes: GridStackNode[]) => void;

/** 创建时使用的选项 - 类似于 GridStackOptions */
export interface GridStackEngineOptions {
    column?: number;
    maxRow?: number;
    float?: boolean;
    nodes?: GridStackNode[];
    onChange?: OnChangeCB;
}

/**
 * 定义了 GridStack 引擎，该引擎负责大部分与 DOM 无关的网格操作。
 * 请参阅 GridStack 方法和变量的描述。
 *
 * 注意：值不应直接修改 - 请调用主 GridStack API。
 */
export class GridStackEngine {
    public column: number; // 网格的列数
    public maxRow: number; // 网格的最大行数
    public nodes: GridStackNode[]; // 当前网格中的节点列表
    public addedNodes: GridStackNode[] = []; // 新增的节点列表
    public removedNodes: GridStackNode[] = []; // 移除的节点列表
    public batchMode: boolean; // 是否处于批量更新模式
    public defaultColumn = 12; // 默认的列数
    /** @internal 更新 DOM 属性的回调函数 */
    protected onChange: OnChangeCB;
    /** @internal 是否启用浮动模式 */
    protected _float: boolean;
    /** @internal 上一次的浮动模式状态 */
    protected _prevFloat: boolean;
    /** @internal 缓存不同列数的布局，以便可以恢复（例如 12 -> 1 -> 12） */
    protected _layouts?: GridStackNode[][]; // 映射列数到节点数组
    /** @internal 在加载期间设置（已排序），以便在碰撞节点之后添加项目 */
    public _loading?: boolean;
    /** @internal 在列调整大小期间用于跳过某些部分的标志 */
    protected _inColumnResize?: boolean;
    /** 如果为 true，则在 grid.load() 已缓存布局时可以跳过越界缓存信息 */
    public skipCacheUpdate?: boolean;
    /** @internal 如果有一些项目被锁定，则为 true */
    protected _hasLocked: boolean;
    /** @internal 唯一的全局内部 _id 计数器 */
    public static _idSeq = 0;

    /**
     * 构造函数，用于初始化 GridStackEngine 实例
     * @param opts 配置选项
     */
    public constructor(opts: GridStackEngineOptions = {}) {
        this.column = opts.column || this.defaultColumn; // 设置网格的列数，默认为 defaultColumn
        if (this.column > this.defaultColumn) this.defaultColumn = this.column; // 如果列数大于默认值，则更新默认列数
        this.maxRow = opts.maxRow; // 设置网格的最大行数
        this._float = opts.float; // 是否启用浮动模式
        this.nodes = opts.nodes || []; // 初始化节点列表
        this.onChange = opts.onChange; // 设置节点更改的回调函数
    }

    /**
     * 批量更新模式的开启和关闭
     * @param flag 是否开启批量更新模式，默认为 true
     * @param doPack 是否在关闭批量更新模式时重新整理节点，默认为 true
     * @returns 当前的 GridStackEngine 实例
     */
    public batchUpdate(flag = true, doPack = true): GridStackEngine {
        // 如果当前模式已经是目标模式，则直接返回
        if (!!this.batchMode === flag) return this;

        this.batchMode = flag; // 设置批量更新模式的状态

        if (flag) {
            // 开启批量更新模式
            this._prevFloat = this._float; // 保存当前浮动模式状态
            this._float = true; // 暂时允许节点自由移动
            this.cleanNodes(); // 清理节点的脏状态
            this.saveInitial(); // 保存初始状态，便于后续检测更改
        } else {
            // 关闭批量更新模式
            this._float = this._prevFloat; // 恢复之前的浮动模式状态
            delete this._prevFloat; // 删除临时保存的浮动模式状态
            if (doPack) this._packNodes(); // 如果需要，重新整理节点
            this._notify(); // 通知更改
        }

        return this; // 返回当前实例
    }

    /**
     * 判断是否使用整行作为碰撞检测区域
     * @param node 当前节点
     * @param nn 新位置
     * @returns 如果满足条件，返回 true，否则返回 false
     */
    protected _useEntireRowArea(node: GridStackNode, nn: GridStackPosition): boolean {
        return (
            (!this.float || (this.batchMode && !this._prevFloat)) && // 如果未启用浮动模式，或者处于批量模式且之前未启用浮动模式
            !this._hasLocked && // 如果没有锁定的节点
            (!node._moving || node._skipDown || nn.y <= node.y) // 如果节点未移动，或者跳过向下移动，或者新位置的 y 值不大于当前节点的 y 值
        );
    }

    /** @internal 修复给定节点 'node' 的碰撞问题，将其移动到新位置 'nn'，并可选地提供已找到的 'collide' 节点。
     * 如果移动了节点，则返回 true。 */
    protected _fixCollisions(
        node: GridStackNode,
        nn = node,
        collide?: GridStackNode,
        opt: GridStackMoveOpts = {}
    ): boolean {
        this.sortNodes(-1); // 从最后一个节点到第一个节点排序，以便递归碰撞时按正确顺序移动项目

        collide = collide || this.collide(node, nn); // 实际区域碰撞检测，用于交换和跳过无碰撞的情况
        if (!collide) return false;

        // 检查交换：如果我们在重力模式下主动移动，检查是否与大小相同的对象碰撞
        if (node._moving && !opt.nested && !this.float) {
            if (this.swap(node, collide)) return true;
        }

        // 在 while() 碰撞期间，确保检查整行，以防较大的项目跳过较小的项目（从网格中的最后一个项目开始向下推）
        let area = nn;
        if (!this._loading && this._useEntireRowArea(node, nn)) {
            area = {x: 0, w: this.column, y: nn.y, h: nn.h};
            collide = this.collide(node, area, opt.skip); // 强制重新检测碰撞
        }

        let didMove = false;
        const newOpt: GridStackMoveOpts = {nested: true, pack: false};
        let counter = 0;
        while ((collide = collide || this.collide(node, area, opt.skip))) {
            // 可能与多个项目碰撞，因此需要对每个项目重复处理
            if (counter++ > this.nodes.length * 2) {
                throw new Error('无限碰撞检测');
            }
            let moved: boolean;
            // 如果与锁定的项目碰撞，或者正在加载（移动到后面），或者在顶部重力模式下向下移动（并且碰撞的项目可以向上移动）-> 跳过碰撞项目，
            // 但记住跳过向下移动，以便仅执行一次（并推动其他项目）。
            if (
                collide.locked ||
                this._loading ||
                (node._moving &&
                    !node._skipDown &&
                    nn.y > node.y &&
                    !this.float &&
                    // 可以占用我们之前的位置，或者在我们将要去的位置之前
                    (!this.collide(collide, {...collide, y: node.y}, node) ||
                        !this.collide(collide, {...collide, y: nn.y - collide.h}, node)))
            ) {
                node._skipDown = node._skipDown || nn.y > node.y;
                const newNN = {...nn, y: collide.y + collide.h, ...newOpt};
                // 假装我们移动到了当前位置，以便继续进行任何碰撞检查 #2492
                moved =
                    this._loading && Utils.samePos(node, newNN) ? true : this.moveNode(node, newNN);

                if ((collide.locked || this._loading) && moved) {
                    Utils.copyPos(nn, node); // 移动到锁定项目之后成为我们新的目标位置
                } else if (!collide.locked && moved && opt.pack) {
                    // 如果我们移动到了后面并将进行整理：立即执行整理并保持原始放置位置，但超出旧的碰撞位置以查看我们可能推动了什么
                    this._packNodes();
                    nn.y = collide.y + collide.h;
                    Utils.copyPos(node, nn);
                }
                didMove = didMove || moved;
            } else {
                // 将碰撞项目向下移动到我们将要去的位置之后，忽略我们现在的位置（不要与我们自己碰撞）
                moved = this.moveNode(collide, {...collide, y: nn.y + nn.h, skip: node, ...newOpt});
            }

            if (!moved) return didMove; // 如果无法移动，则中断无限循环（例如：maxRow、固定位置）

            collide = undefined;
        }
        return didMove;
    }

    /**
     * 返回与给定节点相交的节点。可以选择使用不同的区域进行检测，并且可以跳过第二个节点。
     * @param skip 要跳过的节点
     * @param area 用于检测的区域，默认为 skip 节点的区域
     * @param skip2 要跳过的第二个节点（可选）
     * @returns 如果找到相交的节点，则返回该节点；否则返回 undefined
     */
    public collide(
        skip: GridStackNode,
        area = skip,
        skip2?: GridStackNode
    ): GridStackNode | undefined {
        const skipId = skip._id; // 跳过的节点 ID
        const skip2Id = skip2?._id; // 跳过的第二个节点 ID（如果存在）
        return this.nodes.find(
            (n) => n._id !== skipId && n._id !== skip2Id && Utils.isIntercepted(n, area)
        );
    }
    /**
     * 返回与给定节点相交的所有节点。可以选择使用不同的区域进行检测，并且可以跳过第二个节点。
     * @param skip 要跳过的节点
     * @param area 用于检测的区域，默认为 skip 节点的区域
     * @param skip2 要跳过的第二个节点（可选）
     * @returns 返回与给定区域相交的所有节点
     */
    public collideAll(skip: GridStackNode, area = skip, skip2?: GridStackNode): GridStackNode[] {
        const skipId = skip._id; // 跳过的节点 ID
        const skip2Id = skip2?._id; // 跳过的第二个节点 ID（如果存在）
        return this.nodes.filter(
            (n) => n._id !== skipId && n._id !== skip2Id && Utils.isIntercepted(n, area)
        );
    }

    /** 基于像素覆盖的碰撞检测，返回覆盖率超过 50% 的节点 */
    protected directionCollideCoverage(
        node: GridStackNode,
        o: GridStackMoveOpts,
        collides: GridStackNode[]
    ): GridStackNode | undefined {
        if (!o.rect || !node._rect) return;
        const r0 = node._rect; // 起始位置
        const r = {...o.rect}; // 当前拖动位置

        // 更新拖动矩形以显示其来源方向（上方、下方等）
        if (r.y > r0.y) {
            r.h += r.y - r0.y;
            r.y = r0.y;
        } else {
            r.h += r0.y - r.y;
        }
        if (r.x > r0.x) {
            r.w += r.x - r0.x;
            r.x = r0.x;
        } else {
            r.w += r0.x - r.x;
        }

        let collide: GridStackNode;
        let overMax = 0.5; // 需要超过 50% 的覆盖率
        for (let n of collides) {
            if (n.locked || !n._rect) {
                break;
            }
            const r2 = n._rect; // 重叠目标
            let yOver = Number.MAX_VALUE,
                xOver = Number.MAX_VALUE;
            // 根据起始方向计算覆盖率百分比
            // （例如：从上方/下方仅计算最大水平线覆盖率）
            if (r0.y < r2.y) {
                // 从上方
                yOver = (r.y + r.h - r2.y) / r2.h;
            } else if (r0.y + r0.h > r2.y + r2.h) {
                // 从下方
                yOver = (r2.y + r2.h - r.y) / r2.h;
            }
            if (r0.x < r2.x) {
                // 从左侧
                xOver = (r.x + r.w - r2.x) / r2.w;
            } else if (r0.x + r0.w > r2.x + r2.w) {
                // 从右侧
                xOver = (r2.x + r2.w - r.x) / r2.w;
            }
            const over = Math.min(xOver, yOver);
            if (over > overMax) {
                overMax = over;
                collide = n;
            }
        }
        o.collide = collide; // 保存结果以避免重复查找
        return collide;
    }

    /** 通过像素覆盖返回覆盖面积最大的节点 */
    /*
    protected collideCoverage(r: GridStackPosition, collides: GridStackNode[]): {collide: GridStackNode, over: number} {
    const collide: GridStackNode;
    const overMax = 0;
    collides.forEach(n => {
      if (n.locked || !n._rect) return;
      const over = Utils.areaIntercept(r, n._rect);
      if (over > overMax) {
      overMax = over;
      collide = n;
      }
    });
    return {collide, over: overMax};
    }
    */

    /** 用于缓存节点的像素矩形，在拖动期间用于碰撞检测 */
    public cacheRects(
        w: number,
        h: number,
        top: number,
        right: number,
        bottom: number,
        left: number
    ): GridStackEngine {
        this.nodes.forEach(
            (n) =>
                (n._rect = {
                    y: n.y * h + top, // 计算矩形的顶部位置
                    x: n.x * w + left, // 计算矩形的左侧位置
                    w: n.w * w - left - right, // 计算矩形的宽度
                    h: n.h * h - top - bottom // 计算矩形的高度
                })
        );
        return this;
    }

    /**
     * 尝试在两个节点之间进行交换（相同大小或列，不锁定，接触），如果成功返回 true
     * @param a 第一个节点
     * @param b 第二个节点
     * @returns 如果交换成功返回 true，否则返回 false 或 undefined
     */
    public swap(a: GridStackNode, b: GridStackNode): boolean | undefined {
        if (!b || b.locked || !a || a.locked) return false;

        function _doSwap(): true {
            // 假设 a 在 b 之前 IFF 它们具有不同的高度（放在 b 之后而不是完全交换）
            const x = b.x,
                y = b.y;
            b.x = a.x;
            b.y = a.y; // b -> 移动到 a 的位置
            if (a.h != b.h) {
                a.x = x;
                a.y = b.y + b.h; // a -> 移动到 b 的后面
            } else if (a.w != b.w) {
                a.x = b.x + b.w;
                a.y = y; // a -> 移动到 b 的后面
            } else {
                a.x = x;
                a.y = y; // a -> 移动到 b 的旧位置
            }
            a._dirty = b._dirty = true;
            return true;
        }
        let touching: boolean; // 记录是否调用了接触检测（vs undefined）

        // 如果大小相同并且在同一行或列上，并且接触
        if (
            a.w === b.w &&
            a.h === b.h &&
            (a.x === b.x || a.y === b.y) &&
            (touching = Utils.isTouching(a, b))
        )
            return _doSwap();
        if (touching === false) return; // 如果检测失败，直接返回

        // 检查是否占用相同的列（但高度不同）并且接触
        if (a.w === b.w && a.x === b.x && (touching || (touching = Utils.isTouching(a, b)))) {
            if (b.y < a.y) {
                const t = a;
                a = b;
                b = t;
            } // 交换 a 和 b 的变量，使 a 在前
            return _doSwap();
        }
        if (touching === false) return;

        // 检查是否占用相同的行（但宽度不同）并且接触
        if (a.h === b.h && a.y === b.y && (touching || (touching = Utils.isTouching(a, b)))) {
            if (b.x < a.x) {
                const t = a;
                a = b;
                b = t;
            } // 交换 a 和 b 的变量，使 a 在前
            return _doSwap();
        }
        return false;
    }

    /**
     * 检查指定区域是否为空
     * @param x 区域的起始 x 坐标
     * @param y 区域的起始 y 坐标
     * @param w 区域的宽度
     * @param h 区域的高度
     * @returns 如果区域为空返回 true，否则返回 false
     */
    public isAreaEmpty(x: number, y: number, w: number, h: number): boolean {
        const nn: GridStackNode = {x: x || 0, y: y || 0, w: w || 1, h: h || 1};
        return !this.collide(nn);
    }

    /**
     * 重新布局网格项以回收任何空白空间 - 可选地保持排序顺序完全相同（'list' 模式）或真正找到空白空间
     * @param layout 布局选项，默认为 'compact'，可以是 'list' 或 'compact'
     * @param doSort 是否在重新布局之前对节点进行排序，默认为 true
     * @returns 当前的 GridStackEngine 实例
     */
    public compact(layout: CompactOptions = 'compact', doSort = true): GridStackEngine {
        if (this.nodes.length === 0) return this; // 如果没有节点，直接返回
        if (doSort) this.sortNodes(); // 如果需要排序，则对节点进行排序
        const wasBatch = this.batchMode; // 保存当前是否处于批量模式
        if (!wasBatch) this.batchUpdate(); // 如果不是批量模式，则开启批量模式
        const wasColumnResize = this._inColumnResize; // 保存当前是否处于列调整大小模式
        if (!wasColumnResize) this._inColumnResize = true; // 如果不是列调整大小模式，则开启列调整大小模式（更快的 addNode() 操作）
        const copyNodes = this.nodes; // 复制当前节点列表
        this.nodes = []; // 清空节点列表，模拟没有节点的状态以避免布局冲突
        copyNodes.forEach((n, index, list) => {
            let after: GridStackNode; // 用于在 'list' 模式下指定插入位置
            if (!n.locked) {
                n.autoPosition = true; // 设置自动定位
                if (layout === 'list' && index) after = list[index - 1]; // 如果是 'list' 模式且不是第一个节点，则设置插入位置为前一个节点
            }
            this.addNode(n, false, after); // 添加节点到网格中，'false' 表示不触发添加事件
        });
        if (!wasColumnResize) delete this._inColumnResize; // 如果之前不是列调整大小模式，则恢复状态
        if (!wasBatch) this.batchUpdate(false); // 如果之前不是批量模式，则关闭批量模式
        return this; // 返回当前实例
    }

    /** 启用/禁用浮动小部件（默认值：`false`）。参见 [示例](http://gridstackjs.com/demo/float.html) */
    public set float(val: boolean) {
        if (this._float === val) return; // 如果值未改变，则直接返回
        this._float = val || false; // 设置浮动模式
        if (!val) {
            this._packNodes()._notify(); // 如果禁用浮动模式，重新整理节点并通知更改
        }
    }

    /** 获取浮动模式的状态 */
    public get float(): boolean {
        return this._float || false; // 返回浮动模式的状态
    }

    /** 按顺序或逆序对节点数组进行排序。在碰撞/放置期间调用以强制顺序 */
    public sortNodes(dir: 1 | -1 = 1): GridStackEngine {
        this.nodes = Utils.sort(this.nodes, dir); // 使用工具方法对节点进行排序
        return this; // 返回当前实例
    }

    /** @internal 调用此方法将项目向上重力压缩回顶部，或者在浮动模式下恢复到原始的 Y 位置 */
    protected _packNodes(): GridStackEngine {
        if (this.batchMode) {
            return this;
        }
        this.sortNodes(); // 按从第一个到最后一个节点排序

        if (this.float) {
            // 恢复到原始的 Y 位置
            this.nodes.forEach((n) => {
                if (n._updating || n._orig === undefined || n.y === n._orig.y) return;
                let newY = n.y;
                while (newY > n._orig.y) {
                    --newY;
                    const collide = this.collide(n, {x: n.x, y: newY, w: n.w, h: n.h});
                    if (!collide) {
                        n._dirty = true; // 标记为脏节点
                        n.y = newY; // 更新 Y 位置
                    }
                }
            });
        } else {
            // 向上重力压缩
            this.nodes.forEach((n, i) => {
                if (n.locked) return; // 跳过锁定的节点
                while (n.y > 0) {
                    const newY = i === 0 ? 0 : n.y - 1; // 计算新的 Y 位置
                    const canBeMoved =
                        i === 0 || !this.collide(n, {x: n.x, y: newY, w: n.w, h: n.h});
                    if (!canBeMoved) break; // 如果无法移动，退出循环
                    // 注意：必须标记为脏节点（从上一个位置开始），以便 GridStack::OnChange 回调更新位置
                    // 并将项目移回。用户的 'change' 回调应该检测从原始起始位置的变化。
                    n._dirty = n.y !== newY; // 如果位置发生变化，标记为脏节点
                    n.y = newY; // 更新 Y 位置
                }
            });
        }
        return this; // 返回当前实例
    }

    /**
     * 给定一个随机节点，确保其坐标/值在当前网格中是有效的
     * @param node 要调整的节点
     * @param resizing 如果超出边界，是缩小尺寸还是移动到网格内以适应？
     * @returns 返回调整后的节点
     */
    public prepareNode(node: GridStackNode, resizing?: boolean): GridStackNode {
        // 如果节点没有 _id，则分配一个唯一的 _id
        node._id = node._id ?? GridStackEngine._idSeq++;

        // 确保用户提供的 id 在我们的列表中是唯一的，否则分配一个新的 id，以避免在加载/更新等过程中出现问题
        const id = node.id;
        if (id) {
            let count = 1; // 使用 _n 的形式追加，而不是一些随机数
            while (this.nodes.find((n) => n.id === node.id && n !== node)) {
                node.id = id + '_' + count++;
            }
        }

        // 如果缺少位置，让网格自动为我们定位（之前我们将其设置为 0,0）
        if (node.x === undefined || node.y === undefined || node.x === null || node.y === null) {
            node.autoPosition = true;
        }

        // 为缺少的必需字段分配默认值
        const defaults: GridStackNode = {x: 0, y: 0, w: 1, h: 1};
        Utils.defaults(node, defaults);

        // 如果没有启用自动定位，删除 autoPosition 属性
        if (!node.autoPosition) {
            delete node.autoPosition;
        }
        // 如果没有禁用调整大小，删除 noResize 属性
        if (!node.noResize) {
            delete node.noResize;
        }
        // 如果没有禁用移动，删除 noMove 属性
        if (!node.noMove) {
            delete node.noMove;
        }
        // 清理最小值和最大值的约束
        Utils.sanitizeMinMax(node);

        // 检查是否存在 NaN（以防传入了错误的字符串。不能直接使用 parseInt() || defaults.x，因为 0 是有效值）
        if (typeof node.x == 'string') {
            node.x = Number(node.x);
        }
        if (typeof node.y == 'string') {
            node.y = Number(node.y);
        }
        if (typeof node.w == 'string') {
            node.w = Number(node.w);
        }
        if (typeof node.h == 'string') {
            node.h = Number(node.h);
        }
        if (isNaN(node.x)) {
            node.x = defaults.x;
            node.autoPosition = true;
        }
        if (isNaN(node.y)) {
            node.y = defaults.y;
            node.autoPosition = true;
        }
        if (isNaN(node.w)) {
            node.w = defaults.w;
        }
        if (isNaN(node.h)) {
            node.h = defaults.h;
        }

        // 修复节点的边界
        this.nodeBoundFix(node, resizing);
        return node;
    }

    /**
     * 准备节点以适应网格的第二部分 - 根据网格的尺寸检查 x, y, w 的合法性
     * @param node 要调整的节点
     * @param resizing 是否处于调整大小模式
     * @returns 当前的 GridStackEngine 实例
     */
    public nodeBoundFix(node: GridStackNode, resizing?: boolean): GridStackEngine {
        const before = node._orig || Utils.copyPos({}, node); // 保存节点调整前的位置

        // 检查并限制节点的宽度和高度在最大值范围内
        if (node.maxW) {
            node.w = Math.min(node.w || 1, node.maxW);
        }
        if (node.maxH) {
            node.h = Math.min(node.h || 1, node.maxH);
        }
        // 检查并限制节点的宽度和高度在最小值范围内
        if (node.minW) {
            node.w = Math.max(node.w || 1, node.minW);
        }
        if (node.minH) {
            node.h = Math.max(node.h || 1, node.minH);
        }

        // 如果用户加载了超出当前列数的节点，保存其原始位置和宽度以便恢复
        const saveOrig = (node.x || 0) + (node.w || 1) > this.column;
        if (
            saveOrig &&
            this.column < this.defaultColumn &&
            !this._inColumnResize &&
            !this.skipCacheUpdate &&
            node._id &&
            this.findCacheLayout(node, this.defaultColumn) === -1
        ) {
            const copy = {...node}; // 复制节点信息（包括 _id 和位置）
            if (copy.autoPosition || copy.x === undefined) {
                delete copy.x;
                delete copy.y;
            } else copy.x = Math.min(this.defaultColumn - 1, copy.x);
            copy.w = Math.min(this.defaultColumn, copy.w || 1);
            this.cacheOneLayout(copy, this.defaultColumn); // 缓存布局
        }

        // 限制节点宽度在当前列数范围内
        if (node.w > this.column) {
            node.w = this.column;
        } else if (node.w < 1) {
            node.w = 1;
        }

        // 限制节点高度在最大行数范围内
        if (this.maxRow && node.h > this.maxRow) {
            node.h = this.maxRow;
        } else if (node.h < 1) {
            node.h = 1;
        }

        // 确保节点的 x 和 y 坐标不小于 0
        if (node.x < 0) {
            node.x = 0;
        }
        if (node.y < 0) {
            node.y = 0;
        }

        // 如果节点超出网格的右边界，调整其位置或宽度
        if (node.x + node.w > this.column) {
            if (resizing) {
                node.w = this.column - node.x;
            } else {
                node.x = this.column - node.w;
            }
        }
        // 如果节点超出网格的下边界，调整其位置或高度
        if (this.maxRow && node.y + node.h > this.maxRow) {
            if (resizing) {
                node.h = this.maxRow - node.y;
            } else {
                node.y = this.maxRow - node.h;
            }
        }

        // 如果节点的位置或尺寸发生变化，标记为脏节点
        if (!Utils.samePos(node, before)) {
            node._dirty = true;
        }

        return this; // 返回当前实例
    }

    /** 返回从其原始值修改过的节点列表 */
    public getDirtyNodes(verify?: boolean): GridStackNode[] {
        // 比较原始的 x, y, w, h 值，而不是 _dirty，因为 _dirty 可能是临时状态
        if (verify) {
            return this.nodes.filter((n) => n._dirty && !Utils.samePos(n, n._orig));
        }
        return this.nodes.filter((n) => n._dirty);
    }

    /** @internal 调用此方法以使用脏节点调用 onChange 回调函数，从而更新 DOM */
    protected _notify(removedNodes?: GridStackNode[]): GridStackEngine {
        if (this.batchMode || !this.onChange) return this;
        const dirtyNodes = (removedNodes || []).concat(this.getDirtyNodes());
        this.onChange(dirtyNodes);
        return this;
    }

    /** @internal 移除节点的脏状态和最后尝试的信息 */
    public cleanNodes(): GridStackEngine {
        if (this.batchMode) return this;
        this.nodes.forEach((n) => {
            delete n._dirty;
            delete n._lastTried;
        });
        return this;
    }

    /** @internal 保存初始位置/大小以跟踪真实的脏状态。
     * 注意：应在调用更改事件后立即调用（以便下一个 API 可以检测到更改），
     * 以及在开始移动/调整大小/进入之前调用（以便可以将项目恢复到之前的值）。 */
    public saveInitial(): GridStackEngine {
        this.nodes.forEach((n) => {
            n._orig = Utils.copyPos({}, n);
            delete n._dirty;
        });
        this._hasLocked = this.nodes.some((n) => n.locked);
        return this;
    }

    /** @internal 恢复所有节点到初始值（在离开时调用） */
    public restoreInitial(): GridStackEngine {
        this.nodes.forEach((n) => {
            if (!n._orig || Utils.samePos(n, n._orig)) return; // 如果没有初始值或位置未改变，则跳过
            Utils.copyPos(n, n._orig); // 恢复到初始位置
            n._dirty = true; // 标记为脏节点
        });
        this._notify(); // 通知更改
        return this;
    }

    /**
     * 查找给定节点宽度/高度的第一个可用空位，并更新其 x, y 属性。如果找到则返回 true。
     * 可选地，可以传入现有的节点列表和列数，否则默认为当前引擎的数据。
     * 可选地传入一个小部件以从其之后开始搜索，这意味着顺序将保持不变，但可能会跳过一些空槽。
     * @param node 要查找空位的节点
     * @param nodeList 节点列表，默认为当前引擎的节点
     * @param column 列数，默认为当前引擎的列数
     * @param after 可选参数，指定从某个节点之后开始搜索
     * @returns 如果找到空位返回 true，否则返回 false
     */
    public findEmptyPosition(
        node: GridStackNode,
        nodeList = this.nodes,
        column = this.column,
        after?: GridStackNode
    ): boolean {
        const start = after ? after.y * column + (after.x + after.w) : 0; // 计算起始搜索位置
        let found = false;
        for (let i = start; !found; ++i) {
            const x = i % column; // 计算当前列
            const y = Math.floor(i / column); // 计算当前行
            if (x + node.w > column) {
                continue; // 如果宽度超出列数，跳过
            }
            const box = {x, y, w: node.w, h: node.h}; // 创建当前节点的区域
            if (!nodeList.find((n) => Utils.isIntercepted(box, n))) {
                // 检查是否与其他节点相交
                if (node.x !== x || node.y !== y) node._dirty = true; // 如果位置发生变化，标记为脏节点
                node.x = x; // 更新节点的 x 坐标
                node.y = y; // 更新节点的 y 坐标
                delete node.autoPosition; // 删除自动定位标志
                found = true; // 标记为找到空位
            }
        }
        return found; // 返回是否找到空位
    }
    /**
     * 将给定的节点添加到网格中，修复碰撞并重新整理布局。
     * @param node 要添加的节点
     * @param triggerAddEvent 是否触发添加事件，默认为 false
     * @param after 可选参数，用于指定在某个节点之后插入
     * @returns 返回添加的节点
     */
    public addNode(
        node: GridStackNode,
        triggerAddEvent = false,
        after?: GridStackNode
    ): GridStackNode {
        // 检查是否已经存在相同的节点，如果存在则直接返回，防止重复插入
        const dup = this.nodes.find((n) => n._id === node._id);
        if (dup) return dup;

        // 如果正在调整列大小，跳过 prepareNode，但仍需检查边界
        this._inColumnResize ? this.nodeBoundFix(node) : this.prepareNode(node);
        delete node._temporaryRemoved; // 删除临时移除标志
        delete node._removeDOM; // 删除移除 DOM 标志

        let skipCollision: boolean;
        // 如果启用了自动定位，尝试找到一个空位
        if (node.autoPosition && this.findEmptyPosition(node, this.nodes, this.column, after)) {
            delete node.autoPosition; // 找到空位后删除自动定位标志
            skipCollision = true; // 跳过碰撞检测
        }

        // 将节点添加到节点列表中
        this.nodes.push(node);
        if (triggerAddEvent) {
            this.addedNodes.push(node); // 如果需要触发事件，将节点添加到新增节点列表中
        }

        // 如果未跳过碰撞检测，修复碰撞
        if (!skipCollision) this._fixCollisions(node);
        // 如果不在批量模式下，重新整理节点并通知更改
        if (!this.batchMode) {
            this._packNodes()._notify();
        }
        return node; // 返回添加的节点
    }

    /**
     * 从网格中移除指定的节点。
     * @param node 要移除的节点
     * @param removeDOM 是否移除对应的 DOM 元素，默认为 true
     * @param triggerEvent 是否触发移除事件，默认为 false
     * @returns 当前的 GridStackEngine 实例
     */
    public removeNode(
        node: GridStackNode,
        removeDOM = true,
        triggerEvent = false
    ): GridStackEngine {
        if (!this.nodes.find((n) => n._id === node._id)) {
            // 如果节点未找到，直接返回当前实例
            return this;
        }
        if (triggerEvent) {
            // 如果需要触发事件，将节点添加到移除的节点列表中
            this.removedNodes.push(node);
        }
        if (removeDOM) node._removeDOM = true; // 标记节点的 DOM 元素需要被移除
        // 过滤掉要移除的节点，更新节点列表
        this.nodes = this.nodes.filter((n) => n._id !== node._id);
        if (!node._isAboutToRemove) this._packNodes(); // 如果节点不是即将被移除的状态，重新整理网格布局
        this._notify([node]); // 通知更改
        return this;
    }

    /**
     * 移除网格中的所有节点。
     * @param removeDOM 是否移除所有节点对应的 DOM 元素，默认为 true
     * @param triggerEvent 是否触发移除事件，默认为 true
     * @returns 当前的 GridStackEngine 实例
     */
    public removeAll(removeDOM = true, triggerEvent = true): GridStackEngine {
        delete this._layouts; // 清除布局缓存
        if (!this.nodes.length) return this; // 如果没有节点，直接返回当前实例
        if (removeDOM) {
            // 如果需要移除 DOM 元素，标记所有节点的 DOM 元素需要被移除
            this.nodes.forEach((n) => (n._removeDOM = true));
        }
        const removedNodes = this.nodes; // 保存当前的节点列表
        this.removedNodes = triggerEvent ? removedNodes : []; // 如果需要触发事件，更新移除的节点列表
        this.nodes = []; // 清空节点列表
        return this._notify(removedNodes); // 通知更改
    }

    /**
     * 检查项目是否可以移动（布局约束）与 moveNode()，如果能够移动则返回 true。
     * 在更复杂的情况下（如 maxRow），它会尝试在克隆中移动项目并修复其他项目，
     * 然后如果仍然符合规范，则应用这些更改。
     * @param node 要移动的节点
     * @param o 移动选项
     * @returns 如果节点能够移动返回 true，否则返回 false
     */
    public moveNodeCheck(node: GridStackNode, o: GridStackMoveOpts): boolean {
        // 如果位置或尺寸未发生变化，则直接返回 false
        if (!this.changedPosConstrain(node, o)) return false;
        o.pack = true; // 设置 pack 为 true

        // 简单情况：直接移动项目
        if (!this.maxRow) {
            return this.moveNode(node, o);
        }

        // 复杂情况：创建一个没有 maxRow 限制的克隆（将在最后检查是否超出边界）
        let clonedNode: GridStackNode;
        const clone = new GridStackEngine({
            column: this.column,
            float: this.float,
            nodes: this.nodes.map((n) => {
                if (n._id === node._id) {
                    clonedNode = {...n};
                    return clonedNode;
                }
                return {...n};
            })
        });
        if (!clonedNode) return false;

        // 检查是否覆盖了 50% 的碰撞并且可以移动，同时仍然在 maxRow 范围内或至少没有使其变得更糟
        const canMove =
            clone.moveNode(clonedNode, o) && clone.getRow() <= Math.max(this.getRow(), this.maxRow);

        // 如果无法移动，检查是否可以强制交换（float=true 或不同形状）且不是调整大小
        if (!canMove && !o.resizing && o.collide) {
            const collide = o.collide.el.gridstackNode; // 找到克隆中碰撞的源节点
            if (this.swap(node, collide)) {
                // 交换并标记为脏
                this._notify();
                return true;
            }
        }
        if (!canMove) return false;

        // 如果克隆能够移动，现在将这些修改复制到当前实例，而不是让调用者重新尝试
        clone.nodes
            .filter((n) => n._dirty)
            .forEach((c) => {
                const n = this.nodes.find((a) => a._id === c._id);
                if (!n) return;
                Utils.copyPos(n, c); // 复制位置
                n._dirty = true; // 标记为脏
            });
        this._notify(); // 通知更改
        return true;
    }

    /**
     * 如果节点可以在网格的高度约束内放置（如果没有 maxRow 则始终返回 true），返回 true
     * @param node 要检查的节点
     * @returns 如果节点可以放置返回 true，否则返回 false
     */
    public willItFit(node: GridStackNode): boolean {
        delete node._willFitPos; // 删除之前的适配位置缓存
        if (!this.maxRow) return true; // 如果没有最大行限制，始终返回 true

        // 创建一个没有 maxRow 限制的克隆引擎，并检查是否仍然在允许的大小范围内
        const clone = new GridStackEngine({
            column: this.column,
            float: this.float,
            nodes: this.nodes.map((n) => {
                return {...n}; // 克隆每个节点
            })
        });

        const n = {...node}; // 克隆节点以避免修改原始节点，但保留完整的 autoPosition 和 min/max 属性
        this.cleanupNode(n); // 清理节点的内部值
        delete n.el; // 删除 DOM 元素引用
        delete n._id; // 删除内部 ID
        delete n.content; // 删除内容
        delete n.grid; // 删除网格引用

        clone.addNode(n); // 将节点添加到克隆的引擎中
        if (clone.getRow() <= this.maxRow) {
            // 检查克隆引擎的行数是否在限制范围内
            node._willFitPos = Utils.copyPos({}, n); // 缓存适配位置
            return true; // 可以放置
        }
        return false; // 无法放置
    }

    /**
     * 如果 x, y 或 w, h 在经过最小/最大值约束后发生了变化，则返回 true
     * @param node 当前节点
     * @param p 新的位置和尺寸
     * @returns 如果位置或尺寸发生变化，返回 true，否则返回 false
     */
    public changedPosConstrain(node: GridStackNode, p: GridStackPosition): boolean {
        // 首先确保 w 和 h 已为调用者设置
        p.w = p.w || node.w;
        p.h = p.h || node.h;
        // 检查 x 和 y 是否发生变化
        if (node.x !== p.x || node.y !== p.y) return true;
        // 检查受约束的宽度和高度
        if (node.maxW) {
            p.w = Math.min(p.w, node.maxW); // 限制宽度不超过最大值
        }
        if (node.maxH) {
            p.h = Math.min(p.h, node.maxH); // 限制高度不超过最大值
        }
        if (node.minW) {
            p.w = Math.max(p.w, node.minW); // 限制宽度不低于最小值
        }
        if (node.minH) {
            p.h = Math.max(p.h, node.minH); // 限制高度不低于最小值
        }
        // 检查宽度和高度是否发生变化
        return node.w !== p.w || node.h !== p.h;
    }

    /**
     * 如果传入的节点实际被移动了（检查是否无操作或被锁定），返回 true
     * @param node 要移动的节点
     * @param o 移动选项
     * @returns 如果节点被移动返回 true，否则返回 false
     */
    public moveNode(node: GridStackNode, o: GridStackMoveOpts): boolean {
        if (!node || /*node.locked ||*/ !o) return false;
        let wasUndefinedPack: boolean;
        if (o.pack === undefined && !this.batchMode) {
            wasUndefinedPack = o.pack = true; // 如果未定义 pack 且不在批量模式下，设置为 true
        }

        // 约束传入的值，并检查节点是否仍在更改
        if (typeof o.x !== 'number') {
            o.x = node.x; // 如果未定义 x，使用节点的当前 x
        }
        if (typeof o.y !== 'number') {
            o.y = node.y; // 如果未定义 y，使用节点的当前 y
        }
        if (typeof o.w !== 'number') {
            o.w = node.w; // 如果未定义 w，使用节点的当前宽度
        }
        if (typeof o.h !== 'number') {
            o.h = node.h; // 如果未定义 h，使用节点的当前高度
        }
        const resizing = node.w !== o.w || node.h !== o.h; // 检查是否正在调整大小
        const nn: GridStackNode = Utils.copyPos({}, node, true); // 获取最小/最大值
        Utils.copyPos(nn, o); // 将新位置复制到 nn
        this.nodeBoundFix(nn, resizing); // 修复节点边界
        Utils.copyPos(o, nn); // 将修复后的位置复制回选项

        if (!o.forceCollide && Utils.samePos(node, o)) return false; // 如果位置未更改且未强制碰撞，返回 false
        const prevPos: GridStackPosition = Utils.copyPos({}, node); // 保存之前的位置

        // 检查新位置是否需要修复碰撞
        const collides = this.collideAll(node, nn, o.skip);
        let needToMove = true;
        if (collides.length) {
            const activeDrag = node._moving && !o.nested; // 检查是否处于主动拖动状态
            // 检查拖动时是否实际碰撞超过 50% 的表面积
            let collide = activeDrag
                ? this.directionCollideCoverage(node, o, collides)
                : collides[0];
            // 如果启用了动态子网格创建，检查是否覆盖了 80% 的面积
            if (activeDrag && collide && node.grid?.opts?.subGridDynamic && !node.grid._isTemp) {
                const over = Utils.areaIntercept(o.rect, collide._rect);
                const a1 = Utils.area(o.rect);
                const a2 = Utils.area(collide._rect);
                const perc = over / (a1 < a2 ? a1 : a2);
                if (perc > 0.8) {
                    collide.grid.makeSubGrid(collide.el, undefined, node); // 创建子网格
                    collide = undefined;
                }
            }

            if (collide) {
                needToMove = !this._fixCollisions(node, nn, collide, o); // 检查是否已移动
            } else {
                needToMove = false; // 未覆盖 >50%，跳过移动
                if (wasUndefinedPack) delete o.pack; // 删除 pack 属性
            }
        }

        // 现在移动节点到原始请求的位置，并重新整理
        if (needToMove && !Utils.samePos(node, nn)) {
            node._dirty = true; // 标记节点为脏
            Utils.copyPos(node, nn); // 更新节点位置
        }
        if (o.pack) {
            this._packNodes()._notify(); // 重新整理节点并通知更改
        }
        return !Utils.samePos(node, prevPos); // 如果位置发生变化，返回 true
    }

    /**
     * 获取当前网格的行数。
     * @returns 返回网格中占用的最大行数。
     */
    public getRow(): number {
        return this.nodes.reduce((row, n) => Math.max(row, n.y + n.h), 0);
    }

    /**
     * 开始更新模式，标记节点为正在更新状态。
     * @param node 要更新的节点
     * @returns 当前的 GridStackEngine 实例
     */
    public beginUpdate(node: GridStackNode): GridStackEngine {
        if (!node._updating) {
            node._updating = true; // 标记节点为正在更新状态
            delete node._skipDown; // 删除跳过向下移动标志
            if (!this.batchMode) this.saveInitial(); // 如果不在批量模式下，保存初始状态
        }
        return this; // 返回当前实例
    }

    /**
     * 结束更新模式，清除节点的更新状态。
     * @returns 当前的 GridStackEngine 实例
     */
    public endUpdate(): GridStackEngine {
        const n = this.nodes.find((n) => n._updating); // 查找处于更新状态的节点
        if (n) {
            delete n._updating; // 删除更新状态标志
            delete n._skipDown; // 删除跳过向下移动标志
        }
        return this; // 返回当前实例
    }

    /**
     * 保存最大列布局的副本（例如，即使在渲染单列模式时也保存 12 列布局），以便不会丢失原始布局，
     * 并返回用于序列化的小部件列表。
     * @param saveElement 是否保存元素信息，默认为 true
     * @param saveCB 可选的回调函数，用于在保存时处理节点
     * @returns 返回保存的小部件列表
     */
    public save(saveElement = true, saveCB?: SaveFcn): GridStackNode[] {
        // 使用最高的布局信息进行保存，以便在重新加载时可以获得完整的细节 #1849
        const len = this._layouts?.length;
        const layout = len && this.column !== len - 1 ? this._layouts[len - 1] : null;
        const list: GridStackNode[] = [];
        this.sortNodes(); // 对节点进行排序
        this.nodes.forEach((n) => {
            const wl = layout?.find((l) => l._id === n._id); // 查找布局中的对应节点
            // 如果布局信息存在，则使用布局信息字段
            const w: GridStackNode = {...n, ...(wl || {})};
            Utils.removeInternalForSave(w, !saveElement); // 移除内部字段以便保存
            if (saveCB) saveCB(n, w); // 如果提供了回调函数，则调用
            list.push(w); // 将节点添加到保存列表中
        });
        return list;
    }

    /** @internal 每当节点被添加或移动时调用 - 更新缓存的布局 */
    public layoutsNodesChange(nodes: GridStackNode[]): GridStackEngine {
        if (!this._layouts || this._inColumnResize) return this;

        // 移除较小的布局 - 我们会动态重新生成这些布局... 较大的布局需要更新
        this._layouts.forEach((layout, column) => {
            if (!layout || column === this.column) return this;

            if (column < this.column) {
                // 如果列数小于当前列数，清除该列的布局缓存
                this._layouts[column] = undefined;
            } else {
                // 保存原始的 x, y, w（h 不会被缓存）以便更好地传播更改。
                // 注意：我们不需要检查是否超出边界的缩放/移动，因为在使用这些缓存值时会进行检查。#1785
                const ratio = column / this.column; // 计算列数比例
                nodes.forEach((node) => {
                    if (!node._orig) return; // 如果节点没有原始值，跳过（可能是新添加的节点）
                    const n = layout.find((l) => l._id === node._id); // 在布局中查找对应的节点
                    if (!n) return; // 如果没有找到缓存，跳过（新节点会使用当前值）

                    // 如果 Y 值发生变化，按相同的量向下移动
                    // TODO: 检测节点交换操作，而不是移动（特别是在单列模式下）
                    if (n.y >= 0 && node.y !== node._orig.y) {
                        n.y += node.y - node._orig.y;
                    }

                    // 如果 X 值发生变化，根据新位置进行缩放
                    if (node.x !== node._orig.x) {
                        n.x = Math.round(node.x * ratio);
                    }

                    // 如果宽度发生变化，根据新宽度进行缩放
                    if (node.w !== node._orig.w) {
                        n.w = Math.round(node.w * ratio);
                    }

                    // 高度始终从缓存中继承
                });
            }
        });

        return this;
    }

    /**
     * @internal 根据列数的变化调整小部件的宽度和位置。
     * 注意：我们会存储之前的布局（尤其是原始布局），以便可以从例如 12 -> 1 -> 12 的变化中恢复到原始状态。
     *
     * @param prevColumn 之前的列数
     * @param column 新的列数
     * @param layout 指定重新布局的类型（位置、大小等）。
     * 注意：项目永远不会超出当前列的边界。默认为 'moveScale'。对于单列模式忽略此参数。
     */
    public columnChanged(
        prevColumn: number,
        column: number,
        layout: ColumnOptions = 'moveScale'
    ): GridStackEngine {
        if (!this.nodes.length || !column || prevColumn === column) return this;

        // 简化的布局选项
        const doCompact = layout === 'compact' || layout === 'list';
        if (doCompact) {
            this.sortNodes(1); // 按原始布局排序一次（新列会影响顺序）
        }

        // 如果列数减少，缓存当前布局，以便可以恢复
        if (column < prevColumn) this.cacheLayout(this.nodes, prevColumn);
        this.batchUpdate(); // 提前调用以保存初始状态，便于检测 _dirty 和碰撞
        let newNodes: GridStackNode[] = [];
        let nodes = doCompact ? this.nodes : Utils.sort(this.nodes, -1); // 当前列按逆序排序，以便从后往前插入（减少碰撞）

        // 如果列数增加，尝试从缓存中恢复布局
        if (column > prevColumn && this._layouts) {
            const cacheNodes = this._layouts[column] || [];
            const lastIndex = this._layouts.length - 1;
            if (
                !cacheNodes.length &&
                prevColumn !== lastIndex &&
                this._layouts[lastIndex]?.length
            ) {
                prevColumn = lastIndex;
                this._layouts[lastIndex].forEach((cacheNode) => {
                    const n = nodes.find((n) => n._id === cacheNode._id);
                    if (n) {
                        if (!doCompact && !cacheNode.autoPosition) {
                            n.x = cacheNode.x ?? n.x;
                            n.y = cacheNode.y ?? n.y;
                        }
                        n.w = cacheNode.w ?? n.w;
                        if (cacheNode.x == undefined || cacheNode.y === undefined)
                            n.autoPosition = true;
                    }
                });
            }

            // 使用缓存的节点布局
            cacheNodes.forEach((cacheNode) => {
                const j = nodes.findIndex((n) => n._id === cacheNode._id);
                if (j !== -1) {
                    const n = nodes[j];
                    if (doCompact) {
                        n.w = cacheNode.w; // 仅使用宽度，且不修剪列表
                        return;
                    }
                    if (cacheNode.autoPosition || isNaN(cacheNode.x) || isNaN(cacheNode.y)) {
                        this.findEmptyPosition(cacheNode, newNodes);
                    }
                    if (!cacheNode.autoPosition) {
                        n.x = cacheNode.x ?? n.x;
                        n.y = cacheNode.y ?? n.y;
                        n.w = cacheNode.w ?? n.w;
                        newNodes.push(n);
                    }
                    nodes.splice(j, 1);
                }
            });
        }

        // 简化的布局，仅压缩
        if (doCompact) {
            this.compact(layout, false);
        } else {
            // 添加未缓存的节点
            if (nodes.length) {
                if (typeof layout === 'function') {
                    layout(column, prevColumn, newNodes, nodes);
                } else {
                    const ratio = doCompact || layout === 'none' ? 1 : column / prevColumn;
                    const move = layout === 'move' || layout === 'moveScale';
                    const scale = layout === 'scale' || layout === 'moveScale';
                    nodes.forEach((node) => {
                        node.x =
                            column === 1
                                ? 0
                                : move
                                ? Math.round(node.x * ratio)
                                : Math.min(node.x, column - 1);
                        node.w =
                            column === 1 || prevColumn === 1
                                ? 1
                                : scale
                                ? Math.round(node.w * ratio) || 1
                                : Math.min(node.w, column);
                        newNodes.push(node);
                    });
                    nodes = [];
                }
            }

            // 最后按逆序重新布局
            newNodes = Utils.sort(newNodes, -1);
            this._inColumnResize = true; // 防止缓存更新
            this.nodes = []; // 假装没有节点（add() 会使用相同结构）以简化布局
            newNodes.forEach((node) => {
                this.addNode(node, false); // 'false' 表示不触发添加事件
                delete node._orig; // 确保提交时不会恢复到原始状态
            });
        }

        this.nodes.forEach((n) => delete n._orig); // 清除 _orig 以防止 batch=false 时恢复 float=true
        this.batchUpdate(false, !doCompact);
        delete this._inColumnResize;
        return this;
    }

    /**
     * 将给定的布局缓存到指定列索引的位置，以便在列大小更改时可以恢复
     * @param nodes 节点列表
     * @param column 对应的列索引
     * @param clear 如果为 true，将强制清除其他缓存（默认为 false）
     */
    public cacheLayout(nodes: GridStackNode[], column: number, clear = false): GridStackEngine {
        const copy: GridStackNode[] = [];
        nodes.forEach((n, i) => {
            // 确保我们有一个 id，以防这是新的布局，否则重用已设置的 id
            if (n._id === undefined) {
                const existing = n.id ? this.nodes.find((n2) => n2.id === n.id) : undefined; // 使用用户的 id 查找现有节点
                n._id = existing?._id ?? GridStackEngine._idSeq++;
            }
            copy[i] = {x: n.x, y: n.y, w: n.w, _id: n._id}; // 仅更改 x, y, w 和 id 以便后续查找
        });
        this._layouts = clear ? [] : this._layouts || []; // 使用数组快速查找更大的布局
        this._layouts[column] = copy;
        return this;
    }

    /**
     * 将单个节点的布局缓存到指定列索引的位置，以便在列大小更改时可以恢复
     * @param node 要缓存的单个节点
     * @param column 对应的列索引
     */
    public cacheOneLayout(node: GridStackNode, column: number): GridStackEngine {
        node._id = node._id ?? GridStackEngine._idSeq++;
        const layoutNode: GridStackNode = {x: node.x, y: node.y, w: node.w, _id: node._id};
        if (node.autoPosition || node.x === undefined) {
            delete layoutNode.x;
            delete layoutNode.y;
            if (node.autoPosition) layoutNode.autoPosition = true;
        }
        this._layouts = this._layouts || [];
        this._layouts[column] = this._layouts[column] || [];
        const index = this.findCacheLayout(node, column);
        if (index === -1) {
            this._layouts[column].push(layoutNode);
        } else {
            this._layouts[column][index] = layoutNode;
        }
        return this;
    }

    /**
     * 在布局缓存中查找指定节点的位置
     * @param n 要查找的节点
     * @param column 对应的列索引
     * @returns 节点在布局缓存中的索引，如果未找到则返回 -1
     */
    protected findCacheLayout(n: GridStackNode, column: number): number {
        return this._layouts?.[column]?.findIndex((l) => l._id === n._id) ?? -1;
    }

    /**
     * 从布局缓存中移除指定节点
     * @param n 要移除的节点
     */
    public removeNodeFromLayoutCache(n: GridStackNode): void {
        if (!this._layouts) return;
        this._layouts.forEach((layout, i) => {
            const index = this.findCacheLayout(n, i);
            if (index !== -1) {
                layout.splice(index, 1);
            }
        });
    }

    /** 清理节点的所有内部值，仅保留 _id */
    public cleanupNode(node: GridStackNode): GridStackEngine {
        for (const prop in node) {
            if (prop.startsWith('_') && prop !== '_id') {
                delete node[prop];
            }
        }
        return this;
    }
}
