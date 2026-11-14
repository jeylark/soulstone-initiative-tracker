import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from '#lib/challenge';
import NpcTypeEditor from './NpcTypeEditor.svelte';

afterEach(cleanup);

describe('NpcTypeEditor', () => {
	it('keeps the group legend accessible without duplicating the Card heading', () => {
		render(NpcTypeEditor, {
			npcTypes: [],
			setupIssues: [],
			canManageNpcTypes: true,
			isNpcTypeConfigurable: vi.fn(() => true),
			creationError: '',
			onCreate: vi.fn(),
			onRename: vi.fn(),
			onInitiativeStatChange: vi.fn(),
			onRemove: vi.fn()
		});

		const group = screen.getByRole('group', { name: 'NPC types' });
		expect(group.querySelector(':scope > legend')?.classList.contains('visually-hidden')).toBe(
			true
		);
		expect(screen.getByRole('heading', { name: 'NPC types', level: 2 })).toBeTruthy();
	});

	it('passes layout classes explicitly to the remove action and form labels', () => {
		render(NpcTypeEditor, {
			npcTypes: [{ id: createUuid(), name: 'Guard', initiativeStat: 2 }],
			setupIssues: [],
			canManageNpcTypes: true,
			isNpcTypeConfigurable: vi.fn(() => true),
			creationError: '',
			onCreate: vi.fn(),
			onRename: vi.fn(),
			onInitiativeStatChange: vi.fn(),
			onRemove: vi.fn()
		});

		const npc = screen.getByRole('group', { name: 'Guard' });
		expect(npc.querySelector('.npc-type-remove-action')).toBeTruthy();
		expect(npc.querySelector('.npc-type-field-label')).toBeTruthy();
	});
});
