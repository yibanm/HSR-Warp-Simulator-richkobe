import {
	initialAmount as balance,
	storageVersion,
	version,
	warpPhase
} from '$lib/data/warp-setup.json';
import {
	activeBanner,
	activePhase,
	activeVersion,
	autoskip,
	embers,
	muted,
	oneiric,
	probEdit,
	regReward,
	regularPass,
	showStarterBanner,
	specialPass,
	starlight,
	starterRemaining,
	stellarJade,
	warpAmount
} from '$lib/stores/app-store';
import { HistoryManager } from '$lib/helpers/dataAPI/api-indexeddb';
import { localConfig, removeStoredKey, storageLocal } from '$lib/helpers/dataAPI/api-localstorage';

const { clearIDB } = HistoryManager;

const clearCacheStorage = async () => {
	if (typeof caches === 'undefined') return true;
	const keys = await caches.keys();
	for (const key of keys) await caches.delete(key);
	return true;
};

export const storageReset = async ({ keepSetting = false, clearCache = false } = {}) => {
	await clearIDB();
	if (clearCache) await clearCacheStorage();

	starterRemaining.set(50);
	showStarterBanner.set(true);
	regReward.set({ rollcount: 0, isClaimed: false });

	if (keepSetting) {
		// 保留设置/保底/余额/概率：从内存缓存取当前值，清文件后重新落盘
		const kept = {};
		for (const k of ['config', 'pity', 'balance', 'probabilityRates']) kept[k] = storageLocal.get(k);
		for (const k of ['config', 'pity', 'balance', 'rollCounter', 'guaranteedStatus', 'ownedItem', 'probabilityRates']) {
			await removeStoredKey(k);
		}
		delete kept.config.additionalClaimed;
		for (const [k, v] of Object.entries(kept)) storageLocal.set(k, v);
		return;
	}

	// 定向删游戏数据文件。偏好设置已并入 config/settings.json，
	// 全清分支连它一起删（用户主动重置即接受偏好归默认）。
	for (const k of ['config', 'pity', 'balance', 'rollCounter', 'guaranteedStatus', 'ownedItem', 'probabilityRates']) {
		await removeStoredKey(k);
	}
	// 名单数据不删：几十人的名单重导成本高，与旧版「不碰 rollcall 键」的取舍一致

	stellarJade.set(balance.stellarJade);
	specialPass.set(balance.ticketPass);
	regularPass.set(balance.ticketPass);
	oneiric.set(balance.oneiric);
	embers.set(0);
	starlight.set(0);

	localConfig.set('version', `${version}-${warpPhase}`);
	localConfig.set('storageVersion', storageVersion);
	activeVersion.set(version);
	activePhase.set(warpPhase);
	activeBanner.set(0);

	warpAmount.set('default');
	autoskip.set({ express: false, art: true });
	muted.set({ sfx: false });
	probEdit.set(false);
};
