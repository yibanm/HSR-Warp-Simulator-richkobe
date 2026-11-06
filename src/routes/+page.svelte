<script>
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import {
		activePhase,
		activeVersion,
		isMobile,
		liteMode,
		showStarterBanner
	} from '$lib/stores/app-store';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { importLocalConfig, setBannerVersionAndPhase } from '$lib/helpers/dataAPI/storage-reader';
	import { browserState } from '$lib/helpers/page-navigation';
	import { handleShowStarter, initializeBanner } from '$lib/helpers/banner-loader';
	import { userCurrencies } from '$lib/helpers/shop-price';
	import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';

	import Welcome from './_index/Welcome.svelte';
	import PreloadExpress from './_index/PreloadExpress.svelte';
	import Banners from './_warp/index.svelte';
	import Menu from './_menu/index.svelte';

	let AllBanner, Collection, Shop, GachaInfo, ObtainedItem, ModalConvert;
	const asyncLoadComponent = async () => {
		ObtainedItem = (await import('$lib/components/ObtainedItem.svelte')).default;
		ModalConvert = (await import('$lib/components/ModalConvert.svelte')).default;

		AllBanner = (await import('./_allbanner/index.svelte')).default;
		Collection = (await import('./_collection/index.svelte')).default;
		Shop = (await import('./_shop/index.svelte')).default;
		GachaInfo = (await import('./_gachainfo/index.svelte')).default;
	};

	let status;
	let welcomeScreen = true;
	setContext('closeGreeting', () => (welcomeScreen = false));

	let pageActive = 'index';
	const navigate = (page) => {
		let beforeNavigate = pageActive;
		pageActive = page;
		if (beforeNavigate !== 'index') return browserState.back();
		if (beforeNavigate === pageActive) return;
		browserState.set(page);
	};
	setContext('navigate', navigate);

	const checkBannerStatus = async (initBanner) => ({ status } = await initBanner);
	$: initBanner = initializeBanner($activeVersion, $activePhase);
	$: checkBannerStatus(initBanner);
	$: handleShowStarter($showStarterBanner);

	const handleLiteMode = () => {
		const lLitemode = localConfig.get('litemode');
		if (typeof lLitemode !== 'boolean') {
			liteMode.set(true);
			localConfig.set('litemode', true);
		}
	};

	const onWarp = writable(false);
	setContext('onWarp', onWarp);

	onMount(() => {
		// 勾过「不再提示」后启动不弹欢迎窗。读取失败（隐私模式等）按默认弹出。
		// 放 onMount 而非模块顶层：本路由 prerender，顶层碰 localStorage 会在构建期报错
		try {
			if (localStorage.getItem('hsrws-hide-welcome') === '1') welcomeScreen = false;
		} catch (e) {
			/* 读不到就照常弹窗 */
		}

		setBannerVersionAndPhase();
		importLocalConfig();

		// Load Component
		asyncLoadComponent();

		// litemode
		if ($isMobile) handleLiteMode();

		// Detect Currencies
		userCurrencies.init();

		window.addEventListener('popstate', (e) => {
			if (e.state?.page) return;
			if (pageActive === 'index') return;
			navigate('index');
		});
	});

	// Convert Modal
	let showConvertModal = false;
	setContext('openConvertModal', () => (showConvertModal = true));
	setContext('closeConvertModal', () => (showConvertModal = false));

	// Obtained
	let showObtained = false;
	let obtainedData = {};
	const openObtained = (data) => {
		obtainedData = data;
		showObtained = true;
	};
	const closeObtained = () => {
		showObtained = false;
		obtainedData = {};
		playSfx('modal-close');
	};
	setContext('openObtained', openObtained);
	setContext('closeObtained', closeObtained);

	// Express Loader
	const readyToPull = writable(true);
	setContext('readyToPull', readyToPull);
</script>

{#if status === 'error'}
	卡池数据加载失败，请刷新页面重试
{/if}

<!-- Warp Section -->
{#if pageActive === 'index'}
	<Banners />
	<Menu />

	<!-- Banner List -->
{:else if pageActive === 'allbanner'}
	<svelte:component this={AllBanner} />

	<!-- Inventory -->
{:else if pageActive === 'collection'}
	<svelte:component this={Collection} />

	<!-- Shop -->
{:else if pageActive === 'shop'}
	<svelte:component this={Shop} />

	<!-- Wrap Details -->
{:else if pageActive === 'details'}
	<svelte:component this={GachaInfo} />
{/if}

<!-- Utils -->
{#if showObtained}
	<svelte:component this={ObtainedItem} {...obtainedData} />
{/if}

{#if showConvertModal}
	<svelte:component this={ModalConvert} />
{/if}

{#if welcomeScreen}
	<Welcome />
{/if}
<PreloadExpress />
