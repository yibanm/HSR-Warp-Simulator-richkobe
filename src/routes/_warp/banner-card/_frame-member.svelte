<script>
	import { t } from 'svelte-i18n';
	import { fade } from '$lib/helpers/transition';
	import { rollcallStore, getPoolStats } from '$lib/helpers/dataAPI/api-rollcall';
	import { menuRequest } from '$lib/stores/app-store';
	import { playSfx } from '$lib/helpers/sounds/audiofx';

	// 直达菜单名单页：写请求 store，_menu/index.svelte 订阅后自动开菜单（context 链在卡面组件里拿不到）
	const openRollcallManage = () => {
		playSfx();
		menuRequest.set('rollcall');
	};

	/**
	 * 点名卡池卡面（中文点名版新增）
	 *
	 * 视觉沿用常驻跃迁（_frame-regular）的皮肤：同样的 .content / .banner-name /
	 * .wrapper-info 结构与配色，因此和其它卡池放在一起不违和（用户要求「新添加的
	 * 功能要和原皮肤对得上」）。差异只在正文——展示当前启用了哪些名单、这一轮已点
	 * 多少人，让用户不进菜单就能知道池子状态。
	 *
	 * 背景（_bn-member 位置）直接复用 BnRegular 的常驻立绘，见 BannerItem.svelte。
	 */

	// 订阅名单状态，勾选变化时卡面即时刷新
	$: rc = $rollcallStore;
	$: selectedLists = (rc?.lists || []).filter((l) => (rc?.selected || []).includes(l.id));
	// 依赖 rc 触发重算：抽卡结束后 doRoll 会调 refreshRollcall()，这里才会跟着更新
	$: stats = rc ? getPoolStats() : { total: 0, remaining: 0, drawn: 0 };

	// 展示的名单名，超过 3 个只列前 3 个 + 省略
	const MAX_SHOW = 3;
	$: shownLabels = selectedLists.slice(0, MAX_SHOW).map((l) => l.label);
	$: moreCount = selectedLists.length > MAX_SHOW ? selectedLists.length - MAX_SHOW : 0;
</script>

<div class="content" in:fade|global={{ duration: 500, delay: 250 }}>
	<div class="banner-name">{$t('rollcall.bannerTag')}</div>

	<div class="wrapper-info">
		<div class="info-body">
			<h1>{$t('rollcall.bannerName')}</h1>
			<div class="description">
				{#if !selectedLists.length}
					<p class="hint">{$t('rollcall.noListSelected')}</p>
				{:else}
					<p class="pool-stat">
						{$t('rollcall.poolStat', { values: { remaining: stats.drawn, total: stats.total } })}
					</p>
					<div class="list-names">
						{#each shownLabels as label (label)}
							<span class="tag">{label}</span>
						{/each}
						{#if moreCount > 0}
							<span class="tag more">+{moreCount}</span>
						{/if}
					</div>
				{/if}
				<!-- 名单管理直达按钮（用户 2026-11-05 要求）：开菜单并定位名单页 -->
				<button type="button" class="manage-btn" on:click={openRollcallManage}>
					<i class="hsr-character"></i> {$t('rollcall.manageLists')}
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.content {
		width: 100%;
		height: 100%;
		position: relative;
		display: flex;
		z-index: +1;
	}

	.banner-name {
		position: absolute;
		top: 2%;
		left: -1.1%;
		font-size: calc(0.015 * var(--bw));
		padding: 0.45% 1.5%;
		border-top-right-radius: 2rem;
		border-bottom-right-radius: 2rem;
		background-color: #3d81ce;
		z-index: +2;
	}

	.wrapper-info {
		width: 30%;
		height: 100%;
		color: #333;
		padding: 1.3%;
		position: relative;
		z-index: +1;
	}

	.info-body {
		height: 100%;
		border-left: 1px solid #aaa;
		padding: 5%;
		display: flex;
		flex-direction: column;
	}

	:global(.mobileLandscape) .info-body {
		padding: 5% 5% 5% 7%;
	}

	h1 {
		margin-top: 5%;
		font-size: calc(0.041 * var(--bw));
		display: flex;
		align-items: center;
	}
	/* 中文标题笔画多，需放大，与 _frame-regular 的 zh-CN 处理一致 */
	:global(.ja-JP) h1,
	:global(.zh-CN) h1,
	:global(.zh-TW) h1 {
		font-size: calc(0.055 * var(--bw));
	}

	.description {
		padding: 6% 0 0 1%;
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		overflow: auto;
		opacity: 0.9;
	}

	.hint {
		font-size: calc(0.016 * var(--bw));
		line-height: 150%;
		color: #a4553f;
	}

	.pool-stat {
		font-size: calc(0.018 * var(--bw));
		line-height: 140%;
		color: #444;
		margin-bottom: calc(0.02 * var(--bw));
	}

	.list-names {
		display: flex;
		flex-wrap: wrap;
		gap: calc(0.008 * var(--bw));
	}

	.tag {
		color: #4a3b2a;
		background-color: #e8dcc4;
		border: 0.08rem solid #c9b58d;
		border-radius: 2rem;
		padding: calc(0.004 * var(--bw)) calc(0.012 * var(--bw));
		font-size: calc(0.014 * var(--bw));
		white-space: nowrap;
	}

	.tag.more {
		background-color: #d8c9a8;
	}

	.manage-btn {
		margin-top: calc(0.02 * var(--bw));
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: calc(0.006 * var(--bw)) calc(0.016 * var(--bw));
		border: 1px solid #c9b58d;
		border-radius: 2rem;
		background-color: rgba(255, 255, 255, 0.75);
		color: #4a3b2a;
		font-size: calc(0.015 * var(--bw));
		white-space: nowrap;
		transition: all 0.2s;
	}

	.manage-btn:hover {
		background-color: #fff;
	}

	.manage-btn:active {
		transform: scale(0.95);
	}

	:global(.mobileLandscape) .description {
		font-size: calc(0.016 * var(--bw));
	}
</style>
