<script>
	import { getContext, onMount, setContext } from 'svelte';
	import { fade } from 'svelte/transition';
	import { t } from 'svelte-i18n';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { isMobileLandscape } from '$lib/stores/app-store';
	import ButtonIcon from '$lib/components/ButtonIcon.svelte';

	import Header from '$lib/components/Header.svelte';
	import Navbar from './_navbar.svelte';
	import UpdateLog from './UpdateLog.svelte';
	import Settings from './Settings.svelte';
	import Rollcall from './Rollcall.svelte';
	import About from './About.svelte';

	const closeMenu = getContext('toggleMenu');
	// 打开菜单时的直达页（名单管理等跨模块入口），默认设置页
	export let initialMenu = 'settings';
	let activeMenu = initialMenu;
	const selectMenu = (menu) => (activeMenu = menu);
	setContext('selectMenu', selectMenu);

	let activeOption = '';
	const openOption = (option) => (activeOption = option);
	setContext('openOption', openOption);
	onMount(() => playSfx('setting-loaded'));
</script>

<section
	role="dialog"
	tabindex="0"
	transition:fade={{ duration: 200 }}
	on:mousedown={() => openOption('')}
>
	<!-- 横排导航独立成行（脱离 Header 的 absolute 定位上下文，避免裁切/偏移） -->
	{#if !$isMobileLandscape}
		<Navbar horizontal {activeMenu} />
	{/if}
	<Header h1={$t('menu.heading')} h2={$t(`menu.${activeMenu}`)} icon="menu" relative>
		<div class="close" class:right={$isMobileLandscape}>
			<ButtonIcon on:click={closeMenu} />
		</div>
	</Header>

	<div class="container">
		{#if $isMobileLandscape}
			<Navbar {activeMenu} />
		{/if}

		{#if activeMenu === 'settings'}
			<Settings {activeOption} />
		{/if}

		{#if activeMenu === 'updatelog'}
			<UpdateLog />
		{/if}

		{#if activeMenu === 'rollcall'}
			<Rollcall />
		{/if}

		{#if activeMenu === 'about'}
			<About />
		{/if}
	</div>
</section>

<style>
	section {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 100;
		background-color: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(15px);
		display: flex;
		flex-direction: column;
	}

	.container {
		padding: 1rem 5%;
		width: 100%;
		/* 顶部新增横排导航行后，88% 固定高会溢出；改弹性填充剩余高度 */
		flex: 1;
		min-height: 0;
		display: flex;
	}
	.right {
		margin-left: auto;
	}
	.close {
		position: relative;
		z-index: +1;
	}
</style>
