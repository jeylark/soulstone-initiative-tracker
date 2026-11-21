import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ButtonGroupItem from './ButtonGroupItem.svelte';

afterEach(() => {
	cleanup();
});

const children = createRawSnippet(() => ({
	render: () => '<button type="button">Save</button>'
}));

describe('ButtonGroupItem', () => {
	it('wraps its control and exposes alternate labels for measurement', () => {
		render(ButtonGroupItem, { children, sizingLabels: ['Saving...', 'Save changes'] });

		const item = screen.getByRole('button', { name: 'Save' }).closest('.button-group-item');
		expect(item?.getAttribute('data-sizing-labels')).toBe('["Saving...","Save changes"]');
	});

	it('applies the shared dimensions to grouped button elements', () => {
		render(ButtonGroupItem, {
			children: createRawSnippet(() => ({
				render: () => '<button class="ui-button" type="button">Save</button>'
			}))
		});
		const button = screen.getByRole('button', { name: 'Save' });
		expect(button.parentElement?.classList.contains('button-group-item')).toBe(true);
		expect(button.classList.contains('ui-button')).toBe(true);
		const styles = readFileSync('src/lib/components/ui-button.css', 'utf8');
		expect(styles).toMatch(/\.button-group-item\s*>\s*\.ui-button\s*\{[^}]*width:\s*100%/s);
		expect(styles).toMatch(
			/\.button-group-item\s*>\s*\.ui-button\s*\{[^}]*height:\s*var\(--button-group-button-height/s
		);
		expect(styles).toMatch(
			/\.button-group-item\s*>\s*\.ui-button\s*\{[^}]*overflow-wrap:\s*anywhere/s
		);
	});
});
