import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUuid } from '#lib/challenge';
import EntityList from './EntityList.svelte';

afterEach(() => {
	cleanup();
});

const entities = [
	{ id: createUuid(), name: 'Alpha' },
	{ id: createUuid(), name: 'Beta' }
];
const entityEditor = createRawSnippet(
	(getEntity: () => { name: string }, getIndex: () => number) => ({
		render: () => `<p>${getEntity().name}:${getIndex()}</p>`
	})
);
const afterEntities = createRawSnippet(() => ({ render: () => '<p>Recovery section</p>' }));

describe('EntityList', () => {
	it('renders each entity through the editor snippet', () => {
		render(EntityList, {
			entities,
			entityEditor,
			adds: [],
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`,
			onRemove: vi.fn()
		});

		expect(screen.getByRole('group', { name: 'Alpha' }).querySelector('p')?.textContent).toBe(
			'Alpha:0'
		);
		expect(screen.getByRole('group', { name: 'Beta' }).querySelector('p')?.textContent).toBe(
			'Beta:1'
		);
	});

	it('applies per-entity item presentation and fieldset attributes', () => {
		render(EntityList, {
			entities: [entities[0]],
			entityEditor,
			adds: [],
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`,
			onRemove: vi.fn(),
			itemOptionsSelector: (entity) => ({
				headingLevel: 'h3',
				headerSize: 'small',
				variant: 'subtle',
				spacing: 'compact',
				fieldsetAttributes: { class: 'entity-fields', ['data-entity-id']: entity.id }
			})
		});

		const heading = screen.getByRole('heading', { level: 3, name: 'Alpha' });
		expect(heading.classList.contains('card-header--small')).toBe(true);
		expect(heading.parentElement?.classList.contains('card--subtle')).toBe(true);
		expect(heading.parentElement?.classList.contains('card--compact')).toBe(true);
		expect(screen.getByRole('group', { name: 'Alpha' }).getAttribute('data-entity-id')).toBe(
			entities[0].id
		);
	});

	it('calls onRemove with the selected entity', async () => {
		const onRemove = vi.fn();
		render(EntityList, {
			entities: [entities[0]],
			entityEditor,
			adds: [],
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`,
			onRemove
		});

		await fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
		expect(onRemove).toHaveBeenCalledExactlyOnceWith(entities[0]);
	});

	it('omits the remove button when onRemove is not provided', () => {
		render(EntityList, {
			entities: [entities[0]],
			entityEditor,
			adds: [],
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`
		});

		expect(screen.queryByRole('button', { name: 'Remove Alpha' })).toBeNull();
	});

	it('renders add actions after the items and honors accessible names and disabled state', async () => {
		const onAdd = vi.fn();
		render(EntityList, {
			entities: [entities[0]],
			entityEditor,
			adds: [
				{ label: 'Add thing', onAdd },
				{
					label: 'Add NPC',
					ariaLabel: 'Add a non-player creature',
					isDisabled: true,
					onAdd: vi.fn()
				}
			],
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`,
			onRemove: vi.fn()
		});

		const addButton = screen.getByRole('button', { name: 'Add thing' });
		const content = screen.getByRole('group', { name: 'Alpha' });
		expect(
			content.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();

		await fireEvent.click(addButton);
		expect(onAdd).toHaveBeenCalledOnce();
		expect(
			(screen.getByRole('button', { name: 'Add a non-player creature' }) as HTMLButtonElement)
				.disabled
		).toBe(true);
	});

	it('applies the layout modifier class to the items container', () => {
		render(EntityList, {
			entities,
			entityEditor,
			adds: [],
			layout: 'strip',
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`,
			onRemove: vi.fn()
		});

		expect(document.querySelector('.entity-list-items')?.className).toContain(
			'entity-list-items--strip'
		);
	});

	it('renders supplemental content after the entities and before the add actions', () => {
		render(EntityList, {
			entities: [entities[0]],
			entityEditor,
			afterEntities,
			adds: [{ label: 'Add thing', onAdd: vi.fn() }],
			legendSelector: (entity) => entity.name,
			removeLabelSelector: (entity) => `Remove ${entity.name}`,
			onRemove: vi.fn()
		});

		const entity = screen.getByRole('group', { name: 'Alpha' });
		const recovery = screen.getByText('Recovery section');
		const addButton = screen.getByRole('button', { name: 'Add thing' });
		expect(
			entity.compareDocumentPosition(recovery) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
		expect(
			recovery.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();
	});
});
