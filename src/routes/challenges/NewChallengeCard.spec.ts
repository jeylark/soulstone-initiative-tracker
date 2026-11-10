import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewChallengeCard from './NewChallengeCard.svelte';

afterEach(() => {
	cleanup();
});

describe('NewChallengeCard', () => {
	it('shows a create button inside a titled card that calls onCreate', async () => {
		const onCreate = vi.fn();
		render(NewChallengeCard, { isDisabled: false, isCreating: false, onCreate });

		expect(screen.getByRole('heading', { level: 3, name: 'New challenge' })).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Create new challenge' }));
		expect(onCreate).toHaveBeenCalledOnce();
	});

	it('disables the button and shows progress while creating', () => {
		render(NewChallengeCard, { isDisabled: true, isCreating: true, onCreate: vi.fn() });

		const button = screen.getByRole('button', { name: 'Creating…' }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
	});
});
