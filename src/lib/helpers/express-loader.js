import { assets } from '$lib/stores/app-store';
import { writable } from 'svelte/store';

const expressList = [
	'regular-3star.mp4',
	'regular-4star.mp4',
	'regular-5star.mp4',
	'event-3star.mp4',
	'event-4star.mp4',
	'event-5star.mp4'
];

/**
 * 跃迁动画视频直接读包内静态资源，不再经 IndexedDB 缓存。
 *
 * 2026-11-07 起数据层全面改明文文件存储；视频属应用资源而非用户数据，
 * 留在包内即可（IDB 缓存曾出现 blob 底层文件丢失导致抽卡按钮永久 disabled，
 * 去掉缓存层该故障自然消失）。check 改为 HEAD 探测六个资源是否可读。
 */
export const check = async () => {
	const results = await Promise.all(
		expressList.map(async (key) => {
			try {
				const r = await fetch(`/videos/${key}`, { method: 'HEAD' });
				return r.ok;
			} catch {
				return false;
			}
		})
	);
	const allComplete = results.every(Boolean);
	if (allComplete) {
		assets.update((v) => {
			expressList.forEach((key) => (v[key] = `/videos/${key}`));
			return v;
		});
	}
	return allComplete;
};

export const loadProggress = writable({ item: '', progress: 0, totalItem: 0, itemNumber: 0 });

export const loadAnimation = async () => {
	const results = [];
	const totalItem = expressList.length;
	for (let i = 0; i < totalItem; i++) {
		loadProggress.set({ item: expressList[i], progress: 0, totalItem, itemIndex: i });
		const response = await fetch(`/videos/${expressList[i]}`);
		const data = new Response(streamResponse(response));
		const blob = await data.blob();

		const DOMURL = window.URL || window.webkitURL;
		const blobUrl = DOMURL.createObjectURL(blob);
		const resultObj = { asset: expressList[i], url: blobUrl };
		results.push(resultObj);
	}

	return results;
};

const streamResponse = (response) => {
	const contentLength = response.headers.get('content-length');
	return new ReadableStream({
		start(controller) {
			const reader = response.body.getReader();
			readStream(controller, reader, contentLength);
		}
	});
};

let loaded = 0;
const readStream = (controller, reader, contentLength) => {
	reader.read().then((progressEvent) => {
		if (progressEvent.done) {
			controller.close();
			loaded = 0;
			return;
		}

		loadProggress.update((v) => {
			loaded += progressEvent.value.byteLength;
			v.progress = Math.round((loaded / contentLength) * 100);
			return v;
		});
		controller.enqueue(progressEvent.value);
		readStream(controller, reader, contentLength);
	});
};
