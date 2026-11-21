import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ButtonGroup from './ButtonGroup.svelte';

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

const children = createRawSnippet(() => ({
	render: () => `
		<div style="display: contents">
		<div class="button-group-item" data-sizing-labels='["Continue checking status"]'>
			<a class="ui-button" href="/next" aria-describedby="link-warning">Continue</a>
			<p id="link-warning" role="status">Check this first.</p>
		</div>
		<div class="button-group-item">
			<button class="ui-button" type="button" aria-describedby="button-error">Save</button>
			<p id="button-error" role="alert">Cannot save.</p>
		</div>
		</div>`
}));

describe('ButtonGroup', () => {
	it('keeps mixed controls and their feedback in a neutral horizontal group', () => {
		render(ButtonGroup, { children });

		const link = screen.getByRole('link', { name: 'Continue' });
		const button = screen.getByRole('button', { name: 'Save' });
		const group = link.closest('.button-group');
		expect(group).toBe(button.closest('.button-group'));
		expect(group?.classList.contains('button-group--horizontal')).toBe(true);
		expect(group?.hasAttribute('role')).toBe(false);
		expect(link.getAttribute('aria-describedby')).toBe(screen.getByRole('status').id);
		expect(button.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
	});

	it('supports vertical layout, full-width sizing and a caller-owned class', () => {
		render(ButtonGroup, {
			children,
			orientation: 'vertical',
			isFullWidth: true,
			class: 'custom-group'
		});

		const group = screen.getByRole('button', { name: 'Save' }).closest('.button-group');
		expect(group?.classList.contains('button-group--vertical')).toBe(true);
		expect(group?.classList.contains('button-group--full-width')).toBe(true);
		expect(group?.classList.contains('custom-group')).toBe(true);
	});

	it('reserves alternate labels, keeps sizes through interaction and recalculates on viewport resize', () => {
		let availableWidth = 500;
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => availableWidth);
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: {
			readonly textContent: string | null;
			readonly style: { readonly width: string };
		}) {
			const naturalWidth = (this.textContent?.length ?? 0) * 10 + 20;
			const width = this.style.width.endsWith('px')
				? Number.parseFloat(this.style.width)
				: naturalWidth;
			const height = 30 + Math.ceil((naturalWidth - 20) / Math.max(1, width - 20)) * 10;
			return { width, height } as DOMRect;
		});

		render(ButtonGroup, { children });
		const link = screen.getByRole('link', { name: 'Continue' });
		const group = link.closest<HTMLElement>('.button-group');
		expect(group?.style.getPropertyValue('--button-group-natural-width')).toBe('260px');
		expect(group?.style.getPropertyValue('--button-group-button-height')).toBe('40px');

		link.textContent = 'Changed';
		link.closest('.button-group-item')?.remove();
		expect(group?.style.getPropertyValue('--button-group-natural-width')).toBe('260px');
		expect(group?.style.getPropertyValue('--button-group-button-height')).toBe('40px');

		availableWidth = 120;
		window.dispatchEvent(new Event('resize'));
		expect(group?.style.getPropertyValue('--button-group-natural-width')).toBe('260px');
		expect(group?.style.getPropertyValue('--button-group-button-height')).toBe('60px');
		expect(group?.style.getPropertyValue('--button-group-columns')).toBe('1');
		expect(screen.queryByText('Continue checking status')).toBeNull();
	});

	it.each([
		{ orientation: 'horizontal', columns: '2', targetWidth: '528px' },
		{ orientation: 'vertical', columns: '1', targetWidth: '260px' }
	] as const)(
		'uses equal tracks in $orientation full-width mode',
		({ orientation, columns, targetWidth }) => {
			vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
			vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: {
				readonly textContent: string | null;
			}) {
				return { width: (this.textContent?.length ?? 0) * 10 + 20, height: 40 } as DOMRect;
			});
			render(ButtonGroup, { children, orientation, isFullWidth: true });

			const group = screen
				.getByRole('button', { name: 'Save' })
				.closest<HTMLElement>('.button-group');
			expect(group?.style.getPropertyValue('--button-group-columns')).toBe(columns);
			expect(group?.style.getPropertyValue('--button-group-target-width')).toBe(targetWidth);
			expect(group?.style.getPropertyValue('--button-group-button-height')).toBe('40px');
			const host = group?.querySelector('.button-group-measurement');
			expect(host?.getAttribute('aria-hidden')).toBe('true');
			expect(host?.hasAttribute('inert')).toBe(true);
			expect(host?.childElementCount).toBe(0);
		}
	);

	it('updates the tracks when its orientation is reconfigured', async () => {
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
			width: 100,
			height: 40
		} as DOMRect);
		const { rerender } = render(ButtonGroup, { children, orientation: 'horizontal' });
		const group = screen
			.getByRole('button', { name: 'Save' })
			.closest<HTMLElement>('.button-group');
		expect(group?.style.getPropertyValue('--button-group-columns')).toBe('2');
		await rerender({ orientation: 'vertical' });
		expect(group?.style.getPropertyValue('--button-group-columns')).toBe('1');
		expect(group?.style.getPropertyValue('--button-group-target-width')).toBe('100px');
	});

	it('does not stretch intrinsic buttons when the group wraps', () => {
		vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: {
			readonly textContent: string | null;
		}) {
			return { width: (this.textContent?.length ?? 0) * 10 + 20, height: 40 } as DOMRect;
		});
		render(ButtonGroup, { children });

		const group = screen
			.getByRole('button', { name: 'Save' })
			.closest<HTMLElement>('.button-group');
		expect(group?.style.getPropertyValue('--button-group-columns')).toBe('1');
		expect(group?.style.getPropertyValue('--button-group-target-width')).toBe('260px');
	});
});
