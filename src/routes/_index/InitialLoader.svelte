<script>
	import { getContext, onMount } from 'svelte';
	import { assets } from '$lib/stores/app-store';
	import { blobAssets, itemList, listingAssets } from '$lib/helpers/assets';

	let anyError = false;
	let current = 0;
	// 看门狗：20 秒内一个素材都没拉完（current 恒 0）说明加载流程根本没跑起来
	// （壳环境 hydration 失败 / SW 拦截等），弹兜底框给用户「重新加载/直接进入」，
	// 不再永久黑屏（用户 2026-11-05 壳内卡「正在连接」实测）
	let stuck = false;
	$: percentage = current > 99 ? 100 : current.toFixed();

	const handleLoaded = getContext('loaded');
	const assetList = itemList();

	// 单个素材拉取超时：上游是「串行 for-await 逐个 fetch」，任何一个请求挂起
	// （网络抖动 / dev 下 imagetools 实时转换卡住）整个初始化就永久停在黑屏，
	// handleLoaded 永远不被调用。加超时让挂起的请求落为 error，走「直接进入」兜底。
	const FETCH_TIMEOUT_MS = 15000;
	const withTimeout = (promise, ms) =>
		Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve('error'), ms))]);

	// 并发度：串行拉 ~500 个素材太慢（用户感知为长时间黑屏），限并发提速又不打爆连接池
	const CONCURRENCY = 8;

	const assetInit = async () => {
		const raw = listingAssets();
		const results = new Array(raw.length);
		let cursor = 0;
		let done = 0;

		const worker = async () => {
			while (cursor < raw.length) {
				const idx = cursor++;
				const { path, asset } = raw[idx];
				const blob = await withTimeout(blobAssets(path), FETCH_TIMEOUT_MS);
				if (blob === 'error') anyError = true;
				results[idx] = { url: blob, name: asset };
				done++;
				current = (done / raw.length) * 100;
			}
		};

		await Promise.all(Array.from({ length: Math.min(CONCURRENCY, raw.length) }, worker));

		assets.update((pv) => {
			pv = {};
			results.filter(Boolean).forEach(({ url, name }) => (pv[name] = url));
			return { ...pv, ...assetList };
		});

		if (anyError === false) handleLoaded();
	};

	onMount(() => {
		assetInit();
		setTimeout(() => {
			if (current === 0 && !anyError) stuck = true;
		}, 20000);
	});
</script>

{#if anyError || stuck}
	<div class="modal">
		<div class="modal-content">
			<div class="msg">
				{#if stuck}
					加载流程长时间没有响应，可能是本地缓存或运行环境异常。
					<br />
					<small>
						<small> 你可以重新加载试试，或直接进入模拟器。 </small>
					</small>
				{:else}
					部分素材加载失败，可能影响抽卡动画与画面的显示效果。
					<br />
					<small>
						<small> 你可以重新加载试试，或直接进入模拟器。 </small>
					</small>
				{/if}
			</div>
			<div class="btn">
				<button class="reload" on:click={() => window.location.reload()}>重新加载</button>
				<button class="open" on:click={handleLoaded}>直接进入</button>
			</div>
		</div>
	</div>
{/if}

<section>
	<div class="wrapper">
		<div class="ornament ornament1">
			<img src={assetList['loading-ornament.svg']} alt="" crossorigin="anonymous" />
		</div>
		<div class="ornament ornament2"></div>
		<div class="ornament ornament3"></div>
		<div class="text">
			<div class="loading">正在加载</div>
			{#if percentage > 0}
				<div class="percentage">{percentage}</div>
				<div class="hsr-text">崩坏星穹铁道</div>
			{/if}
		</div>
	</div>
</section>

<style>
	/* Star Modal */
	.modal {
		position: fixed;
		z-index: 9999;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		background-color: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(8px);
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
	}

	.modal-content {
		background-color: #fff;
		border-radius: 0.4rem;
		width: 500px;
		max-width: 80%;
		padding: 2%;
		color: #0e0e0e;
		font-size: 150%;
	}

	.btn {
		padding-top: 5%;
		width: 100%;
	}
	button {
		color: #fff;
		padding: 2% 6%;
	}

	.reload {
		background-color: #94866e;
	}

	.open {
		background-color: #353533;
	}
	/* End Modal */

	section {
		width: 100%;
		height: 100%;
		background-image: linear-gradient(to bottom, #101010, #0e0e0e);
		background-size: cover;
		display: flex;
		justify-content: center;
		align-items: center;
		position: fixed;
		top: 0;
		left: 0;
		z-index: 9980;
	}

	.wrapper {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
		width: 100%;
		height: 100%;
		max-height: 55vw;
		max-width: 190vh;
		text-align: center;
		mask-image: linear-gradient(transparent, black 10%, black 80%, transparent);
	}
	.text {
		position: relative;
		width: 100%;
	}

	.percentage {
		font-family: 'Novecento', sans-serif !important;
		font-size: calc(0.37 * var(--screen-width));
		transform: translateY(-10%);
		background-clip: text;
		/* text-fill-color: transparent; */
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.08));
	}

	.loading {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(calc(-50% + (0.0125 * var(--screen-width))), -50%);
		color: #d1aa6f;
		font-weight: 900;
		font-size: calc(0.025 * var(--screen-width));
		letter-spacing: calc(0.025 * var(--screen-width));
	}

	.hsr-text {
		font-family: var(--hsr-os-font);
		position: absolute;
		left: 50%;
		bottom: 83%;
		transform: translate(calc(-50% + (0.03 * var(--screen-width))), -50%);
		color: rgba(255, 255, 255, 0.5);
		font-size: calc(0.01 * var(--screen-width));
		letter-spacing: calc(0.06 * var(--screen-width));
	}

	img {
		width: 100%;
	}

	.ornament {
		position: absolute;
		transform: translate(-50%, -50%);
		left: 50%;
		aspect-ratio: 1/1;
	}
	.ornament1 {
		top: 80%;
		width: 82%;
	}
	.ornament1 img {
		animation: rotate 60s reverse linear infinite;
	}
	.ornament2 {
		width: 80%;
		bottom: 10%;
		border-radius: 100%;
		border: 2px solid rgba(255, 255, 255, 0.15);
	}
	.ornament3 {
		width: 75%;
		top: 78%;
		border-radius: 100%;
		border: 1px dashed rgba(255, 255, 255, 0.12);
	}

	@keyframes rotate {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
