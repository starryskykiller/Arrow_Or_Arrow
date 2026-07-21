import { Node } from 'cc';
import { ArrowDef } from '../config/LevelData';
import { ArrowEntity } from './ArrowEntity';

/**
 * 箭头工厂（运行时创建）。
 * 后续可在 Cocos 编辑器中把 Arrow 节点存成 Prefab，
 * 关卡只填 cells 数据即可批量生成，便于关卡扩展。
 */
export class ArrowFactory {
    static create(id: number, def: ArrowDef, parent: Node): ArrowEntity {
        return new ArrowEntity(id, def, parent);
    }

    static createMany(defs: ArrowDef[], parent: Node): ArrowEntity[] {
        return defs.map((d, i) => ArrowFactory.create(i, d, parent));
    }
}
