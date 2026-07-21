import {
    _decorator, Component, Sprite, UITransform, Color,
} from 'cc';
import { AudioManager } from './audio/AudioManager';
import { AppCore } from './core/AppCore';
import { DESIGN_H, DESIGN_W } from './config/GameConst';
import { createNode, drawFill, loadSpriteFrame, makeButton, makeLabel } from './ui/UIFactory';

const { ccclass } = _decorator;

/**
 * 开始页：暖色背景贴图 +「开始游戏」按钮 → 进入 Main。
 * 请将本组件挂到 Start 场景的 Canvas 上。
 */
@ccclass('StartMenu')
export class StartMenu extends Component {
    async onLoad(): Promise<void> {
        AppCore.loadProgress();
        await AudioManager.inst.init(this.node);

        const canvas = this.node;
        canvas.children.slice().forEach((c) => {
            if (c.name !== 'Camera') c.destroy();
        });

        // 适配分辨率
        const ui = canvas.getComponent(UITransform);
        if (ui) ui.setContentSize(DESIGN_W, DESIGN_H);

        const root = createNode('StartRoot', canvas, DESIGN_W, DESIGN_H);

        // 背景
        const bg = createNode('BG', root, DESIGN_W, DESIGN_H);
        const bgSp = bg.addComponent(Sprite);
        bgSp.sizeMode = Sprite.SizeMode.CUSTOM;
        bg.getComponent(UITransform)!.setContentSize(DESIGN_W, DESIGN_H);
        const bgSf = await loadSpriteFrame('texture/bg_start_b') || await loadSpriteFrame('texture/bg_start_a');
        if (bgSf) bgSp.spriteFrame = bgSf;
        else drawFill(bg, new Color(255, 220, 190, 255), DESIGN_W, DESIGN_H);

        // 标题
        makeLabel(root, '箭头迷阵', 64, new Color(90, 50, 30), 'Title').node.setPosition(0, 280, 0);
        makeLabel(root, 'Arrow or Arrow', 28, new Color(140, 90, 60), 'Sub').node.setPosition(0, 210, 0);

        // 开始按钮
        const startBtn = makeButton(root, 'StartBtn', 360, 110, () => {
            AudioManager.inst.play('btn');
            AppCore.goMain(AppCore.currentLevel);
        });
        startBtn.setPosition(0, -80, 0);

        const btnSf = await loadSpriteFrame('texture/btn_start');
        if (btnSf) {
            const sp = startBtn.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = btnSf;
            startBtn.getComponent(UITransform)!.setContentSize(360, 110);
        } else {
            drawFill(startBtn, new Color(255, 200, 60, 255), 360, 110, 40);
            makeLabel(startBtn, '开始游戏', 36, new Color(90, 50, 20));
        }

        // 继续关卡提示
        makeLabel(root, `当前进度：第 ${AppCore.currentLevel} 关`, 24, new Color(120, 80, 50), 'Progress')
            .node.setPosition(0, -200, 0);
    }
}
