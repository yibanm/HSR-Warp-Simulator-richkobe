// 本地错误处理：不接任何外部上报服务，错误只留在用户浏览器内。
// 上游原版在此初始化 Sentry 并向作者私服上报（含 sendDefaultPii），已按隐私要求移除。
const errorhandler = async (error) => {
	const errorId = crypto.randomUUID();
	return { ...error, errorId };
};

export const handleError = errorhandler;
