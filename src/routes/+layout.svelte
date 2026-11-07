<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount, setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { isLoading, locale } from 'svelte-i18n';
	import { dev } from '$app/environment';
	import './styles.css';

	import {
		isMobile,
		isMobileLandscape,
		isPWA,
		viewportWidth,
		viewportHeight
	} from '$lib/stores/app-store';
	import { APP_TITLE, DESCRIPTION, HOST, KEYWORDS } from '$lib/data/site-setup.json';
	import { IDBUpdater } from '$lib/helpers/migrator/idbUpdater';
	import { wakeLock } from '$lib/helpers/wakelock';
	import { mobileDetect } from '$lib/helpers/mobile-detect';
	import { mountLocale } from '$lib/helpers/i18n';
	import { toast, closeToast } from '$lib/stores/toast';
	import { initRollcall } from '$lib/helpers/dataAPI/api-rollcall';
	import { initStorage } from '$lib/helpers/dataAPI/api-localstorage';
	import { initPrefs } from '$lib/helpers/dataAPI/api-cookie';
	import { HistoryManager } from '$lib/helpers/dataAPI/api-indexeddb';

	import InitialLoader from './_index/InitialLoader.svelte';
	import Toast from '$lib/components/Toast.svelte';

	let isLoaded = false;
	setContext('loaded', () => (isLoaded = true));
	// 全局轻提示：Toast.svelte 靠 getContext('closeToast') 关闭，在此提供
	setContext('closeToast', closeToast);

	let innerHeight;
	let innerWidth;
	$: viewportWidth.set(innerWidth);
	$: viewportHeight.set(innerHeight);

	let font = '';
	$: {
		const lc = $locale?.toLowerCase() || '';
		const cnLogo = lc.match(/(zh|ja)/);
		font = cnLogo || lc.includes('th') ? lc.split('-')[0] : 'os';
	}

	const redirectIfNotValidPath = () => {
		const allowedPath = ['screen', 'privacy-policy'];
		const { pathname } = $page.url;
		const pathNow = pathname.split('/')[1];
		if (!pathNow || allowedPath.includes(pathNow)) return;
		return goto('/');
	};

	const setMobileMode = () => {
		if ($isPWA) return isMobileLandscape.set(true);
		const angle = screen.orientation?.angle || 0;
		const rotate = angle === 90 || angle === 270;
		isMobileLandscape.set(rotate);
	};

	mountLocale();
	onMount(async () => {
		redirectIfNotValidPath();

		const url = new URL(window.location.href);
		const searchParams = new URLSearchParams(url.search);
		isPWA.set(!!searchParams.get('pwasc'));

		isMobile.set(mobileDetect() || innerWidth < 601);
		if ($isMobile) setMobileMode();

		window.addEventListener('orientationchange', () => {
			if ($isMobile) setMobileMode();
		});

		wakeLock(); // Prevent screen off while open the app

		// 数据层初始化必须先于一切读存储的逻辑：明文文件读入内存缓存，
		// 缺失时从旧 localStorage/cookie/IndexedDB 一次性迁移（2026-11-07 数据落盘改造）
		await initStorage();
		await initPrefs();

		await IDBUpdater(); // update site data to the newer version

		// 触发抽卡历史的一次性迁移（HistoryManager 惰性加载，不碰就不会把旧
		// IndexedDB 历史搬进 gacha/history.json）；顺带预热内存缓存
		HistoryManager.getAllHistories().catch((e) => console.error('历史迁移失败：', e));

		// 点名名单：在应用级初始化（读取存储、清理指向已删名单的勾选与池进度）。
		// 必须放这里而不是名单管理页——若只在管理页初始化，卡面与抽卡入口首次渲染时
		// 读不到勾选状态，会一直显示「未勾选名单」。
		await initRollcall();

		// Service Worker for Faster Load
		// 原生壳（Tauri/Electron/Capacitor）一律不注册 SW：自定义 scheme 下 SW 的
		// NetworkFirst 取不到网络、precache 又是空的，动态 import 的 chunk（含
		// events/<version>.json）加载失败 → bannerList 永远为空 → 标题显示兜底英文
		// 「Subject To Change」、缩略图与背景全黑（用户 2026-11-05 Tauri 实测卡
		// 「正在连接」、2026-11-07 安卓真机实测整屏黑底，同一根因）
		const inShell =
			typeof window !== 'undefined' &&
			(!!window.__TAURI__ ||
				!!window.__TAURI_INTERNALS__ ||
				!!window.electronAPI ||
				!!window.Capacitor?.isNativePlatform?.());
		if ('serviceWorker' in navigator && !dev && !inShell) {
			navigator.serviceWorker.register('/sw.js'); // /dev-sw.js?dev-sw
		} else if (inShell && 'serviceWorker' in navigator) {
			// 壳环境清掉历史版本可能注册过的 SW，否则旧 SW 继续拦截请求
			navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
		}
		// prevent Righ click (hold on android) on production mode
		if (!dev) document.addEventListener('contextmenu', (e) => e.preventDefault());
	});
