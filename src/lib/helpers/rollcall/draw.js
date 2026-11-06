import {
	getEnabledPool,
	readPoolRemaining,
	writePoolRemaining,
	getPoolStats
} from '../dataAPI/api-rollcall';

/**
 * 点名抽取算法（中文点名版核心）
 *
 * 复刻原神版（26.GenshinWishRoll）已验证的做法：洗牌池 + pop 取人，保证「一轮内绝不重复」。
 * 与随机抽卡不同，点名的核心诉求是公平——每个人在一轮里被点到一次，
 * 点完一轮才重新洗牌开始下一轮。
 *
 * 池进度不自己读写 localStorage，而是走 api-rollcall 的 readPoolRemaining /
 * writePoolRemaining（单一数据源）。否则会和名单管理页的内存缓存互相覆盖，
 * 导致同一个人被点到两次。
 *
 * 星级规则（用户 2026-11-05 裁定）：
 * - 点名页默认所有人都是最普通的 3 星；只有用户在名单里自定义设了 4/5 星才显示对应星级；
 * - 星级纯展示属性，**与抽取概率无关**——谁被点到永远是洗牌随机，不设任何星级加权或保底；
 * - 因此不存在「随机分配 4/5 星」与「十连首抽必五星」逻辑（旧版有，已按裁定移除）。
 */

/** 未设星级条目的默认展示星级：最普通的 3 星 */
const DEFAULT_RARITY = 3;

/** Fisher-Yates 洗牌（原地打乱并返回） */
const shuffle = (arr) => {
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
};

/**
 * 把池内条目转成与原抽卡结果对象兼容的条目，供卡面/结果列表/历史页复用渲染。
 *
 * 与游戏物品的差异（有意为之）：
 * - type 固定 'member'，渲染层据此走点名专用分支（显示图标或姓名首字，而非角色立绘）；
 * - undyingQty 固定 0：点名抽的是「人」不是游戏道具，不应发放星辉/流光等游戏货币，
 *   否则抽几次就白送大量货币、破坏数值平衡；结果页的奖励框靠 `_bonus-item.svelte`
 *   的 `{#if qty > 0}` 天然隐藏，UI 反而更干净；
 * - pity 固定 1：点名没有保底概念，但历史页的 cell 会渲染 pity 字段，缺失会显示
 *   undefined（原神版踩过的坑），故给最小占位值；
 * - combat_type / path / splashartOffset 缺省：自定义人名没有这些游戏属性，点名卡面
 *   也不读它们（走图标/首字渲染），故不携带，避免渲染层误取到 undefined 又去查语言包。
 */
const toResult = (member, rarity) => ({
	type: 'member',
	name: member.name,
	// 自定义名单录入名即显示名；预置名单 chineseChar 为 null，展示层查语言包取中文名
	chineseChar: member.chineseChar || member.name,
	rarity,
	iconKey: member.iconKey || null,
	iconType: member.iconType || null,
	fromLabel: member.fromLabel,
	isNew: false,
	pity: 1,
	undyingType: 'starlight',
	undyingQty: 0
});

/**
 * 抽取 count 个人名。
 * @param {number} count 抽取数量（1 或十连）
 * @returns {Array} 结果数组；未勾选任何名单或名单为空时返回空数组
 */
export const drawMembers = (count = 1) => {
	const full = getEnabledPool();
	// 没勾选名单/名单为空时不能抽，由调用方（doRoll）负责提示
	if (!full.length) return [];

	let remaining = readPoolRemaining(full);
	const results = [];
	// 本次抽取已用掉的池索引。refill 必须排除它们，否则一次十连里可能重复抽到同一个人：
	// remaining 剩 3 人、名单 20 人时，实测 75.9% 的十连会出现重复（用户实机表现为结果页
	// 连续两个相同名字，2026-11-06）。排除后为 0。
	const drawnThisCall = new Set();

	const refill = () => {
		// 池内存索引而非整份名单，避免把大名单反复序列化进 localStorage
		remaining = remaining.concat(shuffle(full.map((_, i) => i).filter((i) => !drawnThisCall.has(i))));
	};

	for (let i = 0; i < count; i++) {
		if (!remaining.length) refill();
		// 名单人数少于抽取数时，一轮洗出来也不够，此时重复在数学上不可避免：
		// 清空本次已抽记录、重洗全量池，保证仍能凑满 count 个结果而不是提前返回。
		if (!remaining.length) {
			drawnThisCall.clear();
			refill();
			if (!remaining.length) break;
		}
		const idx = remaining.pop();
		const member = full[idx];
		// 池索引可能因名单被编辑而越界，跳过并继续，避免崩溃
		if (!member) continue;
		drawnThisCall.add(idx);
		results.push(toResult(member, member.rarity || DEFAULT_RARITY));
	}

	writePoolRemaining(full, remaining);
	return results;
};

/** 当前池进度（已点 / 总数），转发给 UI 使用 */
export { getPoolStats };
