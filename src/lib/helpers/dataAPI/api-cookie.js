import { browser } from '$app/environment';
import { readJson, writeJson } from './file-store';

/**
 * UI 偏好存储（原 document.cookie 实现）。
 *
 * 2026-11-07 起随整体数据层改明文文件：config/ui-prefs.json。
 * cookie 在 tauri.localhost 与安卓 WebView 下行为不一致（Secure 属性、容量限制），
 * 且用户要求所有数据明文落盘可见，cookie 不满足。
 *
 * 接口保持同步 get/set（调用方十几处都是同步用法）：内存缓存 + 异步落盘。
 */

const PREFS_FILE = 'config/ui-prefs.json';
const LEGACY_COOKIE = 'WarpSimulator';

let prefs = null;

const readLegacy = () => {
	if (!browser) return {};
	try {
		const row = document.cookie.split('; ').find((r) => r.startsWith(`${LEGACY_COOKIE}=`));
		if (!row) return {};
		return JSON.parse(decodeURIComponent(row.slice(LEGACY_COOKIE.length + 1))) || {};
	} catch (e) {
		return {};
	}
};

// 模块加载即同步读旧 cookie 作初始值（理由同 api-localstorage：子组件 onMount
// 早于 layout 初始化 await，同步 get 必须此刻有数据）
if (browser) prefs = readLegacy();

let prefsLoaded = false;

export const initPrefs = async () => {
	if (prefsLoaded || !browser) return;
	prefsLoaded = true;
	const fromFile = await readJson(PREFS_FILE, undefined);
	if (fromFile !== undefined && typeof fromFile === 'object') {
		prefs = fromFile;
		return;
	}
	if (Object.keys(prefs || {}).length) {
		writeJson(PREFS_FILE, prefs).catch((e) => console.error('偏好迁移落盘失败：', e));
	}
};

const flush = () => {
	if (!browser) return;
	writeJson(PREFS_FILE, prefs || {}).catch((e) => console.error('偏好写入失败：', e));
};

export const cookie = {
	get(cname) {
		if (prefs === null) prefs = {};
		return prefs[cname];
	},
	set(cname, cvalue) {
		if (prefs === null) prefs = {};
		prefs[cname] = cvalue;
		flush();
	},
	remove(cname) {
		if (prefs === null) prefs = {};
		delete prefs[cname];
		flush();
	}
};