</script>

<svelte:window bind:innerHeight bind:innerWidth />

<svelte:head>
	<meta name="description" content={DESCRIPTION} />
	<meta name="keywords" content={KEYWORDS} />
	<meta property="al:web:url" content={HOST} />
	<link rel="fluid-icon" href="{HOST}/meta-picture.jpg" title={APP_TITLE} />

	<meta property="og:url" content={HOST} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={APP_TITLE} />
	<meta property="og:description" content={DESCRIPTION} />
	<meta property="og:image" content="{HOST}/meta-picture.jpg" />

	<meta name="twitter:card" content="summary_large_image" />
	<meta property="twitter:domain" content={HOST.replace('https://', '').replace('http://', '')} />
	<meta property="twitter:url" content={HOST} />
	<meta name="twitter:title" content={APP_TITLE} />
	<meta name="twitter:description" content={DESCRIPTION} />
	<meta name="twitter:image" content="{HOST}/meta-picture.jpg" />

	{#if !dev}
		<link rel="manifest" href="/appmanifest.json" />
	{/if}

	{#if $page.url.pathname !== '/'}
		<link rel="canonical" href={HOST} />
	{/if}

	<link
		rel="preload"
		href="/fonts/NovecentoSans-WideBold.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/StarRailNeue-Regular.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_global_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
	<link
		rel="preload"
		href="/fonts/optimized_ja_web.woff2"
		as="font"
		type="font/woff2"
		crossorigin
	/>
</svelte:head>

<main
	style="--screen-width:{innerWidth}px; --screen-height:{innerHeight}px; --ratio:{innerWidth}/{innerHeight}; --hsr-font:var(--hsr-{font}-font)"
	class:mobileLandscape={$isMobileLandscape}
	class={$locale}
>
	{#if !isLoaded}
		<div class="loading" transition:fade={{ duration: 250 }}>
			<InitialLoader />
		</div>
	{/if}

	{#if !$isLoading && isLoaded}
		<slot />
	{/if}

	{#if $toast}
		<Toast autoclose={false}>{$toast.message}</Toast>
	{/if}
</main>

<style>
	@font-face {
		font-family: 'StarRail_Global_Web';
		src: url('/fonts/optimized_global_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'StarRail_JA_Web';
		src: url('/fonts/optimized_ja_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'StarRail_ZH_Web';
		src: url('/fonts/optimized_zh_web.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'StarRail Neue';
		src: url('/fonts/StarRailNeue-Regular.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	@font-face {
		font-family: 'Novecento';
		src: url('/fonts/NovecentoSans-WideBold.woff2') format('woff2');
		font-weight: normal;
		font-style: normal;
	}

	main {
		display: block;
		width: 100vw;
		height: 100vh;
		aspect-ratio: var(--ratio);
		overflow: hidden;
		font-family: var(--hsr-font);
		background-color: #000;
	}

	.loading {
		width: 100vw;
		height: 100%;
		position: absolute;
		z-index: 9980;
		left: 0;
		top: 0;
	}

	:global(audio) {
		visibility: hidden;
	}
</style>
