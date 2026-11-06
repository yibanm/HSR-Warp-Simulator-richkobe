<script>
	import { getContext, setContext } from 'svelte';
	import { t } from 'svelte-i18n';
	import { get } from 'svelte/store';
	import {
		activeVersion,
		activePhase,
		viewportHeight,
		isMobileLandscape,
		viewportWidth,
		warpAmount,
		specialPass,
		regularPass,
		embers,
		starlight,
		probEdit,
		activeWarp
	} from '$lib/stores/app-store';
	import { localBalance } from '$lib/helpers/dataAPI/api-localstorage';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import WARP, { roll } from '$lib/helpers/gacha/Warp';
	import { HistoryManager } from '$lib/helpers/dataAPI/api-indexeddb';
	import { drawMembers } from '$lib/helpers/rollcall/draw';
	import { attachIconUrls } from '$lib/helpers/rollcall/icon';
	import { refreshRollcall } from '$lib/helpers/dataAPI/api-rollcall';
	import { pushToast } from '$lib/stores/toast';
	import Button from './button/_button.svelte';
	import ButtonWarp from './button/_button-warp.svelte';
	import ConvertModal from './_convert-modal.svelte';
	import ButtonShop from './button/_button-shop.svelte';

	export let bannerType = 'starter';

	$: isStarter = bannerType === 'starter';
	$: fit = $viewportHeight * ($isMobileLandscape ? 1.9 : 1.7) > $viewportWidth;

	let footerWidth;
	let multi = false;
	let rollCost;
	let showConverModal = false;

	const navigate = getContext('navigate');
	const goto = (page) => {
		navigate(page);
		playSfx('click');
	};

	// Ready To Pull ?
	const readyToPull = getContext('readyToPull');

	const onWarp = getContext('onWarp');
	$: warpProgress = $onWarp;

	// Convert Modal
	const closeModal = ({ confirm = false }) => {
		playSfx(confirm ? 'click' : 'close');
		showConverModal = false;

		if (confirm) return;
		warpProgress = false;
	};
	setContext('closeModal', closeModal);

	// Warp
	$: isUnlimited = $warpAmount === 'unlimited';
	$: isSpecialPass = bannerType.match('event');
	$: currencyUsed = isSpecialPass ? $specialPass : $regularPass;

	let warpResult;
	let WarpInstance;

	const initialWarp = async (version, phase) => {
		if (!version || !phase) return;
		WarpInstance = await WARP.init(version, phase);
	};
	$: initialWarp($activeVersion, $activePhase);

	const handleGachaAnimation = getContext('handleGachaAnimation');
	/**
	 * 点名结果写入跃迁历史。
	 * 复用原历史的字段结构（banner/type/name/rarity/itemID/time/pity），
	 * 因此「历史」页无需改渲染逻辑即可列出点名记录；额外带上 chineseChar 与
	 * iconKey/iconType，让历史页能显示名单里的名字与图标。
	 * itemID 用 0 占位：点名对象不是游戏物品，没有对应 ID。
	 */
	const saveMemberHistory = async (item) => {
		try {
			const date = new Date();
			await HistoryManager.addHistory({
				time: `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`,
				banner: 'member',
				type: 'member',
				itemID: 0,
				name: item.name,
				chineseChar: item.chineseChar,
				iconKey: item.iconKey,
				iconType: item.iconType,
				rarity: item.rarity,
				// 历史页会渲染 pity 字段，缺失会显示 undefined；点名没有保底概念，固定写 1
				pity: 1
			});
		} catch (e) {
			// 写历史失败不该打断点名结果展示，仅记录日志
			console.error('点名记录写入失败：', e);
		}
	};

	const doRoll = async (count, bannerToRoll) => {
		warpProgress = true;
		playSfx();
		multi = count > 1;
		const tmp = [];

		rollCost = bannerToRoll === 'starter' ? 8 : count;
		if (!isUnlimited && rollCost > currencyUsed) return (showConverModal = true);

		// 点名卡池不走游戏概率系统，改为从名单里抽人。
		// 名单为空时不能抽，提示用户去菜单里勾选名单。
		if (bannerToRoll === 'member') {
			const members = drawMembers(count);
			if (!members.length) {
				// warpProgress 派生自 onWarp，置回 false 即可解除抽卡按钮禁用
				onWarp.set(false);
				pushToast({ message: get(t)('rollcall.emptyPool'), type: 'error' });
				return;
			}
			// 图标可能是 IndexedDB 里的 blob，需异步转成可显示的 URL
			const withIcons = await attachIconUrls(members);
			for (const item of withIcons) {
				tmp.push(item);
				await saveMemberHistory(item);
			}
			// 池进度已推进，刷新一次快照，让卡面与管理页的「本轮已点 x/y」同步
			refreshRollcall();

			warpResult = tmp;
			handleGachaAnimation(warpResult);
			if (isUnlimited) return;
			// undyingQty 恒为 0，updateMilestones 不会增加任何货币
			updateMilestones();
			updateBalance(bannerToRoll);
			return;
		}

		for (let i = 0; i < count; i++) {
			const result = await roll(bannerToRoll, WarpInstance, $activeWarp.bannerID);
			tmp.push(result);
		}

		warpResult = tmp;
		handleGachaAnimation(warpResult);
		if (isUnlimited) return;
		updateMilestones();
		updateBalance(bannerToRoll);
	};

	const reroll = () => {
		doRoll(multi ? 10 : 1, bannerType);
		showConverModal = false;
	};
	setContext('reroll', reroll);

	const updateMilestones = () => {
		const update = (type) => {
			const qty = warpResult.reduce((prev, { undyingQty, undyingType }) => {
				return prev + (undyingType === type ? undyingQty : 0);
			}, 0);

			const milestone = type === 'embers' ? embers : starlight;
			milestone.update((n) => {
				const afterUpdate = n + qty;
				localBalance.set(type, afterUpdate);
				return afterUpdate;
			});
		};

		update('starlight');
		update('embers');
	};

	const updateBalance = (banner) => {
		const isSpecialPass = banner.match('event');
		const currency = isSpecialPass ? specialPass : regularPass;
		currency.update((n) => {
			const afterUpdate = n - rollCost;
			localBalance.set(isSpecialPass ? 'specialPass' : 'regularPass', afterUpdate);
			return afterUpdate;
		});
	};

	// Edit Probability Button
	const editProb = () => {
		probEdit.update((v) => !v);
		playSfx('click2');
	};
