<script lang="ts">
	import { Card, NavButton } from '#lib/components';
	import { resolve } from '$app/paths';
	import type { Challenge } from '#lib/challenge';

	interface Props {
		/** Saved challenge summarized by this card. */
		challenge: Challenge;
	}

	let { challenge }: Props = $props();

	const title = $derived(challenge.name || 'Untitled challenge');
	const characterNames = $derived(
		challenge.creatures.flatMap((creature) =>
			creature.kind === 'character' ? [creature.name] : []
		)
	);
	const npcTypeNames = $derived(challenge.npcTypes.map((npcType) => npcType.name));
	const modifiedDate = $derived(challenge.updatedAt.toLocaleDateString());
</script>

<Card {title} headingLevel="h3" headerSize="medium">
	<div class="challenge-details">
		<div class="modified-row">
			<time datetime={challenge.updatedAt.toISOString()} aria-label={`Modified ${modifiedDate}`}>
				{modifiedDate}
			</time>
			<NavButton
				href={resolve('/challenges/[challengeId]', { challengeId: challenge.id })}
				aria-label={`Load ${title}`}
			>
				Load
			</NavButton>
		</div>
		<dl>
			<div class="challenge-row">
				<dt id={`${challenge.id}-characters`}>PCs</dt>
				<dd>
					{#if characterNames.length === 0}
						None
					{:else}
						<ul aria-labelledby={`${challenge.id}-characters`}>
							{#each characterNames as name, index (index)}
								<li>{name}</li>
							{/each}
						</ul>
					{/if}
				</dd>
			</div>
			<div class="challenge-row">
				<dt id={`${challenge.id}-npc-types`}>NPCs</dt>
				<dd>
					{#if npcTypeNames.length === 0}
						None
					{:else}
						<ul aria-labelledby={`${challenge.id}-npc-types`}>
							{#each npcTypeNames as name, index (index)}
								<li>{name}</li>
							{/each}
						</ul>
					{/if}
				</dd>
			</div>
		</dl>
	</div>
</Card>

<style>
	.challenge-details {
		display: grid;
		gap: 12px;
	}

	.modified-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	dl {
		display: grid;
		gap: 8px;
		margin: 0;
	}

	.challenge-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 8px;
	}

	dt {
		font-weight: 600;
	}

	dd {
		margin: 0 0 8px;
	}

	ul {
		margin: 0;
		padding-inline-start: 24px;
	}
</style>
