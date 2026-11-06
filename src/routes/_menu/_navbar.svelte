<script>
	import NavLink from '$lib/components/NavLink.svelte';
	import NavLinkItem from '$lib/components/NavLinkItem.svelte';
	import { playSfx } from '$lib/helpers/sounds/audiofx';
	import { getContext } from 'svelte';

	export let horizontal = false;
	export let activeMenu;

	const selectMenu = getContext('selectMenu');
	const select = (selected) => {
		if (selected === activeMenu) return;
		playSfx('sidebar-click');
		selectMenu(selected);
	};
</script>

<div class="nav" class:horizontal>
	<NavLink {horizontal} notext>
		<!-- 设置图标用单齿轮 cog：cogs 双齿轮字形宽超 em box，圆盒内左半被裁（截图实锤） -->
		<NavLinkItem
			icon="cog"
			active={activeMenu === 'settings'}
			on:click={() => select('settings')}
		/>
		<NavLinkItem
			icon="character"
			active={activeMenu === 'rollcall'}
			on:click={() => select('rollcall')}
		/>
		<!-- 更新日志排在点名之后（用户 2026-11-05 指定顺序） -->
		<NavLinkItem
			icon="log"
			active={activeMenu === 'updatelog'}
			on:click={() => select('updatelog')}
		/>
		<!-- 关于页入口（同步原神版 E4）：仓库链接/求 star/赞赏码 -->
		<NavLinkItem
			icon="star"
			active={activeMenu === 'about'}
			on:click={() => select('about')}
		/>
	</NavLink>
</div>

<style>
	/* horizontal 类在本组件根 div 上（.nav 是 section 直子，天然全宽）。
	   子组件 NavLink 的 aside / NavLinkItem 的 icon-wrapper 用 :global 后代选择器覆盖，
	   祖先部分带本组件 scope（.nav.horizontal），多轮 HMR 下也稳定命中。 */
	.nav.horizontal {
		padding-top: 1.2vh;
		display: flex;
		justify-content: center;
	}

	/* aside.notext 是 width:unset 内容宽，整条宽度链（aside→wrapper→Scrollable→scroll-content）
	   都塌成内容宽，首个图标溢出左边界被裁一半（截图实锤）。横排 aside 必须显式占满整行 */
	.nav.horizontal :global(aside.horizontal) {
		width: 100%;
	}

	/* aside.notext 是 width:unset 内容宽，横排时让它按内容排、整行由 .nav 居中 */
	.nav.horizontal :global(aside) {
		width: auto;
		min-width: unset;
	}

	/* 25rem 图标盒在横排下远超视口（首个图标被裁一半，用户截图实锤）；横排固定 3.5rem */
	.nav.horizontal :global(.icon-wrapper) {
		width: 3.5rem;
		transform: scale(0.9);
	}

	/* .icon 原本 width:100% 依赖父盒，显式给宽防塌缩 */
	.nav.horizontal :global(.icon) {
		width: 3.2rem;
	}

	/* 横排 4 图标时 .item 的 1% padding 太挤（圆盒几乎相贴），横向加间距 */
	.nav.horizontal :global(.item) {
		padding: 0.5% 1.6%;
	}
</style>
