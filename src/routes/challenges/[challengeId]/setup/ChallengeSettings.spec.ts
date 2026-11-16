import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChallengeSettings from './ChallengeSettings.svelte';

afterEach(() => cleanup());

describe('ChallengeSettings', () => {
	it('uses a responsive shared form group for the name and fairness controls', () => {
		render(ChallengeSettings, {
			name: 'Challenge',
			fairnessWeight: 3,
			isDisabled: false,
			setupIssues: [],
			onNameChange: vi.fn(),
			onFairnessWeightChange: vi.fn()
		});

		const name = screen.getByRole('textbox', { name: 'Challenge name' });
		const slider = screen.getByRole('slider', { name: 'Fairness weight slider' });
		const number = screen.getByRole('spinbutton', { name: 'Fairness weight value' });
		const group = name.closest('.form-group');
		expect(group?.classList.contains('settings-fields')).toBe(true);
		expect(group?.closest('fieldset')?.classList.contains('settings')).toBe(true);
		expect(name.closest('.form-field-messages')?.parentElement).toBe(group);
		expect(slider.closest('.form-field-messages')?.parentElement).toBe(group);
		expect(number.closest('.form-field-messages')?.parentElement).toBe(group);

		const source = readFileSync(
			'src/routes/challenges/[challengeId]/setup/ChallengeSettings.svelte',
			'utf8'
		);
		expect(source).toMatch(/\.settings\s*\{[^}]*--form-group-min-column-width:\s*256px/s);
		expect(source).toMatch(/\.settings\s*\{[^}]*--form-group-column-gap:\s*24px/s);
		expect(source).not.toMatch(/\.settings-fields\s*\{[^}]*grid-template-columns:/s);
	});
});
