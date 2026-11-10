import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import type { HTMLFieldsetAttributes } from 'svelte/elements';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EntityListItem from './EntityListItem.svelte';

afterEach(() => {
	cleanup();
});

const content = createRawSnippet(() => ({ render: () => '<p>Entity content</p>' }));

describe('EntityListItem', () => {
	it('uses a single card with the legend as its visible title and group name', () => {
		const { container } = render(EntityListItem, {
			legend: 'Player 1',
			removeLabel: 'Remove Player 1',
			onRemove: vi.fn(),
			children: content
		});

		const heading = screen.getByRole('heading', { level: 2, name: 'Player 1' });
		const card = heading.parentElement;
		expect(container.querySelectorAll('.card')).toHaveLength(1);
		expect(card?.classList.contains('card--surface')).toBe(true);
		expect(card?.classList.contains('card--standard')).toBe(true);
		expect(heading.classList.contains('card-header--large')).toBe(true);
		expect(screen.getByRole('group', { name: 'Player 1' }).parentElement).toBe(card);
	});

	it('forwards heading and layout options to the card rather than the fieldset', () => {
		render(EntityListItem, {
			legend: 'Turn 1',
			headingLevel: 'h5',
			headerSize: 'compact',
			variant: 'inset',
			spacing: 'compact',
			removeLabel: 'Remove Turn 1',
			onRemove: vi.fn(),
			children: content
		});

		const heading = screen.getByRole('heading', { level: 5, name: 'Turn 1' });
		expect(heading.classList.contains('card-header--compact')).toBe(true);
		expect(heading.parentElement?.classList.contains('card--inset')).toBe(true);
		expect(heading.parentElement?.classList.contains('card--compact')).toBe(true);
		const group = screen.getByRole('group', { name: 'Turn 1' });
		for (const attribute of ['headingLevel', 'headerSize', 'variant', 'spacing']) {
			expect(group.hasAttribute(attribute)).toBe(false);
		}
	});

	it('keeps caller attributes and disabled state on the fieldset', () => {
		const fieldsetAttributes: HTMLFieldsetAttributes = {
			id: 'player-settings',
			class: 'player-fields'
		};
		fieldsetAttributes.disabled = true;
		fieldsetAttributes['aria-describedby'] = 'player-help';
		render(EntityListItem, {
			...fieldsetAttributes,
			legend: 'Player 1',
			removeLabel: 'Remove Player 1',
			onRemove: vi.fn(),
			children: content
		});

		const group = screen.getByRole('group', { name: 'Player 1' }) as HTMLFieldSetElement;
		expect(group.id).toBe('player-settings');
		expect(group.classList.contains('player-fields')).toBe(true);
		expect(group.disabled).toBe(true);
		expect(group.getAttribute('aria-describedby')).toBe('player-help');
		expect(group.parentElement?.classList.contains('player-fields')).toBe(false);
	});

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

	it('omits the remove button when no removal callback is provided', () => {
		render(EntityListItem, {
			legend: 'Read-only entity',
			children: content
		});

		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows a remove icon with default and custom tooltip text', () => {
		const { unmount } = render(EntityListItem, {
			legend: 'A',
			removeLabel: 'Remove A',
			onRemove: vi.fn(),
			children: content
		});
		const defaultButton = screen.getByRole('button', { name: 'Remove A' });
		expect(defaultButton.textContent?.trim()).toBe('');
		expect(defaultButton.getAttribute('title')).toBe('Remove');
		expect(defaultButton.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
		unmount();

		render(EntityListItem, {
			legend: 'B',
			removeLabel: 'Remove B',
			removeText: 'Remove creature',
			onRemove: vi.fn(),
			children: content
		});
		expect(screen.getByRole('button', { name: 'Remove B' }).getAttribute('title')).toBe(
			'Remove creature'
		);
	});

	it('places the remove button before the content and calls onRemove', async () => {
		const onRemove = vi.fn();
		render(EntityListItem, {
			legend: 'A',
			removeLabel: 'Remove A',
			onRemove,
			children: content
		});

		const button = screen.getByRole('button', { name: 'Remove A' });
		expect(
			button.compareDocumentPosition(screen.getByText('Entity content')) &
				Node.DOCUMENT_POSITION_FOLLOWING
		).toBeTruthy();

		await fireEvent.click(button);
		expect(onRemove).toHaveBeenCalledOnce();
	});

	it('disables only the remove button with isRemoveDisabled', () => {
		const onRemove = vi.fn();
		render(EntityListItem, {
			legend: 'A',
			removeLabel: 'Remove A',
			isRemoveDisabled: true,
			onRemove,
			children: content
		});

		const button = screen.getByRole('button', { name: 'Remove A' }) as HTMLButtonElement;
		expect(button.disabled).toBe(true);
		expect((screen.getByRole('group', { name: 'A' }) as HTMLFieldSetElement).disabled).toBe(false);
	});
});
