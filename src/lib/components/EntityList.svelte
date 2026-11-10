<script lang="ts" generics="T extends { id: StableId }">
	import type { Snippet } from 'svelte';
	import type { HTMLFieldsetAttributes } from 'svelte/elements';
	import ActionButton from './ActionButton.svelte';
	import type { StableId } from '#lib/challenge';
	import EntityListItem from './EntityListItem.svelte';
	import type { DeepReadonly } from '#lib';

	interface AddAction {
		/** Visible label of the add action. */
		label: string;
		/** Accessible name when the visible label needs more context. */
		ariaLabel?: string;
		/** Whether this action is currently unavailable. */
		isDisabled?: boolean;
		/** Called when the action is activated. */
		onAdd: () => void;
	}

	interface EntityItemOptions {
		/** Heading level of the entity card. */
		headingLevel?: 'h2' | 'h3' | 'h4' | 'h5';
		/** Visual size of the entity card heading. */
		headerSize?: 'large' | 'medium' | 'small' | 'compact';
		/** Surface style of the entity card. */
		variant?: 'surface' | 'subtle' | 'inset';
		/** Padding of the entity card. */
		spacing?: 'standard' | 'compact';
		/** Tooltip shown on the remove button. */
		removeText?: string;
		/** Whether the remove button is disabled. */
		isRemoveDisabled?: boolean;
		/** Attributes applied to the entity fieldset. */
		fieldsetAttributes?: HTMLFieldsetAttributes;
	}

	interface Props {
		/** Add actions shown after the entity items. */
		adds: readonly AddAction[];
		/** Extra content rendered after entity items and before add actions. */
		afterEntities?: Snippet;
		/** Selects the accessible name of each entity group. */
		legendSelector?: (entity: DeepReadonly<T>, index: number) => string;
		/** Selects the accessible name of each remove button. */
		removeLabelSelector?: (entity: DeepReadonly<T>, index: number) => string;
		/** Selects item presentation and fieldset attributes for an entity. */
		itemOptionsSelector?: (entity: DeepReadonly<T>, index: number) => EntityItemOptions;
		/** Called with the entity whose remove button was activated. */
		onRemove?: (entity: DeepReadonly<T>) => void;
		/** How the items are arranged: vertical stack, wrapping strip, or responsive grid. */
		layout?: 'grid' | 'strip' | 'stack';
		/** Entities rendered in the list. */
		entities: readonly DeepReadonly<T>[];
		/** Content rendered inside each entity item, with its zero-based index. */
		entityEditor: Snippet<[DeepReadonly<T>, number]>;
	}

	let {
		adds,
		onRemove,
		removeLabelSelector,
		itemOptionsSelector,
		layout = 'stack',
		entities,
		entityEditor,
		legendSelector,
		afterEntities
	}: Props = $props();
</script>

<div class="entity-list">
	<div class={`entity-list-items entity-list-items--${layout}`}>
		{#each entities as entity, index (entity.id)}
			{@const itemOptions = itemOptionsSelector?.(entity, index) ?? {}}
			<EntityListItem
				legend={legendSelector?.(entity, index) ?? ''}
				removeLabel={removeLabelSelector?.(entity, index) ?? ''}
				onRemove={onRemove ? () => onRemove(entity) : undefined}
				headingLevel={itemOptions.headingLevel}
				headerSize={itemOptions.headerSize}
				variant={itemOptions.variant}
				spacing={itemOptions.spacing}
				removeText={itemOptions.removeText}
				isRemoveDisabled={itemOptions.isRemoveDisabled}
				{...itemOptions.fieldsetAttributes}
			>
				{@render entityEditor(entity, index)}
			</EntityListItem>
		{/each}
		{@render afterEntities?.()}
	</div>
	<div class="entity-list-actions">
		{#each adds as add, index (index)}
			<ActionButton aria-label={add.ariaLabel} disabled={add.isDisabled} onclick={add.onAdd}>
				{add.label}
			</ActionButton>
		{/each}
	</div>
</div>

<style>
	.entity-list {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.entity-list-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.entity-list-items:empty {
		display: none;
	}

	.entity-list-items--stack {
		display: grid;
		gap: 12px;
	}

	.entity-list-items--strip {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
	}

	.entity-list-items--strip > :global(*) {
		flex: 0 1 min(280px, 100%);
		min-width: 0;
	}

	.entity-list-items--grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
		align-items: start;
		gap: 20px;
	}
</style>
