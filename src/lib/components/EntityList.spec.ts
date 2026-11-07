import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntityList from './EntityList.svelte';

afterEach(() => {
	cleanup();
});

const items = createRawSnippet(() => ({ render: () => '<p>Item content</p>' }));
const actions = createRawSnippet(() => ({
	render: () => '<button type="button">Custom add</button>'
}));

describe('EntityList', () => {
	it('renders the add button after the items and calls onAdd', async () => {
		const onAdd = vi.fn();
		render(EntityList, { addLabel: 'Add thing', onAdd, children: items });

		const addButton = screen.getByRole('button', { name: 'Add thing' });
		const content = screen.getByText('Item content');
		expect(
			content.compareDocumentPosition(addButton) & Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();

		await fireEvent.click(addButton);
		expect(onAdd).toHaveBeenCalledOnce();
	});

	it('uses addAriaLabel as the accessible name of the add button', () => {
		render(EntityList, {
			addLabel: 'Add turn',
			addAriaLabel: 'Add turn for Player 1',
			onAdd: vi.fn(),
			children: items
		});

		expect(screen.getByRole('button', { name: 'Add turn for Player 1' })).toBeTruthy();
	});

	it('disables the add button when isAddDisabled is set', () => {
		render(EntityList, {
			addLabel: 'Add thing',
			isAddDisabled: true,
			onAdd: vi.fn(),
			children: items
		});

		expect((screen.getByRole('button', { name: 'Add thing' }) as HTMLButtonElement).disabled).toBe(
			true
		);
	});

	it('renders the actions snippet instead of the single add button', () => {
		render(EntityList, { actions, children: items });

		expect(screen.getByRole('button', { name: 'Custom add' })).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Add thing' })).toBeNull();
	});

	it('applies the layout modifier class to the items container', () => {
		render(EntityList, {
			addLabel: 'Add thing',
			layout: 'strip',
			onAdd: vi.fn(),
			children: items
		});

		expect(screen.getByText('Item content').parentElement?.className).toContain(
			'entity-list-items--strip'
		);
	});
});
