<script lang="ts">
	import type { StableId, TurnOrderDisplayItem } from '#lib/challenge';
	import { FACTION_COLORS } from '#lib/challenge';
	import { Card, CheckboxInput } from '#lib/components';

	interface Props {
		item: TurnOrderDisplayItem;
		onVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
	}

	let { item, onVisibilityChange }: Props = $props();
	let factionColor = $derived(
		item.kind === 'turn' && item.display.faction
			? FACTION_COLORS.find((color) => color.value === item.display.faction?.color)
			: undefined
	);
</script>

{#if item.kind === 'spawn'}
	<Card
		title="Spawn"
		headingLevel="h2"
		headerSize="small"
		spacing="compact"
		class="turn-order-card"
	>
		<div class="turn-order-card-details" aria-hidden="true"></div>
	</Card>
{:else}
	<div
		class="turn-order-card-tone"
		class:is-hidden={item.display.isHidden}
		style={factionColor ? `--faction-color: ${factionColor.hex}` : ''}
	>
		<Card
			title={item.display.faction?.name ?? 'Unknown faction'}
			headingLevel="h2"
			headerSize="small"
			spacing="compact"
			class="turn-order-card"
		>
			<p class="turn-order-creature-name">{item.display.label}</p>
			<div class="turn-order-card-details">
				{#if item.initiative !== undefined}
					<span class="turn-order-initiative">Initiative: {item.initiative}</span>
				{/if}
			</div>
			<div class="turn-order-visibility">
				<CheckboxInput
					label="Hidden"
					aria-label={`Hidden from viewers: ${item.display.creatureName}`}
					checked={item.display.isHidden}
					onchange={(event) =>
						onVisibilityChange(item.display.creature.id, event.currentTarget.checked)}
				/>
			</div>
		</Card>
	</div>
{/if}

<style>
	.turn-order-card-tone {
		min-width: 0;
	}

	.turn-order-visibility {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}

	.turn-order-card-tone :global(.turn-order-card) {
		border-left: 6px solid var(--faction-color, var(--color-border));
		background: color-mix(
			in srgb,
			var(--faction-color, var(--color-surface)) 22%,
			var(--color-surface)
		);
	}

	.turn-order-card-tone.is-hidden :global(.turn-order-card) {
		background: color-mix(in srgb, #808080 18%, var(--color-surface));
	}

	.turn-order-card-details {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.turn-order-creature-name {
		margin: 0 0 8px;
		font-size: clamp(1.5rem, 4vw, 1.75rem);
		font-weight: 700;
		line-height: 1.15;
		overflow-wrap: anywhere;
	}

	.turn-order-initiative {
		font-size: 1rem;
	}
</style>
