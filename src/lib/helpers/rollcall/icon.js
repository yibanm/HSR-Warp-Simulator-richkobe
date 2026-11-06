import { getIconBlob } from '../dataAPI/api-rollcall';

/**
 * 把点名结果的图标解析成可直接给 <img src> 用的地址。
 *
 * 预置角色/光锥名单已全部删除（与原神版 v1.0.1 一致，经用户裁定），
 * 图标只剩一种来源：用户为自建名单条目导入的图片，
 * 存于 IndexedDB 的 blob，需转成 objectURL。
 *
 * blob → objectURL 是异步的，且每次转换都会占用内存，
 * 因此按 iconKey 缓存，同一个图标只创建一次。
 */

const urlCache = new Map();

/**
 * @param {Array} results drawMembers 的结果数组
 * @returns {Promise<Array>} 每条补上 iconUrl 字段（无导入图标则为 null，UI 走首字兜底）
 */
export const attachIconUrls = async (results) => {
	const withIcon = await Promise.all(
		results.map(async (item) => {
			if (!item.iconKey) return { ...item, iconUrl: null };
			let url = urlCache.get(item.iconKey);
			if (!url) {
				try {
					const blob = await getIconBlob(item.iconKey);
					if (blob) {
						url = URL.createObjectURL(blob);
						urlCache.set(item.iconKey, url);
					}
				} catch (e) {
					console.error('读取点名图标失败：', e);
				}
			}
			return { ...item, iconUrl: url || null };
		})
	);

	return withIcon;
};
