import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import type { StableId, TurnDisplay } from '#lib/challenge';
import { createSetupChallenge } from '../../../view-test-support';
import InitiativeFactionSection from './InitiativeFactionSection.svelte';

afterEach(cleanup);

it('renders one named, keyboard-focusable region for the faction', () => {
	const challenge = createSetupChallenge();
	const faction = { ...challenge.factions[0], name: 'Enemies' };

	render(InitiativeFactionSection, {
		faction,
		creatures: [
			{
				id: '00000000-0000-4000-8000-000000000011' as StableId,
				kind: 'character',
				name: 'Aria',
				factionId: faction.id,
				isHidden: false,
				turns: [
					{
						id: '00000000-0000-4000-8000-000000000006' as StableId,
						initiative: { kind: 'roll', mode: 'manual' }
					}
				]
			}
		],
		turnDisplayLookup: new Map<StableId, TurnDisplay>(),
		initiativeResults: {},
		initiativeInputs: {},
		isInvalidInput: () => false,
		canRoll: () => false,
		isInputLocked: () => false,
		isRollLocked: () => false,
		onInput: vi.fn(),
		onRoll: vi.fn()
	});

	expect(screen.getByRole('region', { name: 'Enemies' }).getAttribute('tabindex')).toBe('0');
	expect(screen.getByRole('heading', { level: 2, name: 'Enemies' })).toBeTruthy();
});
