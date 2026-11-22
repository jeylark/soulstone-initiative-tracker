<script lang="ts">
	import type { StableId, TurnOrderDisplayItem, ViewerTurnOrderDisplayItem } from '#lib/challenge';
	import { FACTION_COLORS } from '#lib/challenge';
	import { Card, CheckboxInput, createFontSizeFitter } from '#lib/components';

	interface Props {
		/** Turn or Spawn data to render as a card. */
		item: TurnOrderDisplayItem | ViewerTurnOrderDisplayItem;
		/** Called with the creature ID and new hidden state when its checkbox changes. Omit to render read-only. */
		onVisibilityChange?: (creatureId: StableId, isHidden: boolean) => void;
	}

	let { item, onVisibilityChange }: Props = $props();
	let factionColor = $derived(
		item.kind === 'turn' && item.display.faction
			? FACTION_COLORS.find((color) => color.value === item.display.faction?.color)
			: undefined
	);
	let visibilityControl = $derived.by(() => {
		if (!onVisibilityChange || item.kind !== 'turn' || !('creature' in item.display)) {
			return undefined;
		}

		const creatureId = item.display.creature.id;
		const creatureName = item.display.creatureName;
		const isHidden = item.display.isHidden;
		const handleVisibilityChange = onVisibilityChange;

		return {
			creatureName,
			isHidden,
			handleChange: (isHidden: boolean) => handleVisibilityChange(creatureId, isHidden)
		};
	});

	const fitText = createFontSizeFitter('1.5rem', '8vw', '3.5rem');
</script>

{#if item.kind === 'spawn'}
	<Card spacing="compact" class="turn-order-card">
		<p class="turn-order-creature-name" use:fitText>Spawn</p>
		<div class="turn-order-card-details" aria-hidden="true"></div>
	</Card>
{:else}
	<div class="turn-order-card-tone" class:is-hidden={item.display.isHidden}>
		<Card
			title={item.display.faction?.name ?? 'Unknown faction'}
			headingLevel="h2"
			headerSize="medium"
			spacing="compact"
			class="turn-order-card"
			isAccented
			accentColor={factionColor?.hex}
			isMuted={item.display.isHidden}
		>
			<div class="turn-order-card-content">
				<p class="turn-order-creature-name" use:fitText>{item.display.label}</p>
				<div>
					<div class="turn-order-card-details">
						{#if item.initiative !== undefined}
							<span class="turn-order-initiative">Initiative: {item.initiative}</span>
						{/if}
					</div>
					{#if visibilityControl}
						<div class="turn-order-visibility">
							<CheckboxInput
								label="Hidden"
								aria-label={`Hidden from viewers: ${visibilityControl.creatureName}`}
								checked={visibilityControl.isHidden}
								onchange={(event) => visibilityControl?.handleChange(event.currentTarget.checked)}
							/>
						</div>
					{/if}
				</div>
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

	.turn-order-card-details {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.turn-order-creature-name {
		margin: 0 0 8px;
		font-weight: 700;
		line-height: 1.15;
		white-space: nowrap;
		overflow: hidden;
		font-size: 8vw;
	}

	.turn-order-initiative {
		font-size: 1rem;
	}
	.turn-order-card-content {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
	}
</style>
