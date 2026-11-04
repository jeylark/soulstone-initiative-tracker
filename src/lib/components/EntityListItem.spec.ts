import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntityListItem from './EntityListItem.svelte';

afterEach(() => {
	cleanup();
});

const content = createRawSnippet(() => ({ render: () => '<p>Entity content</p>' }));

describe('EntityListItem', () => {
	it('renders a named group containing the content and a remove button', () => {
		render(EntityListItem, {
			legend: 'Player 1',
			removeLabel: 'Remove Player 1',
			onRemove: vi.fn(),
			children: content
		});

		const group = screen.getByRole('group', { name: 'Player 1' });
		expect(group.textContent).toContain('Entity content');
		expect(group.contains(screen.getByRole('button', { name: 'Remove Player 1' }))).toBe(true);
	});

	it('shows "Remove" by default and removeText when provided', () => {
		const { unmount } = render(EntityListItem, {
			legend: 'A',
			removeLabel: 'Remove A',
			onRemove: vi.fn(),
			children: content
		});
		expect(screen.getByRole('button', { name: 'Remove A' }).textContent?.trim()).toBe('Remove');
		unmount();

		render(EntityListItem, {
			legend: 'B',
			removeLabel: 'Remove B',
			removeText: 'Remove creature',
			onRemove: vi.fn(),
			children: content
		});
		expect(screen.getByRole('button', { name: 'Remove B' }).textContent?.trim()).toBe(
			'Remove creature'
		);
	});

	it('places the remove button after the content and calls onRemove', async () => {
		const onRemove = vi.fn();
		render(EntityListItem, {
			legend: 'A',
			removeLabel: 'Remove A',
			onRemove,
			children: content
		});

		const button = screen.getByRole('button', { name: 'Remove A' });
		expect(
			screen.getByText('Entity content').compareDocumentPosition(button) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();

		await fireEvent.click(button);
		expect(onRemove).toHaveBeenCalledOnce();
	});
});
