import { writable } from 'svelte/store';
import { initialAmount } from '$lib/data/warp-setup.json';

export const regularPass = writable(initialAmount.ticketPass);
export const specialPass = writable(initialAmount.ticketPass);
export const stellarJade = writable(initialAmount.stellarJade);
export const oneiric = writable(initialAmount.oneiric);
export const embers = writable(0);
export const starlight = writable(0);

export const starterRemaining = writable(50);
export const regReward = writable({ rollcount: 0, isClaimed: false });
export const priceList = writable({ oneiric: {}, supplyPass: null });

export const activeVersion = writable(null);
export const activePhase = writable(null);
export const activeBanner = writable(0);
export const activeWarp = writable({});
export const warpList = writable([]);
export const bannerList = writable([{ type: 'starter' }]);
export const showStarterBanner = writable(true);

export const isMobileLandscape = writable(false);
export const isMobile = writable(false);
export const viewportWidth = writable(0);
export const viewportHeight = writable(0);

export const assets = writable([]);
export const probEdit = writable(false);

// Settings
// proUser 恒为 true：上游用激活码解锁自定义功能，激活码校验请求作者 gist（离线依赖），已移除。
export const proUser = writable(true);
// 音效静音状态。原 phonograph-store 已随留声机（BGM）功能移除，sfx 部分迁移至此。
export const muted = writable({ sfx: false });
export const warpAmount = writable('default');
// 列车动画默认播放（用户 2026-11-05 复裁：「自动跳过跃迁动画」默认=否）；设置里可手动开启跳过。
// 注意 localStorage 已存过 autoskip 的老用户不受默认值影响（storage-reader 读存储覆盖）。
export const autoskip = writable({ express: false, art: true });
// 跨模块请求打开菜单并直达某页（点名卡面「名单管理」按钮用）：值为菜单项名，消费后置空
export const menuRequest = writable('');
export const liteMode = writable(false);
export const isPWA = writable(false);
