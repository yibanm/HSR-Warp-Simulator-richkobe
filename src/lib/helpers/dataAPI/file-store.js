/**
 * 三平台文件存储适配器：用户数据明文落盘、分类子目录。
 *
 * 用户要求（2026-11-07）：所有数据存在 exe 所在文件夹、分类放好、明文存储；
 * 安卓存 /storage/emulated/0/Android/data/<包名>/ 下。
 *
 * 目录结构（数据根之下）：
 *   config/settings.json     设置与偏好（音量、静音、首屏公告等）
 *   gacha/pity.json          各卡池保底计数
 *   gacha/balance.json       货币余额
 *   gacha/roll-counter.json  各卡池抽取次数
 *   gacha/history.json       抽卡历史（数组）
 *   rollcall/lists.json      名单与勾选/洗牌池状态
 *   rollcall/icons/<key>.<ext>  名单头像图片
 * （跃迁视频属应用资源，直读包内 static，不落数据目录）
 *
 * 平台分派：
 *   - Tauri 桌面：自研 Rust 命令，数据根 = exe 目录/data/
 *   - Capacitor 安卓：@capacitor/filesystem 的 ExternalStorage
 *     （即 /storage/emulated/0/Android/data/<包名>/files，免存储权限）
 *   - 浏览器：无文件系统可用，回退 localStorage（仅 dev/网页版）
 */
import { browser } from '$app/environment';

const isTauri = () => browser && Boolean(window.__TAURI_INTERNALS__);
const isAndroid = () =>
	browser &&
	Boolean(window.Capacitor?.isNativePlatform?.()) &&
	window.Capacitor?.getPlatform?.() === 'android';

let fsPlugin = null;
const ANDROID_DIR = 'hsr-data';

const invoke = (cmd, args) => window.__TAURI_INTERNALS__.invoke(cmd, args);

const capDir = async () => {
	if (!fsPlugin) {
		const m = await import('@capacitor/filesystem');
		fsPlugin = m.Filesystem;
	}
	return fsPlugin;
};

const capRead = async (rel, encoding) => {
	const { Filesystem, Directory } = await capDir();
	try {
		const r = await Filesystem.readFile({
			path: `${ANDROID_DIR}/${rel}`,
			directory: Directory.ExternalStorage,
			encoding
		});
		return r.data;
	} catch (e) {
		if (String(e?.message || e).includes('not exist')) throw new Error('ENOENT');
		throw e;
	}
};

const capWrite = async (rel, data, encoding) => {
	const { Filesystem, Directory } = await capDir();
	await Filesystem.writeFile({
		path: `${ANDROID_DIR}/${rel}`,
		data,
		directory: Directory.ExternalStorage,
		encoding,
		recursive: true
	});
};

const capDelete = async (rel) => {
	const { Filesystem, Directory } = await capDir();
	try {
		await Filesystem.deleteFile({ path: `${ANDROID_DIR}/${rel}`, directory: Directory.ExternalStorage });
	} catch (e) {
		if (!String(e?.message || e).includes('not exist')) throw e;
	}
};

const webKey = (rel) => `filestore:${rel}`;

export const fileStore = {
	/** 平台标识，供调用方按平台分派（如视频只在桌面壳落盘） */
	platform: () => (isTauri() ? 'tauri' : isAndroid() ? 'android' : 'web'),

	async readText(rel) {
		if (isTauri()) return invoke('data_read_text', { rel });
		if (isAndroid()) return capRead(rel, 'utf8');
		const v = localStorage.getItem(webKey(rel));
		if (v === null) throw new Error('ENOENT');
		return v;
	},

	async writeText(rel, content) {
		if (isTauri()) return invoke('data_write_text', { rel, content });
		if (isAndroid()) return capWrite(rel, content, 'utf8');
		localStorage.setItem(webKey(rel), content);
	},

	async readBytes(rel) {
		if (isTauri()) {
			const arr = await invoke('data_read_bytes', { rel });
			return Uint8Array.from(arr);
		}
		if (isAndroid()) {
			const b64 = await capRead(rel, undefined);
			const bin = atob(b64);
			const u8 = new Uint8Array(bin.length);
			for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
			return u8;
		}
		const v = localStorage.getItem(webKey(rel));
		if (v === null) throw new Error('ENOENT');
		const bin = atob(v);
		const u8 = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
		return u8;
	},

	async writeBytes(rel, u8) {
		if (isTauri()) return invoke('data_write_bytes', { rel, bytes: Array.from(u8) });
		if (isAndroid()) {
			let bin = '';
			for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
			return capWrite(rel, btoa(bin), undefined);
		}
		let bin = '';
		for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
		localStorage.setItem(webKey(rel), btoa(bin));
	},

	async delete(rel) {
		if (isTauri()) return invoke('data_delete', { rel });
		if (isAndroid()) return capDelete(rel);
		localStorage.removeItem(webKey(rel));
	},

	async exists(rel) {
		if (isTauri()) return invoke('data_exists', { rel });
		if (isAndroid()) {
			try {
				await capRead(rel, 'utf8');
				return true;
			} catch {
				return false;
			}
		}
		return localStorage.getItem(webKey(rel)) !== null;
	},

	/** 递归列出数据根下所有文件相对路径（正斜杠），导出打包用 */
	async listAll() {
		if (isTauri()) return invoke('data_list', {});
		if (isAndroid()) {
			const { Filesystem, Directory } = await capDir();
			const out = [];
			const walk = async (prefix) => {
				let entries;
				try {
					const r = await Filesystem.readdir({
						path: prefix ? `${ANDROID_DIR}/${prefix}` : ANDROID_DIR,
						directory: Directory.ExternalStorage
					});
					entries = r.files;
				} catch {
					return;
				}
				for (const f of entries) {
					const rel = prefix ? `${prefix}/${f.name}` : f.name;
					if (f.type === 'directory') await walk(rel);
					else out.push(rel);
				}
			};
			await walk('');
			return out.sort();
		}
		const out = [];
		const pfx = 'filestore:';
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(pfx)) out.push(k.slice(pfx.length));
		}
		return out.sort();
	}
};

/** 读 JSON 文件，不存在返回 fallback */
export const readJson = async (rel, fallback) => {
	try {
		const t = await fileStore.readText(rel);
		return JSON.parse(t);
	} catch (e) {
		if (String(e?.message || e).includes('ENOENT')) return fallback;
		console.error(`读取 ${rel} 失败，用默认值：`, e);
		return fallback;
	}
};

/** 写 JSON 文件（明文、缩进 2，便于用户直接看） */
export const writeJson = (rel, value) =>
	fileStore.writeText(rel, JSON.stringify(value, null, 2));
