import { Howl, Howler } from 'howler';
import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';
import { cookie } from '$lib/helpers/dataAPI/api-cookie';
import { browser } from '$app/environment';

const sfxList = [
	'allbanner',
	'balance-click',
	'camera',
	'click',
	'click2',
	'close',
	'collection-close',
	'collection-open',
	'express-3star',
	'express-4star',
	'express-5star',
	'item-obtained',
	'modal-close',
	'paper-flip',
	'reveal-3star',
	'reveal-4star',
	'reveal-5star',
	'setting-click',
	'setting-close',
	'setting-loaded',
	'setting-item',
	'setting-item-option',
	'shop-item-select',
	'shop-open',
	'switch-banner',
	'sidebar-click',
	'warp-backsound',
	'warpresult-close',
	'warpresult-list-4',
	'warpresult-list-5'
];

const isMuted = () => {
	let sounds = localConfig.get('mutedSounds');
	const { sfx = false } = typeof sounds === 'object' ? sounds : {};
	return sfx;
};

let sounds = {};

const initSFX = () => {
	if (!browser) return;
	sounds = sfxList.reduce((prev, current) => {
		const sfx = prev || {};
		sfx[current] = new Howl({
			src: [`/audiofx/${current}.ogg`],
			loop: current === 'warp-backsound'
			// onfade: fadeTrack
		});
		return sfx;
	}, {});
};
initSFX();

// 壳环境（WebView2）AudioContext 的解锁时机比浏览器更不可靠。howler 官方 autoUnlock
// 默认已开启（源码 self.autoUnlock = true），无需重复设置；这里只加一层首次手势兜底：
// 仅当 ctx 仍为 suspended 时 resume，幂等、无副作用。
if (browser) {
	const unlock = () => {
		if (Howler.ctx?.state === 'suspended') Howler.ctx.resume();
		document.removeEventListener('pointerdown', unlock, true);
		document.removeEventListener('mousedown', unlock, true);
		document.removeEventListener('keydown', unlock, true);
	};
	document.addEventListener('pointerdown', unlock, true);
	document.addEventListener('mousedown', unlock, true);
	document.addEventListener('keydown', unlock, true);
}

const sfxids = {};
export const playSfx = (nameOfSoundfx = 'click') => {
	try {
		if (!sounds[nameOfSoundfx]) throw new Error('No Sound effect for ' + nameOfSoundfx);
		if (isMuted()) return;
		sfxids[nameOfSoundfx] = sounds[nameOfSoundfx].play();

		if (nameOfSoundfx === 'warp-backsound') {
			const volume = cookie.get('sfxVolume') || 1;
			sounds[nameOfSoundfx].fade(0, volume, 1000, sfxids[nameOfSoundfx]);
		}
	} catch (e) {
		console.error('Unable to Play Sfx : ', e.message);
	}
};

export const stopSfx = (nameOfSoundfx = 'click') => {
	try {
		if (isMuted()) return;
		if (!sounds[nameOfSoundfx]) throw new Error('No Sound effect for ' + nameOfSoundfx);

		// const volume = cookie.get('sfxVolume') || 1;
		// sounds[nameOfSoundfx].fade(volume, 0, 1000, sfxids[nameOfSoundfx]);
		sounds[nameOfSoundfx].stop();
	} catch (e) {
		console.error('Unable to Stop Sfx : ', e.message);
	}
};

export const setSfxVolume = (val) => {
	const volumeVal = val / 100;
	cookie.set('sfxVolume', volumeVal);
	Object.keys(sounds).forEach((key) => sounds[key]?.volume(volumeVal));
};
