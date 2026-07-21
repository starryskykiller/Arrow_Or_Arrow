import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** 保留空壳，避免旧引用报错；UI 已由 GameHUD / PopupView 接管 */
@ccclass('UIManager')
export class UIManager extends Component {
}
