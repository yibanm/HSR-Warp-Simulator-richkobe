// 原实现直接用 btoa/atob，只能处理 Latin1 字符。
// 点名结果的 name 是中文，btoa 会抛 InvalidCharacterError 并中断结果页整次重渲染，
// 表现为「状态已清但 DOM 留在屏幕上、点 X 关不掉」（2026-11-06 壳内 CDP 实测定位）。
// 改为 UTF-8 安全编码：先 encodeURIComponent 再 btoa（与 26.GenshinWishRoll 同一方案）。
// 旧链接内容是纯 ASCII，encodeURIComponent 对其无影响，因此向后兼容。
const utf8ToBase64 = (str) => window.btoa(encodeURIComponent(str));
const base64ToUtf8 = (encoded) => decodeURIComponent(window.atob(encoded));

const encodeAndMakeLink = (string, path = 'item') => {
	const encoded = utf8ToBase64(string);
	const link = `${window.location.origin}/screen/${path}?a=${encoded}`;
	return link;
};

export const decodeAndReadData = {
	_read(decoded) {
		let [name, eidolon, undyingType, undyingQty, type, isNew] = decoded.split(',');
		eidolon = !!parseInt(eidolon);
		undyingQty = parseInt(undyingQty);
		isNew = !!parseInt(isNew);
		return { name, eidolon, undyingType, undyingQty, type, isNew };
	},

	single(encoded) {
		return this._read(base64ToUtf8(encoded));
	},

	multi(encoded) {
		const arrData = base64ToUtf8(encoded).split('|');
		return arrData.map(this._read);
	}
};

const encodeData = {
	_createStringData(data) {
		const { name, eidolon, undyingType, undyingQty, type, isNew } = data;
		const string = `${name},${+!!eidolon},${undyingType},${undyingQty},${type},${+!!isNew}`;
		return string;
	},

	single(data) {
		const stringData = this._createStringData(data[0]);
		return encodeAndMakeLink(stringData);
	},

	multi(data) {
		const arrayDataStr = data.map(this._createStringData);
		const stringData = arrayDataStr.join('|');
		return encodeAndMakeLink(stringData, 'warplist');
	}
};

export const createLink = (data = []) => {
	if (data.length > 1) return encodeData.multi(data);
	return encodeData.single(data);
};
