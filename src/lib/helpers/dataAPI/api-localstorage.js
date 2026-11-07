import { browser } from '$app/environment';
import { fileStore, readJson, writeJson } from './file-store';

/**
 * 设置与游戏进度的存储层。
 *
 * 用户要求（2026-11-07）：所有数据存在 exe 所在文件夹、分类子目录、明文可读
 * （安卓为 /storage/emulated/0/Android/data/<包名>/ 下）。故本层不再用
 * localStorage 单键 JSON，改为每个逻辑键一个明文 JSON 文件：
 *   config / pity / balance / roll-counter / guaranteed-status /
 *   owned-item / probability-rates → config/<键>.json
 *
 * 调用方（localPity/localBalance/rollCounter/localConfig 等）全部是同步接口，
 * 因此采用「启动时一次性读入内存缓存 + get 同步读缓存 + set 同步写缓存并
 * 异步落盘」的结构。落盘失败只记 console.error，不阻塞 UI（与 localStorage
 * 配额满时的行为一致）。
 */

/** 逻辑键 → 文件相对路径 */
const KEY_FILES = {
	config: 'config/settings.json',
	pity: 'gacha/pity.json',
	balance: 'gacha/balance.json',
	rollCounter: 'gacha/roll-counter.json',
	guaranteedStatus: 'gacha/guaranteed-status.json',
	ownedItem: 'gacha/owned-item.json',
	probabilityRates: 'gacha/probability-rates.json'
};

const cache = {};
let loaded = false;

/** 旧版 localStorage 单键（迁移来源） */
const LEGACY_KEY = 'WarpSimulator';

const readLegacyAll = () => {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(LEGACY_KEY);
		if (!raw) return {};
		return JSON.parse(raw)?.data || {};
	} catch (e) {
		console.error('旧存储解析失败：', e);
		return {};
	}
};

// 模块加载即同步读旧 localStorage 作初始值：子组件 onMount 早于 layout 的
// 初始化 await，同步 get 必须此刻就有数据（否则 store 会被推成默认值）。
// initStorage 随后用文件内容覆盖（文件优先），文件缺失时把旧值落盘完成迁移。
if (browser) {
	const legacy = readLegacyAll();
	for (const key of Object.keys(KEY_FILES)) cache[key] = legacy[key] ?? {};
}

/**
 * 启动时调用：把各键从文件读入内存覆盖缓存；文件不存在且旧存储有值时落盘，
 * 完成一次性迁移（用户已有的设置/保底/余额不丢）。
 */
export const initStorage = async () => {
	if (loaded || !browser) return;
	loaded = true;
	for (const [key, rel] of Object.entries(KEY_FILES)) {
		const fromFile = await readJson(rel, undefined);
		if (fromFile !== undefined && typeof fromFile === 'object') {
			cache[key] = fromFile;
		} else if (Object.keys(cache[key] || {}).length) {
			// 文件不存在但旧存储有值：落盘完成迁移
			writeJson(rel, cache[key]).catch((e) => console.error(`迁移 ${key} 落盘失败：`, e));
		}
	}
	loaded = true;
};

const flush = (key) => {
	const rel = KEY_FILES[key];
	if (!rel || !browser) return;
	writeJson(rel, cache[key]).catch((e) => console.error(`写入 ${rel} 失败：`, e));
};

export const storageLocal = {
	get(key) {
		if (!loaded) {
			// 初始化前被同步调用（理论上 layout onMount 已先 await initStorage）：
			// 退化为空对象，避免崩溃；数据以初始化后的为准
			return cache[key] || {};
		}
		return cache[key] || {};
	},

	set(key, value) {
		cache[key] = value;
		flush(key);
	}
};

/** 删除某键的文件与缓存（storage-reset 用） */
export const removeStoredKey = async (key) => {
	delete cache[key];
	const rel = KEY_FILES[key];
	if (rel && browser) {
		try {
			await fileStore.delete(rel);
		} catch (e) {
			console.error(`删除 ${rel} 失败：`, e);
		}
	}
};

export const localPity = {
	get(pityBanner) {
		const pity = storageLocal.get('pity');
		return pity[pityBanner] || 0;
	},
	set(pityBanner, value) {
		const pity = storageLocal.get('pity');
		pity[pityBanner] = value;
		storageLocal.set('pity', pity);
	}
};

export const localBalance = {
	all() {
		const balance = storageLocal.get('balance');
		return balance;
	},
	get(currency) {
		const balance = storageLocal.get('balance');
		return balance[currency] || 0;
	},

	set(currency, value) {
		const balance = storageLocal.get('balance');
		balance[currency] = value;
		storageLocal.set('balance', balance);
	}
};

export const rollCounter = {
	get(banner) {
		const rollCount = storageLocal.get('rollCounter');
		return rollCount[banner] || 0;
	},
	set(banner, rollNumber) {
		const rollCount = storageLocal.get('rollCounter');
		rollCount[banner] = rollNumber;
		storageLocal.set('rollCounter', rollCount);
	}
};

export const guaranteedStatus = {
	get(banner) {
		const guaranteedStatus = storageLocal.get('guaranteedStatus');
		return guaranteedStatus[banner] || false;
	},
	set(banner, value) {
		const guaranteedStatus = storageLocal.get('guaranteedStatus');
		guaranteedStatus[banner] = value;
		storageLocal.set('guaranteedStatus', guaranteedStatus);
	}
};

export const localConfig = {
	get(key) {
		const config = storageLocal.get('config');
		const isValue = config[key] !== null;
		return isValue ? config[key] : null;
	},
	set(key, value) {
		const config = storageLocal.get('config');
		config[key] = value;
		storageLocal.set('config', config);
	}
};

export const owneditem = {
	getAll() {
		const items = storageLocal.get('ownedItem');
		return items;
	},

	get(itemID) {
		const db = this.getAll();
		const selected = db[itemID];
		if (!selected) return { qty: 0, itemID };

		const { manual, warp } = selected;
		return { itemID, qty: manual + warp };
	},

	put({ itemID, source = 'warp' }) {
		const allItems = storageLocal.get('ownedItem');
		const { manual = 0, warp = 0 } = allItems[itemID] || {};
		allItems[itemID] = {
			manual: source === 'warp' ? manual : 1 + manual,
			warp: source === 'warp' ? warp + 1 : warp
		};
		storageLocal.set('ownedItem', allItems);
		return allItems[itemID];
	}
};

export const localrate = {
	get(key) {
		const rates = storageLocal.get('probabilityRates');
		const isValue = rates[key] && rates[key] !== null && rates[key] !== undefined;
		return isValue ? rates[key] : {};
	},
	set(key, value) {
		const rates = storageLocal.get('probabilityRates');
		rates[key] = value;
		storageLocal.set('probabilityRates', rates);
	},
	reset(key) {
		const rates = storageLocal.get('probabilityRates');
		delete rates[key];
		storageLocal.set('probabilityRates', rates);
	}
};
