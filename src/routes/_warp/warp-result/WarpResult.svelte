<script>
	import { getContext, onDestroy, onMount, setContext } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { t } from 'svelte-i18n';
	import { assets, liteMode, viewportWidth } from '$lib/stores/app-store';
	import { playSfx, stopSfx } from '$lib/helpers/sounds/audiofx';
	import { lazyLoad } from '$lib/helpers/lazyload';
	import { createLink } from '$lib/helpers/shareable-link';
	import positionToStyle from '$lib/helpers/css-transformer';
	import { memberDisplayName } from '$lib/helpers/rollcall/display';

	import ButtonIcon from '$lib/components/ButtonIcon.svelte';
	import LightCones from '$lib/components/LightCones.svelte';
	import ScreenshotShare from '../../_index/ScreenshotShare.svelte';
	import SplashLight from './_splash-light.svelte';
	import SsrScreen from './_ssr-screen.svelte';
	import SplashartInfo from './_splashart-info.svelte';
	import BonusItem from './_bonus-item.svelte';
	import ResultList from './ResultList.svelte';

	export let skip = false;
	export let list = [];
	export let standalone = false;

	let intro5star = false;
	let showResultList = false;
	let preview = standalone || false;
	setContext('preview', (val) => (preview = val));

	let activeIndex = 0;

	const createShareableLink = (activeIndex, showResultList) => {
		const isMulti = showResultList && list.length > 1;
		return isMulti ? createLink(list) : createLink([list[activeIndex]]);
	};

	const closeResult = getContext('closeResult');
	const close = () => {
		playSfx('warpresult-close');
		closeResult();
	};

	const playRevealAudio = () => {
		const star = list[activeIndex].rarity;
		if (star === 5) {
			intro5star = true;
			const x = setTimeout(() => {
				intro5star = false;
				clearTimeout(x);
			}, 700);
		}

		if (standalone) return;
		playSfx(`reveal-${star}star`);
	};

	const showItem = (startIndex) => {
		// Single Pull
		if (list.length === 1) {
			if (startIndex === 'start') playRevealAudio();
			return;
		}

		// Multi Pull
		if (activeIndex > list.length - 2) {
			showResultList = true;
			return;
		}
		if (startIndex !== 'start') {
			activeIndex = activeIndex + 1;
		}
		playRevealAudio();
	};

	const scaleIn = (node, args) => {
		if (!args.animate) return;
		return scale(node, args);
	};

	onMount(() => {
		showItem('start');
		if (!standalone) playSfx('warp-backsound');
		if (skip || standalone) return (showResultList = true);
	});

	onDestroy(() => {
		if (standalone) return;
		stopSfx('warp-backsound');
	});
</script>

