import path from 'path';
import fs from 'fs';
import { defineConfig } from 'vite';
import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { imagetools } from 'vite-imagetools';
import { VitePWA } from 'vite-plugin-pwa';
import { plugin as MdPlugin } from 'vite-plugin-markdown';

const iconSize = [32, 72, 96, 128, 144, 152, 192, 256, 384, 512];
const icons = iconSize.map((size) => {
	const iconObj = {
		src: `./icons/icon-${size}x${size}.png`,
		sizes: `${size}x${size}`,
		type: 'image/png'
	};
	if (size === 72) iconObj.purpose = 'maskable';
	if (size === 192) iconObj.purpose = 'any';
	return iconObj;
});

const manifest = {
	orientation: 'landscape',
	name: '崩坏：星穹铁道 跃迁模拟器（点名版）',
	short_name: '星铁点名版',
	description: '崩坏：星穹铁道抽卡模拟器中文点名版：完全本地运行、无需联网、不收集任何个人信息。',
	theme_color: '#000000',
	background_color: '#000000',
	scope: '/',
	start_url: '/?pwasc=hsr-homescreen',
	id: 'hsr-warp-simulator-richkobe',
	categories: ['games', 'utilities'],
	dir: 'auto',
	display: 'fullscreen',
	icons,
	launch_handler: {
		client_mode: ['focus-existing, auto']
	},
	display_override: [
		'fullscreen',
		'window-controls-overlay',
		'standalone',
		'minimal-ui',
		'browser'
	],
	edge_side_panel: {
		preferred_width: 412
	}
};

export default defineConfig({
	// 版本号构建期注入为字面量（关于页显示）。不能 import package.json：
	// Vite dev server 对 /package.json?import 返回 403（fs 保护），实测菜单整页加载失败。
	define: {
		__APP_VERSION__: JSON.stringify(
			JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')).version
		)
	},
	plugins: [
		imagetools({}),
		sveltekit(),
		devtoolsJson(),
		MdPlugin({ mode: 'html' }),
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.js',
			registerType: 'prompt',
			manifestFilename: 'appmanifest.json',
			manifest
		})
	],
	resolve: {
		alias: {
			$post: path.resolve(__dirname, './src/post'),
			'@images': path.resolve(__dirname, './src/images')
		}
	},
	build: {
		chunkSizeWarningLimit: 350,
		// sourcemap: true,
		target: ['es2020']
	}
});
