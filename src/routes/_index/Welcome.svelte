<script>
	import { getContext } from 'svelte';
	import { t } from 'svelte-i18n';
	import { fade, fly } from 'svelte/transition';

	// 开屏公告改渲染本仓库中文 updates.json（上游英文 logs.json 不再上屏）
	import { brief } from '$lib/data/updates.json';
	import { isPWA } from '$lib/stores/app-store';
	import { browserDetect } from '$lib/helpers/mobile-detect';
	import { playSfx } from '$lib/helpers/sounds/audiofx';

	const closeWelcomeScreen = getContext('closeGreeting');
	// 「不再提示」勾选状态：提交时写入 localStorage，下次启动由 +page.svelte 读取跳过弹窗
	let dontShowAgain = false;
	const handleSubmit = () => {
		playSfx();
		if (dontShowAgain) {
			try {
				localStorage.setItem('hsrws-hide-welcome', '1');
			} catch (e) {
				// 隐私模式等写入失败不影响进入模拟器，仅下次仍会弹窗
				console.error('保存「不再提示」失败：', e);
			}
		}
		closeWelcomeScreen();
	};
</script>

<div class="welcome" out:fade>
	<div class="container">
		<div class="wrapper" out:fly={{ y: 25 }}>
			<div class="header">
				<h1>{$t('title')}</h1>
				<h2>{$t('welcomeMsg')}</h2>
				<p class="intro">{$t('welcomeIntro')}</p>

				{#if !browserDetect().isSupported && $isPWA}
					<div class="updates adExpired">
						<strong> {$t('browserNotice')} </strong>
					</div>
				{:else}
					<div class="updates">
						{#each brief.slice(0, 1) as { ver, lines }}
							<span>
								<i class="tgl"> v{ver} </i>
							</span>
							{#each lines as txt (txt)}
								<p>{txt}</p>
							{/each}
							<div style="height: .5rem"></div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="footer">
				<label class="dont-show">
					<input type="checkbox" bind:checked={dontShowAgain} />
					<span>{$t('dontShowAgain')}</span>
				</label>
				<button on:click={handleSubmit}>
					<i class="hsr-bulb"></i>
					<span> {$t('loadSimulator')} </span>
				</button>
			</div>
		</div>
	</div>
</div>

<style>
	.welcome {
		position: fixed;
		z-index: +110;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		display: flex;
		justify-content: center;
		align-items: center;
		background-color: rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(10px);
	}

	.header {
		padding: 3% 5%;
	}

	.container {
		max-width: 90%;
		width: 600px;
		position: relative;
	}
	:global(.mobileLandscape) .container {
		min-width: 400px;
		width: 50%;
	}

	.wrapper {
		color: #000;
		background-color: rgba(255, 255, 255, 0.8);
		text-align: center;
		backdrop-filter: blur(10px);
		border-top-right-radius: 5vh;
		position: relative;
		z-index: 2;
	}

	.container::before {
		content: '';
		position: absolute;
		left: 0;
		bottom: 0;
		width: 100%;
		height: 100%;
		border: 2px solid var(--color-second);
		mask-image: linear-gradient(45deg, black 50%, transparent 80%);
		transform: translate(-1.5%, 3%);
		opacity: 0.35;
	}

	h1 {
		font-size: 200%;
		color: rgb(207, 137, 7);
		padding: 0 2% 3%;
		border-bottom: 1px solid #ccc;
	}
	h2 {
		font-size: 120%;
		padding: 2%;
		font-weight: normal;
	}

	.footer {
		background-color: rgba(0, 0, 0, 0.85);
		padding: 3%;
	}
	button {
		white-space: nowrap;
		background-color: rgba(255, 255, 255, 0.85);
		border-radius: 2rem;
		padding: 2.5% 10%;
		text-transform: uppercase;
		display: inline-block;
		line-height: 100%;
		position: relative;
		transition: all 0.2s;
	}
	button::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		height: 80%;
		width: 96%;
		border: 1px solid #bbb;
		border-radius: 3rem;
	}

	button:not(:disabled):active {
		opacity: 0.5;
		transform: scale(0.95);
	}

	button i {
		transform: translateX(-50%);
		color: var(--color-second);
		aspect-ratio: 1/1;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		position: relative;
		font-size: 85%;
	}
	button i::after {
		content: '';
		width: 200%;
		aspect-ratio: 1/1;
		background-color: rgba(0, 0, 0, 0.85);
		border: 1px solid var(--color-second);
		border-radius: 100%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		z-index: -1;
	}

	button span {
		display: inline-block;
		transform: translateX(6%);
	}

	/* Logs Container  */
	.updates {
		text-align: left;
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		background-color: #fff;
		font-size: 0.97rem;
		max-height: calc(0.15 * var(--screen-height));
		padding: 0 1rem;
		display: block;
		overflow: auto;
	}
	.updates span {
		font-weight: bold;
		color: #f7cf33;
		display: block;
		padding-top: 0.5rem;
	}
	.updates .tgl {
		color: #bd6932;
	}

	.updates p {
		padding-left: 1rem;
		position: relative;
		line-height: 1rem;
		margin: 0.5rem 0;
	}
	.updates p::before {
		content: '*';
		display: inline-block;
		width: 10px;
		line-height: 0;
		font-size: 1.3rem;
		padding-top: 0.5rem;
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
	}

	.adExpired {
		text-align: center;
		font-size: 125%;
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 1rem;
	}

	.intro {
		color: rgba(255, 255, 255, 0.7);
		font-size: 88%;
		line-height: 160%;
		text-align: left;
		padding: 2% 4% 0;
	}

	.dont-show {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: rgba(255, 255, 255, 0.75);
		font-size: 85%;
		padding-bottom: 2%;
		cursor: pointer;
		user-select: none;
	}

	.dont-show input {
		width: 0.9rem;
		height: 0.9rem;
		accent-color: #e3a023;
		cursor: pointer;
	}
</style>
