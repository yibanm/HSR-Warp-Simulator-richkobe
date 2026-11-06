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
import { localConfig, storageLocal } from '$lib/helpers/dataAPI/api-localstorage';

const { clearIDB } = HistoryManager;

const clearCacheStorage = async () => {
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
		const config = storageLocal.get('config');
		const pity = storageLocal.get('pity');
		const balance = storageLocal.get('balance');
		const probabilityRates = storageLocal.get('probabilityRates');
		localStorage.removeItem('WarpSimulator');
		delete config.additionalClaimed;

		storageLocal.set('config', config);
		storageLocal.set('pity', pity);
		storageLocal.set('balance', balance);
		storageLocal.set('probabilityRates', probabilityRates);
		return;
	}

	// 不用 localStorage.clear()：本项目的 localStorage 只有 'WarpSimulator'（游戏数据）
	// 与 'rollcall'（点名名单）两个键，全清会连带抹掉用户手动导入的班级/小组名单，
	// 而名单可能几十人、重导成本高。这里定向删游戏数据键，与上方 keepSetting 分支、
	// 以及原神版的做法保持一致。偏好设置存在 cookie，不受此处影响。
	localStorage.removeItem('WarpSimulator');

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
