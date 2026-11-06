<script>
	import { getContext, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { assets, viewportHeight } from '$lib/stores/app-store';
	import { playSfx, stopSfx } from '$lib/helpers/sounds/audiofx';
	import ButtonIcon from '$lib/components/ButtonIcon.svelte';

	export let show;
	export let rarity;
	export let banner;

	let regular3star;
	let regular4star;
	let regular5star;
	let event3star;
	let event4star;
	let event5star;
	let showSkipButton = false;
	// arrived 去重守卫：ended 事件与播放失败兜底可能先后触发，只认第一次，
	// 否则 showSplashArt 被调两次会重置结果屏状态
	let arrived = false;

	const showSplashArt = getContext('showSplashArt');
	const onExpressArrived = ({ skip = false } = {}) => {
		if (arrived) return;
		arrived = true;
		showSplashArt({ skip });
		showSkipButton = false;
	};

	const skip = () => {
		stopSfx(`express-${rarity}star`);
		onExpressArrived({ skip: true });
		const doms = [regular3star, regular4star, regular5star, event3star, event4star, event5star];
		doms.forEach((video) => {
			video.load();
			video.style.display = 'none';
		});
	};

	onMount(() => {
		const doms = [regular3star, regular4star, regular5star, event3star, event4star, event5star];
		doms.forEach((video) => {
			video.addEventListener('ended', () => {
				video.style.display = 'none';
				video.load();
				onExpressArrived();
			});
		});
	});

	/**
	 * play() 的 Promise 在 WebView2 下可能永远 pending（缓冲中既不 resolve 也不 reject），
	 * 不处理会让 .express 黑屏层永久盖住界面。
	 *
	 * 但不能用「N 秒没开始播就判失败并跳过动画」——冷启动时视频还在缓冲、paused 仍为 true，
	 * 会把正常播放误杀成失败，用户表现为「列车动画直接没了」（2026-11-06 实测回归）。
	 * 正确做法：只有 play() 明确 reject（自动播放被拦、解码器缺失）才跳过动画；
	 * 单纯的 pending 不跳过，靠下方 2 秒亮出的 skip 按钮给用户手动逃生口，播放开始后由 ended 收尾。
	 */
	const showVideoHandle = async (rarity, type) => {
		let videoContent;
		if (['starter', 'regular'].includes(type)) {
			switch (rarity) {
				case 3:
					videoContent = regular3star;
					break;
				case 4:
					videoContent = regular4star;
					break;
				case 5:
					videoContent = regular5star;
					break;
			}
		} else {
			switch (rarity) {
				case 3:
					videoContent = event3star;
					break;
				case 4:
					videoContent = event4star;
					break;
				case 5:
					videoContent = event5star;
					break;
			}
		}

		// video 的 src 来自 IndexedDB 的 blob（见 express-loader.js）。blob 可能 size 正常但底层
		// 数据不可读（Chromium 被强杀会留下这种「幽灵 blob」），此时 <video> 报
		// MediaError code4: Format error。而 express-loader 的 check() 只校验 6 个 key 是否齐全、
		// 从不校验 blob 可用性，坏 blob 会被绑上 video → 动画整段被跳过（2026-11-06 壳内实测）。
		// 静态文件本身是好的，故降级到 /videos/*.mp4 直接播，动画得以保留。
		const isRegular = ['starter', 'regular'].includes(type);
		const staticSrc = `/videos/${isRegular ? 'regular' : 'event'}-${rarity}star.mp4`;

		if (!videoContent) {
			console.error('Failed to call Astral Express: 未找到对应稀有度的 video 元素');
			return onExpressArrived();
		}
		if (videoContent.error || isNaN(videoContent.duration)) {
			console.error('Astral Express 视频不可用，降级到静态文件：', videoContent.error);
			videoContent.src = staticSrc;
			videoContent.load();
			// 等静态文件的元数据就绪；失败才放弃动画，避免直接砍掉整段演出
			const ready = await new Promise((ok) => {
				const timer = setTimeout(() => ok(false), 8000);
				videoContent.addEventListener(
					'loadedmetadata',
					() => {
						clearTimeout(timer);
						ok(true);
					},
					{ once: true }
				);
				videoContent.addEventListener(
					'error',
					() => {
						clearTimeout(timer);
						ok(false);
					},
					{ once: true }
				);
			});
			if (!ready || isNaN(videoContent.duration)) {
				console.error('静态视频也不可用，跳过动画直接出结果');
				return onExpressArrived();
			}
		}
		videoContent.style.display = 'unset';
		// 2 秒内还没开始播放就主动亮出跳过按钮（原逻辑要点屏幕才出现，卡住时用户无从下手）
		setTimeout(() => {
			if (!arrived && videoContent.paused) showSkipButton = true;
		}, 2000);
		// 只接明确的 reject：play() 因自动播放被拦或解码器缺失而 reject 时跳过动画，
		// 否则 .express 黑屏层会永远盖在主界面上（用户表现为「动画不完整、卡黑屏」）。
		// pending（还在缓冲）不跳过——跳过就等于把动画砍掉。
		try {
			await videoContent.play();
		} catch (e) {
			console.error('星穹列车动画播放失败，直接展示结果：', e);
			return onExpressArrived({ skip: true });
		}
		playSfx(`express-${rarity}star`);
		return;
	};

	$: if (show) {
		arrived = false;
		showVideoHandle(rarity, banner);
	}
</script>

<div
	role="dialog"
	tabindex="0"
	class:show
	class="express"
	style="height: {$viewportHeight}px"
	on:mousedown={() => (showSkipButton = true)}
>
	<!-- Insert All Video To DOM first -->
	<div class="video">
		<video
			bind:this={regular3star}
			muted
			src={$assets['regular-3star.mp4']}
			type="video/mp4"
			crossorigin="anonymous"
		></video>
		<video
			bind:this={regular4star}
			muted
			src={$assets['regular-4star.mp4']}
			type="video/mp4"
			crossorigin="anonymous"
		></video>
		<video
			bind:this={regular5star}
			muted
			src={$assets['regular-5star.mp4']}
			type="video/mp4"
			crossorigin="anonymous"
		></video>

		<!-- Event Warp -->
		<video
			bind:this={event3star}
			muted
			src={$assets['event-3star.mp4']}
			type="video/mp4"
			crossorigin="anonymous"
		></video>
		<video
			bind:this={event4star}
			muted
			src={$assets['event-4star.mp4']}
			type="video/mp4"
			crossorigin="anonymous"
		></video>
		<video
			bind:this={event5star}
			muted
			src={$assets['event-5star.mp4']}
			type="video/mp4"
			crossorigin="anonymous"
		></video>

		{#if showSkipButton}
			<div class="skip" in:fade={{ duration: 200 }}>
				<ButtonIcon icon="skip" on:click={skip} />
			</div>
		{/if}
	</div>
</div>

<style>
	.express {
		position: fixed;
		z-index: 990;
		display: none;
		top: 0;
		left: 0;
		width: 100vw;
	}
	.express.show {
		display: block;
	}

	.video {
		position: relative;
		width: 100vw;
		height: 100%;
	}

	video {
		display: none;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: bottom;
	}

	.skip {
		position: absolute;
		top: 0;
		right: 0;
		padding: 3.7vh 2%;
		z-index: 10;
	}

	:global(.mobileLandscape) .skip {
		padding: 1.5vh 5%;
	}
</style>
