<script>
	import { getContext } from 'svelte';
	import { t } from 'svelte-i18n';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { regularPass, specialPass, stellarJade, warpAmount } from '$lib/stores/app-store';

	import Header from '$lib/components/Header.svelte';
	import MyFund from '$lib/components/MyFund.svelte';
	import ButtonIcon from '$lib/components/ButtonIcon.svelte';

	export let bannerType = '';
	export let bannerName = '';

	$: event = bannerType.match('event');
	$: balance = event ? $specialPass : $regularPass;
	$: unlimitedWarp = $warpAmount === 'unlimited';
	$: heading = bannerName ? $t(`banner.${bannerName}`) : 'Subject To Change';

	const navigate = getContext('navigate');
	const openAllBanners = () => {
		playSfx();
		navigate('allbanner');
	};
</script>

<Header icon="warp" h1={$t('warp.heading')} h2={heading} hideDesktopIcon>
	<!-- 左上角历史按钮（同步原神版）：往期卡池列表。图标字体有 hsr-time 时钟字形，无需内联 SVG -->
	<svelte:fragment slot="title-extra">
		<button
			class="history-btn"
			on:click={openAllBanners}
			title={$t('warp.historyBtn')}
			aria-label={$t('warp.historyBtn')}
		>
			<i class="hsr-time"></i>
		</button>
	</svelte:fragment>
	<div class="budget">
		<MyFund type={event ? 'specialPass' : 'regularPass'}>
			{unlimitedWarp ? '∞' : balance}
		</MyFund>
		<MyFund type="stellarJade" plusbutton>
			{unlimitedWarp ? '∞' : $stellarJade}
		</MyFund>
	</div>
	<div class="close">
		<ButtonIcon on:click={openAllBanners} />
	</div>
</Header>

<style>
	/* 左上角历史按钮（同步原神版 .help 圆形白边样式）；移动端按 mobileLandscape 缩小 */
	.history-btn {
		margin-left: 0.8rem;
		width: 2rem;
		height: 2rem;
		border-radius: 50px;
		border: 0.15rem solid #fff;
		color: #fff;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 130%;
		line-height: 0;
		transition: all 0.2s;
	}

	.history-btn:active {
		transform: scale(0.9);
	}

	:global(.mobileLandscape) .history-btn {
		width: 1.4rem;
		height: 1.4rem;
		margin-left: 0.5rem;
	}
</style>
