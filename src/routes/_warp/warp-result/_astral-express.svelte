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
	// arrived 去重守卫：ended 事件与超时兜底可能先后触发，只认第一次，
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
	 * play() 的 Promise 在 WebView2/解码慢的环境下可能永远 pending（缓冲中既不 resolve 也不
	 * reject），catch 接不住 pending → onExpressArrived 永不调用 → 卡星空（Tauri 壳实测复现）。
	 * 超时兜底：8 秒内没开始播放就当失败直接出结果；已开始播放则交给 ended 事件收尾。
	 */
	const PLAY_TIMEOUT_MS = 8000;
	const playWithTimeout = (video) =>
		Promise.race([
			video.play(),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('play timeout')), PLAY_TIMEOUT_MS)
			)
		]).then(
			() => 'played',
			(e) => {
				// 超时但实际已在播放（竞态）：不算失败，交给 ended 收尾
				if (!video.paused && !video.ended) return 'playing-late';
				throw e;
			}
		);

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

		if (!videoContent || videoContent.error || isNaN(videoContent.duration)) {
			// showToast = true;
			console.error('Failed to call Astral Express!', videoContent.error);
			return onExpressArrived();
		}
		videoContent.style.display = 'unset';
		// 2 秒内还没开始播放就主动亮出跳过按钮（原逻辑要点屏幕才出现，卡住时用户无从下手）
		setTimeout(() => {
			if (!arrived && videoContent.paused) showSkipButton = true;
		}, 2000);
		// play() 必须 catch：视频未加载完/被浏览器拦截自动播放时它会 reject，
		// 不接住的话整个函数中断，onExpressArrived 永不调用，
		// .express 黑屏层会永远盖在主界面上（用户表现为「动画不完整、卡黑屏」）
		try {
			await playWithTimeout(videoContent);
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
