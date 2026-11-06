import { starter } from '$lib/data/banners/starter.json';
import { regular } from '$lib/data/banners/regular.json';
import { banners } from '$lib/data/banners/lists.json';

import { checkStarterBanner } from '$lib/helpers/dataAPI/storage-reader';
import { activeWarp, bannerList, warpList } from '$lib/stores/app-store';
import { getCharDetails, getLCDetails } from './gacha/gacha-base';

export const identifyBanner = (bnid = '0-0') => {
	const [id, runNumber] = bnid.split('-');
	const { name, type, featured } = banners.find((b) => b.id === parseInt(id)) || {};
	return { type, bannerName: name, featured, runNumber: parseInt(runNumber) };
};

export const initializeBanner = async (version, phase) => {
	try {
		if (!version || !phase) return {};
		const list = checkStarterBanner() ? [{ ...starter, ...identifyBanner(starter.bannerID) }] : [];
		const { data } = await import(`../../lib/data/banners/events/${version}.json`);
		const { character, lightcone, regularVersion } = data.find((d) => d.phase === phase).banners;
		const regularData = regular.find(({ version }) => version === regularVersion);

		const prepareList = (id, rateup) => {
			const { bannerName: banner, featured, runNumber, type } = identifyBanner(id);
			const cek = type.match('character') ? getCharDetails : getLCDetails;
			const { path, combat_type } = cek(featured);
			const bannerName = type.match('cone') && runNumber > 1 ? 'bygone-reminiscence' : banner;
			const result = {
				bannerName,
				featured,
				runNumber,
				type,
				path,
				combat_type,
				rateup,
				bannerID: id
			};
			return result;
		};

		[character, lightcone].forEach(({ bannerID, rateup }) => {
			bannerID.forEach((id) => {
				if (!Array.isArray(id)) return list.push(prepareList(id, rateup));
				let type = 'character-group';
				const content = id.map((id) => {
					const parsed = prepareList(id, rateup);
					type = parsed.type.match('cone') ? 'lightcone-group' : 'character-group';
					return parsed;
				});
				const toPush = { content, type };
				list.push(toPush);
			});
		});

		list.push({ ...regularData, ...identifyBanner(regularData.bannerID) });

		// 中文点名版：点名卡池，放在列表末尾与其它卡池同级。
		// 背景复用常驻跃迁立绘（见 BannerItem.svelte 的 member 分支用 <BnRegular />），
		// 抽到的不是游戏角色而是名单里的人（见 rollcall/draw.js）。
		// member 不在 lists.json 里，故不能走 identifyBanner（会返回 undefined），直接构造。
		list.push({
			type: 'member',
			bannerName: 'member',
			bannerID: 'member-1',
			runNumber: 1,
			featured: ''
		});

		bannerList.set(list);
		setFlattenWarpList(list);

		return { status: 'ok' };
	} catch (e) {
		console.error(e);
		return { status: 'error', e };
	}
};

const setFlattenWarpList = (list = []) => {
	const ls = [];
	list.forEach((warp) => {
		if (warp.type.match('group')) {
			warp.content.forEach((w) => ls.push(w));
		} else {
			ls.push(warp);
		}
	});
	warpList.set(ls);
};

export const setActiveWarp = (list, activeIndex, indexInGroup = 0) => {
	const activeBanner = list[activeIndex];
	if (!activeBanner) return;
	if (!activeBanner.type.match('group')) return activeWarp.set(activeBanner);

	// If grouped banner
	const index = indexInGroup >= activeBanner.content.length ? 0 : indexInGroup;
	const active = activeBanner.content[index];
	activeWarp.set(active);
};

export const handleShowStarter = (show) => {
	let bannerLength;
	bannerList.update((v) => {
		bannerLength = v.length;
		return v;
	});

	if (bannerLength < 2) return;
	if (!show) {
		return bannerList.update((bn) => {
			return bn.filter(({ type }) => type !== 'starter');
		});
	}
	return bannerList.update((bn) => {
		bn.unshift({ ...starter, ...identifyBanner(starter.bannerID) });
		return bn;
	});
};