<div class="warp-result" class:preview out:fade={{ duration: 200 }}>
	<img
		src={$assets['warp-bg.webp']}
		alt="bg"
		crossorigin="anonymous"
		in:scaleIn={{
			animate: !skip,
			start: 1.3,
			opacity: 1,
			duration: 1000,
			easing: cubicOut
		}}
	/>

	<!-- Show on Shareable screen -->
	<img class="starrail-logo" src={$assets['starrail-logo.webp']} alt="star rail logo" />
	<div class="tanda-air">
		{#if standalone}
			<div class="get-yours">快来试试手气</div>
		{:else}
			<div class="via">点名抽卡</div>
		{/if}
		<div class="site">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a href="/" title="崩坏：星穹铁道 跃迁模拟器（点名版）"> 星穹铁道·点名版 </a>
		</div>
	</div>
	<!-- End Show on Shareable screen -->

	{#if !standalone}
		{#if list.length > 1 && !showResultList}
			<div class="skip">
				<ButtonIcon icon="skip" on:click={() => (showResultList = true)} />
			</div>
		{:else}
			<div class="close">
				<ButtonIcon on:click={close} />
			</div>
		{/if}
	{/if}

	{#if showResultList && list.length > 1}
		<ResultList {list} {standalone} />
	{:else}
		<div class="container">
			{#each list as { name, path, rarity, combat_type, splashartOffset, eidolon, undyingType, undyingQty, isNew, type, iconUrl, chineseChar, iconType, fromLabel }, i (list[i])}
				{#if activeIndex === i}
					{#if intro5star && !$liteMode && type !== 'member'}
						<SsrScreen {path} />
					{:else}
						<div class="wrapper" on:mousedown={showItem}>
							{#if !$liteMode || !standalone}
								<SplashLight {rarity} />
							{/if}

							{#if type === 'member'}
								<!-- 点名结果：不是游戏物品，没有立绘与命途，
								     显示名单图标；自定义名单无图标时退化为姓名首字。
								     动画与上游角色/光锥卡面保持同构：外层 500ms 入场 +
								     内层 2500ms 慢推两段式，缺内层会显得演出「不完整」 -->
								<div
									class="item-art character"
									in:scale|global={{ start: 1.3, duration: 500, opacity: 1 }}
								>
									<div
										class="item-content member-content"
										in:scale|global={{ start: 1.05, duration: 2500, opacity: 1 }}
									>
										<div class="member-card star{rarity}">
											{#if iconUrl}
												<img src={iconUrl} alt={chineseChar || name} />
											{:else}
												<span class="member-initial">
													{(chineseChar || name || '').slice(0, 1)}
												</span>
											{/if}
										</div>
									</div>
								</div>

								<div class="member-info" in:fade={{ duration: 400, delay: 600 }}>
									<div class="member-name">
										{memberDisplayName({ name, chineseChar, iconType }, $t)}
									</div>
									<div class="member-stars">
										{#each Array(rarity) as _, si (si)}
											<i class="hsr-star"></i>
										{/each}
									</div>
									{#if fromLabel}
										<div class="member-from">{fromLabel}</div>
									{/if}
								</div>
							{:else if !combat_type}
								<div
									class="item-art lightcone"
									in:scale|global={{ start: 2, duration: 500, opacity: 1 }}
								>
									<div
										class="item-content"
										in:scale|global={{ start: 1.05, duration: 2500, opacity: 1 }}
									>
										<div class="lightcone-item">
											<LightCones item={name} animate={!$liteMode} />
										</div>
									</div>
								</div>
							{:else}
								<div
									class="item-art character"
									in:scale|global={{ start: 1.3, duration: 500, opacity: 1 }}
								>
									<picture
										class="item-content"
										in:scale|global={{ start: 1.05, duration: 2500, opacity: 1 }}
									>
										<img
											use:lazyLoad={$assets[
												`splash-art/${$viewportWidth > 1280 ? 'large' : $viewportWidth > 840 ? 'medium' : 'small'}/${name}`
											]}
											style={positionToStyle(splashartOffset)}
											crossorigin="anonymous"
											alt={$t(name)}
										/>
									</picture>
								</div>
							{/if}

							{#if type !== 'member'}
								<SplashartInfo
									animate={!$liteMode}
									combatType={combat_type}
									{name}
									{path}
									{rarity}
									{isNew}
								/>
								<BonusItem {rarity} type={undyingType} qty={undyingQty} {eidolon} {name} />
							{/if}
						</div>
					{/if}
				{/if}
			{/each}
		</div>
	{/if}

	{#if !standalone}
		{#if list[activeIndex].rarity > 3 || (showResultList && list.length > 1)}
			<ScreenshotShare animate shareURL={createShareableLink(activeIndex, showResultList)} />
		{/if}
	{/if}
</div>

<style>
	.warp-result {
		width: 100%;
		height: 100%;
		position: relative;
		top: 0;
		left: 0;
		z-index: +11;
	}

	img {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.close,
	.skip,
	.tanda-air {
		position: absolute;
		top: 0;
		right: 0;
		padding: 3.7vh 2%;
		z-index: +20;
	}

	:global(.mobileLandscape) .close,
	:global(.mobileLandscape) .skip {
		padding: 1.5vh 5%;
	}

	.container,
	.wrapper,
	.item-art,
	.item-content {
		width: 100%;
		height: 100%;
		display: flex;
		justify-content: center;
		align-items: center;
		position: relative;
	}

	.item-content {
		height: 60vw;
	}

	.item-art.character img {
		top: 50%;
		left: 50%;
		width: 85%;
		height: auto;
		transform: translate(-50%, -50%);
	}
	.item-art.character {
		max-width: 170vh;
	}

	.item-art .lightcone-item {
		width: 35vh;
		max-width: 35%;
		transform: rotate(8deg);
	}

	/* 点名结果（中文点名版新增）
	   注意：上方全局 img 规则与 .item-art.character img 都是绝对定位铺满，
	   这里必须用更高特异度的选择器覆盖，否则头像会被拉成全屏 */
	.item-art .member-content {
		width: 100%;
		height: 100%;
	}

	.member-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 34vh;
		max-width: 34%;
		aspect-ratio: 1/1;
		border-radius: 0.6rem;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
		background-image: linear-gradient(#3e3b66, #8858cc 80%);
		box-shadow: 0 0 2.5rem rgba(0, 0, 0, 0.55);
		border: 0.15rem solid rgba(255, 255, 255, 0.35);
	}

	/* 稀有度配色与 _bonus-item.svelte 的星辉/流光底图保持一致，视觉上与原皮肤对齐 */
	.member-card.star5 {
		background-image: linear-gradient(#7a514f, #d0a050 80%);
	}
	.member-card.star3 {
		background-image: linear-gradient(#2f4a63, #5f9dc9 80%);
	}

	.member-card img {
		position: static;
		top: auto;
		left: auto;
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: none;
	}

	.member-initial {
		font-size: calc(0.1 * var(--screen-width));
		color: rgba(255, 255, 255, 0.95);
		font-weight: 700;
		text-shadow: 0 0 1rem rgba(0, 0, 0, 0.5);
		line-height: 1;
	}

	.member-info {
		position: absolute;
		left: 5%;
		bottom: 8%;
		z-index: +3;
		color: #fff;
		text-align: left;
	}

	.member-name {
		font-size: calc(0.045 * var(--screen-width));
		font-weight: 700;
		text-shadow: 0 0 0.6rem rgba(0, 0, 0, 0.8);
		line-height: 120%;
	}

	.member-stars {
		display: flex;
		align-items: center;
		gap: 0.15rem;
		margin-top: 0.4rem;
		font-size: calc(0.022 * var(--screen-width));
		color: #ffe9a8;
		text-shadow: 0 0 0.4rem rgba(0, 0, 0, 0.8);
	}

	.member-from {
		margin-top: 0.5rem;
		font-size: calc(0.018 * var(--screen-width));
		color: rgba(255, 255, 255, 0.85);
		background-color: rgba(0, 0, 0, 0.4);
		border-radius: 2rem;
		padding: 0.2rem 0.8rem;
		display: inline-block;
	}

	:global(.mobileLandscape) .member-card {
		width: 26vh;
	}

	:global(.mobileLandscape) .member-name {
		font-size: calc(0.035 * var(--screen-width));
	}

	/* Preview  */
	.starrail-logo {
		width: 400px;
		height: unset;
		max-width: 70%;
		z-index: +10;
		display: none;
		transform: translate(-5%, -20%);
	}

	:global(.mobileLandscape) .starrail-logo {
		width: 22.5%;
	}

	:global(.mobileLandscape) .tanda-air {
		font-size: 150%;
	}
	.tanda-air {
		top: unset;
		text-align: right;
		bottom: 0;
		font-size: 200%;
		z-index: +1;
		color: #fff;
		display: none;
	}
	.via {
		font-size: 90%;
		font-family: var(--hsr-neue);
	}
	.get-yours {
		font-size: 80%;
	}
	.site {
		text-shadow: 0 0 0.15rem #000;
	}
	.site a:hover {
		text-decoration: underline;
	}

	.preview .starrail-logo,
	.preview .tanda-air {
		display: unset;
	}
</style>