</script>

{#if showConverModal}
	<ConvertModal {rollCost} {isSpecialPass} />
{/if}

<ButtonShop />

<div
	class="button-container"
	class:fit
	style="--width:{footerWidth}px"
	bind:clientWidth={footerWidth}
>
	<div class="row">
		<div class="info-button">
			<!-- 点名卡池没有游戏概率详情，隐藏「详情」按钮（详情页依赖 lists.json 里的卡池数据） -->
			{#if bannerType !== 'member'}
				<div class="btn">
					<Button on:click={() => goto('details')}>
						{$t('details.view')}
					</Button>
				</div>
			{/if}
			<div class="btn">
				<Button on:click={() => goto('collection')}>
					{$t('collection.button')}
				</Button>
			</div>

			<!-- 点名不走游戏概率系统，隐藏概率编辑器齿轮 -->
			{#if bannerType !== 'starter' && bannerType !== 'member'}
				<div class="btn">
					<Button type="icon" on:click={editProb}>
						<i class="hsr-{!$probEdit ? 'cog-bold' : 'check'}"></i>
					</Button>
				</div>
			{/if}
		</div>
		<div class="warp-button">
			{#if !isStarter}
				<div class="btn">
					<ButtonWarp
						disabled={!$readyToPull || warpProgress}
						single
						{bannerType}
						on:click={() => doRoll(1, bannerType)}
					/>
				</div>
			{/if}
			<div class="btn">
				<ButtonWarp
					disabled={!$readyToPull || warpProgress}
					{bannerType}
					on:click={() => doRoll(10, bannerType)}
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.button-container {
		width: calc(83vw);
		position: fixed;
		bottom: 6%;
		right: 0;
		z-index: +1;
		padding-right: 7%;
	}

	@media screen and (min-width: 750px) {
		.button-container.fit {
			transform: translateX(3%);
		}
	}

	.row {
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: flex-end;
	}

	.info-button,
	.warp-button {
		display: flex;
		width: 100%;
	}

	.warp-button {
		margin-left: 1rem;
		justify-content: flex-end;
	}

	.btn {
		padding: 0.5%;
		white-space: nowrap;
	}

	/* Mobile Landscape */
	:global(.mobileLandscape) .button-container {
		bottom: 4.5%;
		padding-right: 6.5%;
	}
	:global(.mobileLandscape) .warp-button {
		transform: scale(0.95);
	}

	@media screen and (max-width: 999px) {
		:global(main):not(.mobileLandscape) .info-button {
			flex-wrap: wrap;
		}
	}

	@media screen and (max-width: 750px) {
		.button-container {
			width: 100vw;
			padding: 0 1rem;
			bottom: 4%;
		}
	}

	@media screen and (max-width: 640px) {
		.warp-button {
			flex-wrap: wrap;
			width: fit-content;
		}
	}
</style>
