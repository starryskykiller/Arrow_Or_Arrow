import { AudioClip, AudioSource, Node, resources, director, sys } from 'cc';
import { STORAGE_SOUND } from '../config/GameConst';

type SfxKey = 'btn' | 'clear' | 'win' | 'lose';

/**
 * 全局音效/“背景音乐”开关。
 * 当前资源包仅有音效，开关同时控制全部声音；后续若有 BGM 可在此扩展。
 */
export class AudioManager {
    private static _inst: AudioManager | null = null;
    static get inst(): AudioManager {
        if (!this._inst) this._inst = new AudioManager();
        return this._inst;
    }

    private _source: AudioSource | null = null;
    private _clips: Partial<Record<SfxKey, AudioClip>> = {};
    private _soundOn = true;
    private _loaded = false;

    get soundOn(): boolean {
        return this._soundOn;
    }

    set soundOn(v: boolean) {
        this._soundOn = !!v;
        try {
            sys.localStorage.setItem(STORAGE_SOUND, this._soundOn ? '1' : '0');
        } catch {
            /* ignore */
        }
    }

    async init(host?: Node): Promise<void> {
        if (this._loaded) return;
        try {
            const saved = sys.localStorage.getItem(STORAGE_SOUND);
            if (saved === '0') this._soundOn = false;
        } catch {
            /* ignore */
        }

        const scene = director.getScene();
        const node = host ?? scene?.getChildByName('Canvas') ?? scene;
        if (node) {
            this._source = node.getComponent(AudioSource) || node.addComponent(AudioSource);
        }

        const keys: SfxKey[] = ['btn', 'clear', 'win', 'lose'];
        await Promise.all(keys.map((k) => this._loadClip(k)));
        this._loaded = true;
    }

    private _loadClip(key: SfxKey): Promise<void> {
        return new Promise((resolve) => {
            resources.load(`audio/${key}`, AudioClip, (err, clip) => {
                if (!err && clip) {
                    this._clips[key] = clip;
                } else {
                    console.warn(`[Audio] load failed: audio/${key}`, err);
                }
                resolve();
            });
        });
    }

    play(key: SfxKey): void {
        if (!this._soundOn) return;
        const clip = this._clips[key];
        if (!clip || !this._source) return;
        this._source.playOneShot(clip, 1);
    }
}
