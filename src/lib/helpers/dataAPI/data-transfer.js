/**
 * 数据导入导出（设置页「数据导入导出」栏，用户 2026-11-07 要求）。
 *
 * 导出：遍历数据根全部文件 → JSZip 打包（zip 内为明文原文件，解压即可看）→
 *   桌面壳 showSaveFilePicker 选位置写盘；安卓走 MediaSaver 存系统下载目录；
 *   浏览器回退 file-saver。
 * 导入：选 zip → 解包 → 逐文件覆盖写回数据根 → 刷新页面让内存缓存重读。
 *   只接受 zip 内路径落在白名单子目录（config/gacha/rollcall）的条目，
 *   防恶意 zip 的路径穿越写坏其它文件。
 */
import JSZip from 'jszip';
import { fileStore } from './file-store';

const ALLOWED_PREFIX = ['config/', 'gacha/', 'rollcall/'];
const inScope = (rel) => ALLOWED_PREFIX.some((p) => rel.startsWith(p)) && !rel.includes('..');

/** 导出全部数据为 zip Blob */
export const exportAllData = async () => {
	const files = await fileStore.listAll();
	const zip = new JSZip();
	for (const rel of files) {
		if (!inScope(rel)) continue;
		const u8 = await fileStore.readBytes(rel);
		zip.file(rel, u8);
	}
	const manifest = {
		app: 'hsr-warp-roll-richkobe',
		exportedAt: new Date().toISOString(),
		files: files.filter(inScope)
	};
	zip.file('manifest.json', JSON.stringify(manifest, null, 2));
	return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
};

/** 从 zip Blob 导入并覆盖数据；返回写入的文件数 */
export const importAllData = async (blob) => {
	const zip = await JSZip.loadAsync(blob);
	let written = 0;
	for (const [rel, entry] of Object.entries(zip.files)) {
		if (entry.dir || !inScope(rel)) continue;
		const u8 = await entry.async('uint8array');
		await fileStore.writeBytes(rel, u8);
		written++;
	}
	return written;
};

/** 导出文件名：带时间戳，不含 Windows 非法字符 */
export const exportFileName = () => {
	const d = new Date();
	const p = (n) => String(n).padStart(2, '0');
	return `hsr-warp-roll-数据备份-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(
		d.getHours()
	)}${p(d.getMinutes())}${p(d.getSeconds())}.zip`;
};

/**
 * Tauri 壳内保存：官方 dialog 插件弹原生保存框（用户自选位置），fs 插件写盘。
 * WebView2 下 showSaveFilePicker 存在但不弹框（2026-11-07 实测），不可用。
 * @returns {Promise<{status:'saved'|'canceled'|'failed', path?:string}>}
 */
const saveViaTauriDialog = async (blob, filename) => {
	try {
		const { save } = await import('@tauri-apps/plugin-dialog');
		const { writeFile } = await import('@tauri-apps/plugin-fs');
		const ext = (filename.split('.').pop() || 'zip').toLowerCase();
		const desc = { zip: 'ZIP 压缩包', png: 'PNG 图片', jpg: 'JPEG 图片' }[ext] || ext.toUpperCase();
		const path = await save({ defaultPath: filename, filters: [{ name: desc, extensions: [ext] }] });
		if (!path) return { status: 'canceled' };
		const u8 = new Uint8Array(await blob.arrayBuffer());
		await writeFile(path, u8);
		return { status: 'saved', path };
	} catch (e) {
		console.error('Tauri 保存失败：', e);
		return { status: 'failed' };
	}
};

/**
 * 把备份 zip 交给用户：桌面壳弹原生保存框由用户选位置，安卓直存系统下载目录
 * （安卓不允许应用写任意公共路径，下载目录是用户文件管理器默认可见的位置），
 * 浏览器回退下载。
 * @returns {Promise<{status:'saved'|'canceled'|'failed', path?:string}>}
 *   path 为实际落盘路径，供提示用户去哪找
 */
export const saveDataBlob = async (blob, filename) => {
	if (window.__TAURI_INTERNALS__) return saveViaTauriDialog(blob, filename);
	if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.getPlatform?.() === 'android') {
		try {
			const { registerPlugin } = await import('@capacitor/core');
			const saver = registerPlugin('MediaSaver');
			const b64 = await new Promise((res, rej) => {
				const r = new FileReader();
				r.onload = () => res(String(r.result).split(',')[1] || '');
				r.onerror = () => rej(r.error);
				r.readAsDataURL(blob);
			});
			const out = await saver.saveToDownloads({
				name: filename,
				mime: 'application/zip',
				base64: b64
			});
			return out?.path ? { status: 'saved', path: out.path } : { status: 'failed' };
		} catch (e) {
			console.error('安卓保存备份失败：', e);
			return { status: 'failed' };
		}
	}
	try {
		const { saveAs } = await import('file-saver');
		saveAs(blob, filename);
		return { status: 'saved' };
	} catch (e) {
		return { status: 'failed' };
	}
};

/**
 * 让用户选一个 zip 文件并回调其 Blob。用隐藏 file input（各平台 WebView 均支持），
 * 必须由真实点击触发（无 user gesture 时 fileChooser 不弹）。
 */
export const pickZipFile = () =>
	new Promise((resolve) => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.zip,application/zip';
		input.style.display = 'none';
		const done = (v) => {
			input.remove();
			resolve(v);
		};
		input.onchange = async () => {
			const f = input.files?.[0];
			if (!f) return done(null);
			done(await f.arrayBuffer().then((b) => new Blob([b], { type: 'application/zip' })));
		};
		// 用户取消选择框时 change 不触发：监听 window focus 兜底超时
		document.body.appendChild(input);
		input.click();
		setTimeout(() => {
			if (input.isConnected && !input.files?.length) done(null);
		}, 120000);
	});
