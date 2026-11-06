<script>
	import { t } from 'svelte-i18n';
	import { fade } from 'svelte/transition';
	import { HOST } from '$lib/data/site-setup.json';
	import { brief } from '$lib/data/updates.json';

	// 应用版本号由 vite.config.js 的 define 在构建期注入（字面量替换）。
	// 不能 import package.json：Vite dev server 对 /package.json?import 返回 403。
	const version = __APP_VERSION__;

	// 赞赏码图加载完成后淡入，避免刚进页面时的白块闪烁
	let qrLoaded = false;

	/**
	 * 关于页（同步原神版 E4，中文修改版新增）
	 *
	 * 内容：版本号 + 仓库链接 + Issues 入口 + 求 star + 赞赏码。
	 * 更新日志不嵌在本页——用户要求独立成页（菜单「更新日志」项，updates.json 中文数据）。
	 * brief 仅用于显示「当前版本一句话要点」，避免用户以为关于页丢了更新信息。
	 */
</script>

<div class="about" in:fade={{ duration: 250 }}>
	<div class="container">
		<h2>{$t('menu.about')}</h2>
		<p class="ver">{$t('about.version')}: v{version}</p>

		<p class="intro">{$t('about.intro')}</p>

		<div class="links">
			<a href={HOST} target="_blank" rel="noopener noreferrer">{$t('about.repo')}</a>
			<a href={`${HOST}/issues`} target="_blank" rel="noopener noreferrer">
				{$t('about.issues')}
			</a>
		</div>

		<p class="star-hint">{$t('about.starHint')}</p>
		<a class="star-btn" href={HOST} target="_blank" rel="noopener noreferrer">
			<i class="hsr-star"></i> {$t('about.star')}
		</a>

		{#if brief?.length}
			<p class="latest">
				<strong>{$t('about.latest', { values: { ver: brief[0].ver } })}</strong>
				{brief[0].lines[0]}
			</p>
		{/if}

		<div class="donate">
			<h3>{$t('about.donateTitle')}</h3>
			<p class="donate-hint">{$t('about.donateHint')}</p>
			<img
				src="/donate/wechat-qr.png"
				alt={$t('about.donateAlt')}
				width="240"
				height="240"
				class:loaded={qrLoaded}
				on:load={() => (qrLoaded = true)}
				on:error={() => (qrLoaded = true)}
			/>
		</div>

		<p class="license">{$t('about.license')}</p>
	</div>
</div>

<style>
	.about {
		background-color: rgba(255, 255, 255, 0.85);
		width: 100%;
		height: 100%;
		border-top-right-radius: 2rem;
		color: #000;
		padding: 2%;
	}

	.container {
		width: 100%;
		height: 100%;
		overflow-y: auto;
		mask-image: linear-gradient(to bottom, black 95%, transparent 100%);
		padding-right: 0.5rem;
	}

	h2 {
		margin: 0 0 0.3rem;
	}

	h3 {
		margin: 1.2rem 0 0.4rem;
		font-size: 1rem;
		border-bottom: 1px dashed rgba(0, 0, 0, 0.2);
		padding-bottom: 0.3rem;
	}

	.ver {
		font-size: 0.85rem;
		color: rgba(0, 0, 0, 0.55);
	}

	.intro {
		font-size: 0.92rem;
		line-height: 1.6;
		margin: 0.6rem 0;
	}

	.links {
		display: flex;
		gap: 1.2rem;
		flex-wrap: wrap;
		margin: 0.6rem 0;
	}

	/* 关于页链接是纯文本锚点，默认无下划线；可点击的一律带下划线（原神版 D3 纪律） */
	a {
		color: #b06205;
		text-decoration: underline;
	}

	a:hover {
		color: #e3a023;
	}

	.star-hint {
		font-size: 0.9rem;
		margin: 0.8rem 0 0.4rem;
		line-height: 1.6;
	}

	.star-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.35rem 1.2rem;
		border: 1px solid #e3a023;
		border-radius: 2rem;
		background-color: #fff6e2;
		color: #8a5a00;
		font-weight: 600;
	}

	.latest {
		font-size: 0.88rem;
		color: rgba(0, 0, 0, 0.7);
		margin: 0.9rem 0 0;
		line-height: 1.6;
	}

	.donate {
		text-align: center;
		margin-top: 0.5rem;
	}

	.donate h3 {
		text-align: left;
	}

	.donate-hint {
		font-size: 0.9rem;
		line-height: 1.6;
		margin: 0.4rem 0 0.8rem;
	}

	.donate img {
		width: min(60vw, 15rem);
		height: auto;
		border-radius: 0.6rem;
		box-shadow: 0 0.2rem 1rem rgba(0, 0, 0, 0.25);
		/* 刚进页面图片未解码完成时露出白底闪一下：先铺米色底 + 解码完淡入消除白闪 */
		background-color: #f4efe4;
		opacity: 0;
		transition: opacity 0.35s ease;
	}

	.donate img.loaded {
		opacity: 1;
	}

	.license {
		margin-top: 1.2rem;
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.5);
		line-height: 1.6;
	}

	:global(.mobileLandscape) .container {
		padding-right: 0.3rem;
	}
</style>
