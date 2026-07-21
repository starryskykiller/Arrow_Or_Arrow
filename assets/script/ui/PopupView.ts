import { Color, Label, Node } from 'cc';
import { AudioManager } from '../audio/AudioManager';
import { createNode, drawFill, makeButton, makeLabel, makeOverlay } from './UIFactory';

export class PopupView {
    static showSettings(parent: Node, handlers: {
        onHome: () => void;
        onRestart: () => void;
        onClose: () => void;
    }): Node {
        const overlay = makeOverlay(parent);
        const panel = createNode('SettingsPanel', overlay, 520, 420);
        drawFill(panel, Color.WHITE, 520, 420, 24);
        makeLabel(panel, '设置', 40, new Color(40, 60, 90)).node.setPosition(0, 150, 0);

        const soundBtn = makeButton(panel, 'SoundBtn', 360, 70, () => {
            AudioManager.inst.soundOn = !AudioManager.inst.soundOn;
            AudioManager.inst.play('btn');
            soundLabel.string = AudioManager.inst.soundOn ? '背景音乐：开' : '背景音乐：关';
        });
        soundBtn.setPosition(0, 50, 0);
        drawFill(soundBtn, new Color(230, 240, 250, 255), 360, 70, 16);
        const soundLabel = makeLabel(soundBtn,
            AudioManager.inst.soundOn ? '背景音乐：开' : '背景音乐：关',
            28, new Color(40, 70, 100));

        const homeBtn = makeButton(panel, 'HomeBtn', 360, 70, () => {
            AudioManager.inst.play('btn');
            handlers.onHome();
        });
        homeBtn.setPosition(0, -40, 0);
        drawFill(homeBtn, new Color(255, 210, 90, 255), 360, 70, 16);
        makeLabel(homeBtn, '返回主页', 28, new Color(90, 60, 10));

        const restartBtn = makeButton(panel, 'RestartBtn', 360, 70, () => {
            AudioManager.inst.play('btn');
            handlers.onRestart();
        });
        restartBtn.setPosition(0, -130, 0);
        drawFill(restartBtn, new Color(180, 210, 240, 255), 360, 70, 16);
        makeLabel(restartBtn, '重新开始', 28, new Color(40, 70, 100));

        const closeBtn = makeButton(panel, 'CloseBtn', 64, 64, () => {
            AudioManager.inst.play('btn');
            handlers.onClose();
            overlay.destroy();
        });
        closeBtn.setPosition(220, 170, 0);
        drawFill(closeBtn, new Color(230, 230, 230, 255), 56, 56, 28);
        makeLabel(closeBtn, '×', 36, new Color(80, 80, 80));

        return overlay;
    }

    static showWin(parent: Node, handlers: {
        onDouble: () => void;
        onNext: () => void;
        onRestart: () => void;
        onHome: () => void;
    }): Node {
        const overlay = makeOverlay(parent);
        const panel = createNode('WinPanel', overlay, 560, 520);
        drawFill(panel, Color.WHITE, 560, 520, 24);
        makeLabel(panel, '恭喜过关！', 44, new Color(40, 140, 80)).node.setPosition(0, 190, 0);

        const mk = (name: string, y: number, text: string, color: Color, cb: () => void) => {
            const b = makeButton(panel, name, 400, 72, () => {
                AudioManager.inst.play('btn');
                cb();
            });
            b.setPosition(0, y, 0);
            drawFill(b, color, 400, 72, 18);
            makeLabel(b, text, 28, new Color(40, 50, 70));
        };

        mk('Double', 90, '双倍奖励', new Color(255, 215, 90, 255), handlers.onDouble);
        mk('Next', 5, '下一关', new Color(120, 210, 140, 255), handlers.onNext);
        mk('Restart', -80, '重新开始', new Color(180, 210, 240, 255), handlers.onRestart);
        mk('Home', -165, '返回大厅', new Color(220, 220, 230, 255), handlers.onHome);
        return overlay;
    }

    static showLose(parent: Node, handlers: {
        onAddHearts: () => void;
        onRestart: () => void;
        onHome: () => void;
    }): Node {
        const overlay = makeOverlay(parent);
        const panel = createNode('LosePanel', overlay, 560, 460);
        drawFill(panel, Color.WHITE, 560, 460, 24);
        makeLabel(panel, '挑战失败', 44, new Color(180, 60, 60)).node.setPosition(0, 160, 0);

        const mk = (name: string, y: number, text: string, color: Color, cb: () => void) => {
            const b = makeButton(panel, name, 400, 72, () => {
                AudioManager.inst.play('btn');
                cb();
            });
            b.setPosition(0, y, 0);
            drawFill(b, color, 400, 72, 18);
            makeLabel(b, text, 28, new Color(40, 50, 70));
        };

        mk('AddHeart', 50, '增加三颗心', new Color(255, 150, 160, 255), handlers.onAddHearts);
        mk('Restart', -40, '重新开始', new Color(180, 210, 240, 255), handlers.onRestart);
        mk('Home', -130, '返回大厅', new Color(220, 220, 230, 255), handlers.onHome);
        return overlay;
    }
}
