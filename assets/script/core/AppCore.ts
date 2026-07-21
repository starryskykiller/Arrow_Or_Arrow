import { _decorator, Component, director, sys, assetManager, SceneAsset } from 'cc';
import { STORAGE_LEVEL } from '../config/GameConst';

const { ccclass } = _decorator;

const START_SCENE_UUID = 'b5a54f60-f386-4603-977b-b3b12d20c35f';
const MAIN_SCENE_UUID = '6efef07d-cc6a-4742-923b-2247c68e0e91';

@ccclass('AppCore')
export class AppCore extends Component {
    private static _currentLevel = 1;

    static get currentLevel(): number {
        return this._currentLevel;
    }

    static set currentLevel(v: number) {
        this._currentLevel = Math.max(1, v | 0);
        try {
            sys.localStorage.setItem(STORAGE_LEVEL, String(this._currentLevel));
        } catch {
            /* ignore */
        }
    }

    static loadProgress(): void {
        try {
            const v = sys.localStorage.getItem(STORAGE_LEVEL);
            if (v) this._currentLevel = Math.max(1, parseInt(v, 10) || 1);
        } catch {
            /* ignore */
        }
    }

    static goStart(): void {
        director.loadScene('Start', (err) => {
            if (!err) return;
            console.warn('[AppCore] Start by name failed, try uuid', err);
            assetManager.loadAny({ uuid: START_SCENE_UUID }, (e2, asset) => {
                if (!e2 && asset) {
                    director.runScene(asset as SceneAsset);
                } else {
                    console.error('[AppCore] cannot load Start scene', e2);
                }
            });
        });
    }

    static goMain(level?: number): void {
        if (level !== undefined) this.currentLevel = level;
        director.loadScene('Main', (err) => {
            if (!err) return;
            console.warn('[AppCore] Main by name failed, try uuid', err);
            assetManager.loadAny({ uuid: MAIN_SCENE_UUID }, (e2, asset) => {
                if (!e2 && asset) {
                    director.runScene(asset as SceneAsset);
                } else {
                    console.error('[AppCore] cannot load Main scene', e2);
                }
            });
        });
    }

    onLoad(): void {
        AppCore.loadProgress();
    }
}
