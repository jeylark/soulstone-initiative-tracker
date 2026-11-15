import { getConfig, waitFor, within } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TRUNCATION_NOTICE = '[Testing Library output truncated]';

function createLargeContainer(): HTMLElement {
	const container = document.createElement('div');
	container.innerHTML = Array.from(
		Array(60).keys(),
		(index) => `<button>Available action ${index}</button>`
	).join('');
	return container;
}

function getMissingRoleError(): Error {
	try {
		within(createLargeContainer()).getByRole('heading', { name: 'Missing heading' });
		throw new Error('Expected the query to fail');
	} catch (error) {
		if (!(error instanceof Error)) throw error;
		return error;
	}
}

beforeEach(() => {
	vi.stubEnv('TEST_ERROR_PRINT_LIMIT', '');
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('Testing Library error output', () => {
	it('preserves short errors', () => {
		const container = document.createElement('div');
		const error = getConfig().getElementError('Short failure', container);

		expect(error.name).toBe('TestingLibraryElementError');
		expect(error.message).toContain('Short failure');
		expect(error.message).toContain('<div');
		expect(error.message).not.toContain(TRUNCATION_NOTICE);
	});

	it('limits missing-role diagnostics to 500 characters', () => {
		const error = getMissingRoleError();

		expect(error.name).toBe('TestingLibraryElementError');
		expect(error.message).toContain('Missing heading');
		expect(error.message).toHaveLength(500);
		expect(error.message.endsWith(TRUNCATION_NOTICE)).toBe(true);
	});

	it('limits multiple-match diagnostics', () => {
		const container = createLargeContainer();
		let error: unknown;
		try {
			within(container).getByRole('button');
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('Found multiple elements');
		expect((error as Error).message.length).toBeLessThanOrEqual(500);
		expect((error as Error).message.endsWith(TRUNCATION_NOTICE)).toBe(true);
	});

	it('limits async timeout diagnostics without repeating the notice', async () => {
		const container = createLargeContainer();
		let error: unknown;
		try {
			await waitFor(() => within(container).getByText('Missing text'), {
				container,
				timeout: 20,
				interval: 5
			});
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).name).toBe('TestingLibraryElementError');
		expect((error as Error).message).toContain('Missing text');
		expect((error as Error).message.length).toBeLessThanOrEqual(500);
		expect((error as Error).message.split(TRUNCATION_NOTICE)).toHaveLength(2);
	});

	it('limits failed async role queries', async () => {
		const container = createLargeContainer();
		let error: unknown;
		try {
			await within(container).findByRole('heading', { name: 'Missing heading' }, { timeout: 20 });
		} catch (caught) {
			error = caught;
		}

		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain('Missing heading');
		expect((error as Error).message.length).toBeLessThanOrEqual(500);
		expect((error as Error).message.split(TRUNCATION_NOTICE)).toHaveLength(2);
	});

	it('accepts a larger per-run limit', () => {
		vi.stubEnv('TEST_ERROR_PRINT_LIMIT', '2000');
		const error = getMissingRoleError();

		expect(error.message).toHaveLength(2000);
		expect(error.message.endsWith(TRUNCATION_NOTICE)).toBe(true);
	});

	it.each(['invalid', '0', '-1', '1.5'])('uses the default for invalid limit %s', (limit) => {
		vi.stubEnv('TEST_ERROR_PRINT_LIMIT', limit);
		expect(getMissingRoleError().message).toHaveLength(500);
	});
});
