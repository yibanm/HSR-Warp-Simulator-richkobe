// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface Platform {}
	}
}

// vite.config.js define 注入的构建期版本号字面量（关于页显示）
declare const __APP_VERSION__: string;

export {};
