import { writable } from 'svelte/store';

/**
 * 全局轻提示（中文点名版新增）
 *
 * 上游 HSR 的 Toast.svelte 依赖 `getContext('closeToast')`，只能由各页面自己维护
 * showToast 局部状态（如 _screenshot-result.svelte / _select-banner.svelte 各写一份），
 * 没有全局通道。点名功能需要在名单管理页、编辑器、抽卡入口等多处弹提示，
 * 逐个自建局部状态会重复且易漏关闭，因此在这里提供一个全局 store。
 *
 * 用法：`pushToast({ message, type })`；渲染端在 +layout.svelte 订阅本 store，
 * 并 setContext('closeToast', closeToast) 供 Toast.svelte 关闭。
 */

/** 当前提示内容：{ message, type } 或 null（无提示） */
export const toast = writable(null);

let timer;

/**
 * 弹一条提示，到时自动消失。
 * @param {{message: string, type?: ''|'error'|'success'}} payload
 * @param {number} duration 自动关闭毫秒数，默认 2500
 */
export const pushToast = ({ message, type = '' }, duration = 2500) => {
	if (!message) return;
	toast.set({ message, type });
	// 连续弹提示时重设计时器，避免后一条被前一条的定时器提前关掉
	clearTimeout(timer);
	timer = setTimeout(() => toast.set(null), duration);
};

/** 立即关闭提示（Toast.svelte 的点击关闭与 autoclose 都走它） */
export const closeToast = () => {
	clearTimeout(timer);
	toast.set(null);
};
