import { configure } from '@testing-library/svelte';

const DEFAULT_ERROR_PRINT_LIMIT = 500;
const TRUNCATION_NOTICE = '[Testing Library output truncated]';

configure(({ getElementError }) => ({
	getElementError(message, container) {
		const configuredLimit = Number(process.env.TEST_ERROR_PRINT_LIMIT);
		const limit =
			Number.isSafeInteger(configuredLimit) && configuredLimit > 0
				? configuredLimit
				: DEFAULT_ERROR_PRINT_LIMIT;
		const error = getElementError(message, container);

		if (message?.endsWith(TRUNCATION_NOTICE)) {
			error.message = message;
		} else if (error.message.length > limit) {
			const notice = TRUNCATION_NOTICE.slice(0, limit);
			error.message = error.message.slice(0, limit - notice.length) + notice;
		}

		return error;
	}
}));
