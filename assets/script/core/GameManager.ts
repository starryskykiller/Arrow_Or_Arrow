import { _decorator, Component, Node, assetManager, director, SceneAsset } from 'cc';
import { AudioManager } from '../audio/AudioManager';
import { AppCore } from './AppCore';
import { getLevelTimeSeconds, MAX_HEARTS } from '../config/GameConst';
import { getLevelDef, validateLevel } from '../config/LevelData';
import { BoardController } from '../game/BoardController';
import { GameHUD } from '../ui/GameHUD';
import { PopupView } from '../ui/PopupView';

const { ccclass } = _decorator;

/** Start 场景资源 uuid（assets/scene/Start.scene.meta） */
const START_SCENE_UUID = 'b5a54f60-f386-4603-977b-b3b12d20c35f';

@ccclass('GameManager')
export class GameManager extends Component {
    private _hud: GameHUD | null = null;
    private _board: BoardController | null = null;
    private _hearts = MAX_HEARTS;
    private _timeLeft = 0;
    private _level = 1;
    private _ended = false;
    private _popup: Node | null = null;
    private _running = false;
    private _paused = false;
    private _leaving = false;

    onLoad(): void {
        AppCore.loadProgress();
        this._level = AppCore.currentLevel;
        void this._boot();
    }

    onDestroy(): void {
        this._safeDisposeBoard();
    }

    update(dt: number): void {
        if (!this._running || this._ended || this._paused || this._leaving) return;
        this._timeLeft -= dt;
        this._hud?.setTime(this._timeLeft);
        if (this._timeLeft <= 0) {
            this._timeLeft = 0;
            this._fail();
        }
    }

    private async _boot(): Promise<void> {
        await AudioManager.inst.init(this.node);

        const canvas = this.node;
        canvas.children.slice().forEach((c) => {
            if (c.name !== 'Camera') c.destroy();
        });

        this._hud = new GameHUD(canvas, {
            onSettings: () => this._openSettings(),
            onHint: () => this._onHint(),
            onAux: () => this._onAux(),
            onZoom: (z) => this._board?.setZoom(z),
        });

        const slot = this._hud.getBoardSlot();
        this._board = new BoardController(this._hud.root, {
            onBlocked: () => this._onBlocked(),
            onCleared: () => AudioManager.inst.play('clear'),
            onBoardEmpty: () => this._win(),
        });
        this._board.root.setPosition(slot.x, slot.y, 0);
        this._startLevel(this._level);
    }

    private _startLevel(level: number): void {
        this._closePopup();
        this._level = level;
        AppCore.currentLevel = level;
        this._hearts = MAX_HEARTS;
        this._timeLeft = getLevelTimeSeconds(level);
        this._ended = false;
        this._running = true;
        this._paused = false;
        this._leaving = false;

        const def = getLevelDef(level);
        const errs = validateLevel(def);
        if (errs.length) console.warn('[Level]', errs);

        this._board?.loadLevel(def);
        this._hud?.setLevel(level);
        this._hud?.setHearts(this._hearts);
        this._hud?.setTime(this._timeLeft);
        this._hud?.setZoomDisplay(1);
    }

    private _onBlocked(): void {
        if (this._ended) return;
        AudioManager.inst.play('btn');
        this._hearts = Math.max(0, this._hearts - 1);
        this._hud?.setHearts(this._hearts);
        if (this._hearts <= 0) this._fail();
    }

    private _onHint(): void {
        AudioManager.inst.play('btn');
        this._board?.hintMovable();
    }

    private _onAux(): void {
        AudioManager.inst.play('btn');
        this._board?.toggleAux();
    }

    private _openSettings(): void {
        if (this._popup || this._leaving) return;
        AudioManager.inst.play('btn');
        this._paused = true;
        this._popup = PopupView.showSettings(this.node, {
            onHome: () => this._goHome(),
            onRestart: () => {
                this._paused = false;
                this._closePopup();
                this._startLevel(this._level);
            },
            onClose: () => {
                this._popup = null;
                this._paused = false;
            },
        });
    }

    private _win(): void {
        if (this._ended) return;
        this._ended = true;
        this._running = false;
        this._paused = true;
        AudioManager.inst.play('win');
        this._popup = PopupView.showWin(this.node, {
            onDouble: () => console.log('[Reward] double reward placeholder'),
            onNext: () => this._startLevel(this._level + 1),
            onRestart: () => this._startLevel(this._level),
            onHome: () => this._goHome(),
        });
    }

    private _fail(): void {
        if (this._ended) return;
        this._ended = true;
        this._running = false;
        this._paused = true;
        AudioManager.inst.play('lose');
        this._popup = PopupView.showLose(this.node, {
            onAddHearts: () => {
                this._hearts = MAX_HEARTS;
                this._hud?.setHearts(this._hearts);
                this._ended = false;
                this._running = true;
                this._paused = false;
                this._closePopup();
            },
            onRestart: () => this._startLevel(this._level),
            onHome: () => this._goHome(),
        });
    }

    /**
     * 返回开始页：先安全释放棋盘，再加载 Start（修 dispose null.off 崩溃）
     */
    private _goHome(): void {
        if (this._leaving) return;
        this._leaving = true;
        this._running = false;
        this._paused = true;
        this._closePopup();
        this._safeDisposeBoard();

        // 下一帧切场景，避免按钮回调栈里销毁节点
        this.scheduleOnce(() => {
            this._loadStartScene();
        }, 0);
    }

    private _loadStartScene(): void {
        director.loadScene('Start', (err) => {
            if (!err) return;
            console.warn('[GameManager] loadScene("Start") failed, fallback uuid', err);
            assetManager.loadAny({ uuid: START_SCENE_UUID }, (e2, asset) => {
                if (e2 || !asset) {
                    console.error('[GameManager] Start scene load failed', e2);
                    return;
                }
                director.runScene(asset as SceneAsset);
            });
        });
    }

    private _safeDisposeBoard(): void {
        const board = this._board;
        this._board = null;
        if (!board) return;
        try {
            board.dispose();
        } catch (e) {
            console.warn('[GameManager] board.dispose error (ignored)', e);
        }
    }

    private _closePopup(): void {
        if (this._popup && this._popup.isValid) this._popup.destroy();
        this._popup = null;
    }
}
