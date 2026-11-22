import { cleanup, render, screen, within } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { createUuid, type TurnOrderDisplayItem } from '#lib/challenge';
import TurnOrderList from './TurnOrderList.svelte';

afterEach(cleanup);

function createTurnItem(label: string): TurnOrderDisplayItem {
	const turnId = createUuid();
	const creatureId = createUuid();
	return {
		kind: 'turn',
		turnId,
		position: 1,
		display: {
			creature: {
				id: creatureId,
				kind: 'character',
				name: label,
				factionId: createUuid(),
				isHidden: false,
				turns: [{ id: turnId, initiative: { kind: 'roll', mode: 'app' } }]
			},
			faction: undefined,
			creatureName: label,
			label,
			initiative: { kind: 'roll', mode: 'app' },
			isHidden: false
		},
		initiative: 6
	};
}

describe('TurnOrderList', () => {
	it('renders items in order and marks only the first item as current', () => {
		render(TurnOrderList, {
			props: {
				items: [createTurnItem('Aria'), { kind: 'spawn', position: 2 }, createTurnItem('Rook')]
			}
		});

		const list = screen.getByRole('list', { name: 'Generated turn order' });
		const items = within(list).getAllByRole('listitem');
		expect(items).toHaveLength(3);
		expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
			'Unknown faction',
			undefined,
			'Unknown faction'
		]);
		expect(items[0]?.getAttribute('aria-current')).toBe('step');
		expect(items[1]?.hasAttribute('aria-current')).toBe(false);
		expect(items[2]?.hasAttribute('aria-current')).toBe(false);
	});
});
