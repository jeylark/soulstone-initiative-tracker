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
</script>

<Card {title} headingLevel="h3" headerSize="medium">
	<dl>
		<dt>Last modified</dt>
		<dd>
			<time datetime={challenge.updatedAt.toISOString()}>
				{challenge.updatedAt.toLocaleString()}
			</time>
		</dd>
		<dt id={`${challenge.id}-characters`}>Player characters</dt>
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
		<dt id={`${challenge.id}-npc-types`}>NPC types</dt>
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
	</dl>
	<NavButton
		href={resolve('/challenges/[challengeId]', { challengeId: challenge.id })}
		aria-label={`Load ${title}`}
	>
		Load
	</NavButton>
</Card>

<style>
	dl {
		margin: 0 0 16px;
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
