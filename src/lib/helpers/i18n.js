import { browser } from '$app/environment';
import { init, register } from 'svelte-i18n';
import { localConfig } from '$lib/helpers/dataAPI/api-localstorage';

const supportedLocales = ['en-US', 'id-ID', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ru-RU'];
const itemLocales = ['en-US', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'ru-RU'];

// 默认语言钉死为简体中文：首屏即中文，不再跟随浏览器语言（用户要求「开始就是汉化状态，静态」）
const DEFAULT_LOCALE = 'zh-CN';

const checkLocale = () => {
	const savedLocale = browser ? localConfig.get('locale') : null;
	// 用户手动切换过语言则沿用其选择；否则一律静态中文
	if (savedLocale && supportedLocales.includes(savedLocale)) return savedLocale;
	return DEFAULT_LOCALE;
};

const mountLocale = () => {
	supportedLocales.forEach((langID) => {
		register(langID, () => import(`../../locales/${langID}.json`));
	});

	itemLocales.forEach((langID) => {
		register(langID, () => import(`../../locales/items/${langID}.json`));
	});

	const usedLocale = checkLocale();
	init({
		fallbackLocale: 'en-US',
		initialLocale: usedLocale
	});
};

export { mountLocale, checkLocale };
