import { browser } from '$app/environment';
import { readJson, writeJson } from './file-store';

/**
 * 抽卡历史与资产存储。
 *
 * 2026-11-07 起弃用 IndexedDB，改明文 JSON 文件（用户要求数据存 exe 所在文件夹、
 * 分类放好、明文可读）：
 *   gacha/history.json   抽卡历史数组（每条带自增 id）
 * 图标 blob 不再走这里的 AssetManager，改存 rollcall/icons/ 图片文件（api-rollcall.js）。
 * 跃迁视频改存 videos/（express-loader.js）。
 *
 * 历史条目可能几百条，整体读写可接受；get 走内存缓存，写操作同步更新缓存并异步落盘。
 */

const HISTORY_FILE = 'gacha/history.json';

let history = null;
let nextId = 1;

const load = async () => {
	if (history !== null) return history;
	const fromFile = await readJson(HISTORY_FILE, undefined);
	if (Array.isArray(fromFile)) {
		history = fromFile;
	} else {
		// 迁移：旧 IndexedDB 的 history 全量搬过来（一次性）
		history = [];
		try {
			const { openDB } = await import('idb');
			const db = await openDB('WarpSimulator', 3);
			if (db.objectStoreNames.contains('history')) {
				const old = await db.getAll('history');
				if (Array.isArray(old) && old.length) {
					history = old;
					writeJson(HISTORY_FILE, history).catch((e) =>
						console.error('历史迁移落盘失败：', e)
					);
				}
			}
			db.close();
		} catch (e) {
			// 旧库不存在（全新安装）属正常
		}
	}
	nextId = history.reduce((m, h) => Math.max(m, h.id || 0), 0) + 1;
	return history;
};

const flush = () => {
	writeJson(HISTORY_FILE, history).catch((e) => console.error('历史写入失败：', e));
};

export const HistoryManager = {
	async historyCount() {
		return (await load()).length;
	},

	async getList(banner) {
		return (await load()).filter((h) => h.banner === banner);
	},

	async countItem(name) {
		return (await load()).filter((h) => h.name === name).length;
	},

	async getByID(itemID) {
		return (await load()).filter((h) => h.itemID === itemID);
	},

	async clearHistory(banner) {
		try {
			history = (await load()).filter((h) => h.banner !== banner);
			flush();
			return 'success';
		} catch (e) {
			return 'failed';
		}
	},

	async clearIDB() {
		history = [];
		flush();
		return undefined;
	},

	async getAllHistories() {
		return [...(await load())];
	},

	async addHistory(data) {
		if (!('banner' in data)) return;
		const list = await load();
		const rec = { ...data, id: data.id ?? nextId++ };
		list.push(rec);
		flush();
		return rec.id;
	},

	async delete(id) {
		if (!id) return;
		history = (await load()).filter((h) => h.id !== id);
		flush();
	}
};

/**
 * 旧 AssetManager 的兼容壳：仅保留 delete/get 的空实现语义已移除，
 * 调用方（图标/视频）已各自改走文件存储。保留导出名以免遗漏的 import 报错。
 * @deprecated 2026-11-07 起无实际存储作用
 */
export const AssetManager = {
	async put() {
		throw new Error('AssetManager 已废弃，改用 file-store');
	},
	async get() {
		return null;
	},
	async delete() {}
};

// browser 仅用于避免 SSR 期误触文件 IO 的提示（load 为惰性，SSR 不调用即安全）
void browser;
