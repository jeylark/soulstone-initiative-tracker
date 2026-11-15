import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import FormGroup from './FormGroup.svelte';
import FormGroupFixture from './FormGroup.fixture.svelte';

afterEach(() => cleanup());

describe('FormGroup', () => {
	it('renders children in a configurable shared-track grid', () => {
		const children = createRawSnippet(() => ({ render: () => '<span>Group content</span>' }));
		render(FormGroup, { class: 'custom-columns', children });

		const group = screen.getByText('Group content').parentElement;
		const styles = readFileSync('src/lib/components/forms/form-controls.css', 'utf8');
		expect(group?.classList.contains('form-group')).toBe(true);
		expect(group?.classList.contains('custom-columns')).toBe(true);
		expect(styles).toMatch(/\.form-group\s*\{[^}]*display:\s*grid/s);
		expect(styles).toMatch(/\.form-group\s*\{[^}]*grid-template-columns:/s);
		expect(styles).toMatch(
			/\.form-group\s*>\s*\.form-field-messages\s*\{[^}]*grid-row:\s*span 3;[^}]*grid-template-rows:\s*subgrid/s
		);
		expect(styles).toMatch(
			/\.form-group\s*>\s*\.form-field-messages\s*>\s*\.form-control-message-area\s*\{[^}]*grid-row:\s*3/s
		);
		expect(styles).toMatch(/\.form-group\s+\.form-checkbox-field\s*\{[^}]*align-self:\s*center/s);
		expect(styles).toMatch(
			/\.form-group\s+\.form-range-field,\s*\.form-group\s+\.form-color-picker\s*\{[^}]*align-self:\s*start/s
		);
	});

	it('groups all custom control types and keeps dynamic feedback in its own row', async () => {
		const { rerender } = render(FormGroupFixture);
		const text = screen.getByRole('textbox', { name: 'A long text label that can wrap' });
		const group = text.closest('.form-group');
		expect(group).toBeTruthy();
		const controls = [
			text,
			screen.getByRole('spinbutton', { name: 'Number' }),
			screen.getByRole('combobox', { name: 'Choice' }),
			screen.getByRole('slider', { name: 'Range slider' }),
			screen.getByRole('checkbox', { name: 'A checkbox label that can wrap' }),
			screen.getByRole('radio', { name: 'Blue' })
		];
		for (const control of controls) {
			expect(control.closest('.form-field-messages')?.parentElement).toBe(group);
		}
		expect(group?.querySelectorAll(':scope > .form-field-messages')).toHaveLength(6);
		await rerender({ isInvalid: true, hasWarning: true });
		const field = text.closest('.form-field-messages');
		expect(
			field?.querySelector('.form-control-message-area')?.contains(screen.getByRole('alert'))
		).toBe(true);
		expect(
			field?.querySelector('.form-control-message-area')?.contains(screen.getByRole('status'))
		).toBe(true);
		await rerender({ isInvalid: false, hasWarning: false });
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByRole('status')).toBeNull();
	});
});
