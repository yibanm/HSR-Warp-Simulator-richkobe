<script>
	import { getContext } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { locale, t } from 'svelte-i18n';

	import { warpAmount, autoskip, liteMode, muted } from '$lib/stores/app-store';
	import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';
	import { check as expressChecker } from '$lib/helpers/express-loader';

	import Scrollable from '$lib/components/Scrollable.svelte';
	import OptionsItem from './_settings-option.svelte';
	import { pushToast } from '$lib/stores/toast';
	import {
		exportAllData,
		exportFileName,
		importAllData,
		pickZipFile,
		saveDataBlob
	} from '$lib/helpers/dataAPI/data-transfer';

	export let activeOption;

	// ---- 数据导入导出（用户 2026-11-07 要求：明文压缩包，含所有数据）----
	let transferring = false;

	const handleExport = async () => {
		if (transferring) return;
		transferring = true;
		try {
			const blob = await exportAllData();
			const r = await saveDataBlob(blob, exportFileName());
			if (r.status === 'saved') {
				pushToast({
					message: r.path ? `已导出到：${r.path}` : '数据已导出为压缩包',
					type: 'success'
				});
			} else if (r.status === 'failed') {
				pushToast({ message: '导出失败，请重试', type: 'error' });
			}
		} catch (e) {
			console.error('导出失败：', e);
			pushToast({ message: '导出失败：' + (e?.message || e), type: 'error' });
		} finally {
			transferring = false;
		}
	};

	const handleImport = async () => {
		if (transferring) return;
		transferring = true;
		try {
			const blob = await pickZipFile();
			if (!blob) return;
			const n = await importAllData(blob);
			if (!n) {
				pushToast({ message: '压缩包内没有可导入的数据文件', type: 'error' });
				return;
			}
			pushToast({ message: `已导入 ${n} 个数据文件，即将重新加载`, type: 'success' });
			// 内存缓存需重读：刷新页面是最稳的重载方式
			setTimeout(() => window.location.reload(), 1200);
		} catch (e) {
			console.error('导入失败：', e);
			pushToast({ message: '导入失败：' + (e?.message || e), type: 'error' });
		} finally {
			transferring = false;
		}
	};

	// Lite Mode
	const handleLiteMode = ({ detail }) => {
		const { selected } = detail;
		const isLitemode = selected === 'yes';
		liteMode.set(isLitemode);
		localConfig.set('litemode', isLitemode);
	};

	// Warp Number
	const handleSelectAmount = ({ detail }) => {
		const { selected } = detail;
		localConfig.set('warpAmount', selected);
		warpAmount.set(selected);
	};

	// AutoSkip
	const readyToPull = getContext('readyToPull');
	const handleAutoSkip = async ({ detail }) => {
		const { selected } = detail;
		const isAutoSkip = selected === 'yes';
		localConfig.set('autoskip', { express: isAutoSkip, art: $autoskip.art });
		autoskip.update((v) => ({ ...v, express: isAutoSkip }));
		if (isAutoSkip) return readyToPull.set(true);

		// Check express animation if animation turned ON
		const cekExpress = await expressChecker();
		readyToPull.set(cekExpress);
	};

	const handleAutoSkipArt = ({ detail }) => {
		const { selected } = detail;
		const isAutoSkip = selected === 'yes';
		autoskip.set({ art: isAutoSkip, express: true });
		localConfig.set('autoskip', { express: true, art: isAutoSkip });
	};

	// 音效静音（BGM 随留声机功能一并移除，此处只管音效）
	const handleSound = ({ detail }) => {
		const { selected } = detail;
		const isMuted = selected === 'yes';

		muted.update((v) => {
			v.sfx = isMuted;
			return v;
		});
		localConfig.set('mutedSounds', { sfx: isMuted });
	};
</script>

<div class="settings" in:fade={{ duration: 250 }}>
	<Scrollable>
		<!-- General -->
		<!-- <h2>{$t('menu.other')}</h2> -->
		<OptionsItem
			optionName="locale"
			activeIndicator={$locale}
			showOption={activeOption === 'locale'}
		>
			{$t('menu.language')}
		</OptionsItem>

		<OptionsItem
			showOption={activeOption === 'warpnumber'}
			optionName="warpnumber"
			activeIndicator={$warpAmount}
			on:select={handleSelectAmount}
		>
			{$t('menu.warpNumber')}
		</OptionsItem>

		<OptionsItem optionName="switchbanner">
			{$t('menu.switchbanner')}
		</OptionsItem>

		<OptionsItem optionName="reset">{$t('menu.clearStorage')}</OptionsItem>

		<!-- Visual -->
		<h2>{$t('menu.visual')}</h2>
		<OptionsItem
			showOption={activeOption === 'autoskip'}
			optionName="autoskip"
			activeIndicator={$autoskip.express}
			on:select={handleAutoSkip}
		>
			{$t('menu.autoskip')}
		</OptionsItem>
		{#if $autoskip.express}
			<div transition:fly|local={{ y: -10 }}>
				<OptionsItem
					sub
					optionName="skipSplashArt"
					showOption={activeOption === 'skipSplashArt'}
					activeIndicator={$autoskip.art}
					on:select={handleAutoSkipArt}
				>
					{$t('menu.skipSplashArt')}
				</OptionsItem>
			</div>
		{/if}

		<OptionsItem
			showOption={activeOption === 'litemode'}
			optionName="litemode"
			activeIndicator={$liteMode}
			on:select={handleLiteMode}
		>
			{$t('menu.litemode')}
		</OptionsItem>

		<!-- AUDIO -->
		<h2>{$t('menu.sound')}</h2>
		<OptionsItem
			showOption={activeOption === 'muteSFX'}
			optionName="muteSFX"
			activeIndicator={$muted.sfx}
			on:select={handleSound}
			>{$t('menu.mutedSFX')}
		</OptionsItem>

		{#if !$muted.sfx}
			<div transition:fly|local={{ y: -10 }}>
				<OptionsItem sub optionName="sfxVolume" mode="slider">
					{$t('menu.sfxVolume')}
				</OptionsItem>
			</div>
		{/if}

		<!-- 数据导入导出：明文压缩包，含设置/抽卡记录/保底/名单/头像全部数据 -->
		<h2>数据导入导出</h2>
		<p class="transfer-hint">
			导出为明文压缩包（zip），内含全部数据文件，解压可直接查看；导入会用包内数据覆盖当前数据并重新加载。
		</p>
		<div class="transfer-btns">
			<button type="button" class="transfer-btn" disabled={transferring} on:click={handleExport}>
				<i class="hsr-download"></i> 导出数据
			</button>
			<button type="button" class="transfer-btn" disabled={transferring} on:click={handleImport}>
				<i class="hsr-save"></i> 导入数据
			</button>
		</div>
	</Scrollable>
</div>

<style>
	.settings {
		width: 100%;
	}

	h2 {
		padding: 0.3rem 0;
		margin-top: 1.5rem;
		font-size: 130%;
	}

	h2:first-child {
		margin-top: 0;
	}

	.transfer-hint {
		font-size: 0.8rem;
		opacity: 0.75;
		line-height: 1.6;
		margin: 0 0 0.6rem;
	}

	.transfer-btns {
		display: flex;
		gap: 0.8rem;
		flex-wrap: wrap;
	}

	.transfer-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 1.1rem;
		border-radius: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.35);
		background-color: rgba(255, 255, 255, 0.12);
		color: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.transfer-btn:hover:not(:disabled) {
		background-color: rgba(255, 255, 255, 0.22);
	}

	.transfer-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
