<script lang="ts">
	import type { ChallengeCreature, Faction, StableId } from '#lib';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import TurnEditor from './TurnEditor.svelte';

	interface Props {
		creature: ChallengeCreature;
		name: string;
		characterName: string;
		factions: readonly Faction[];
		targetTurns: readonly TurnTarget[];
		onFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onCharacterNameChange: (characterId: StableId, name: string) => void;
		onNpcIdentifierChange: (creatureId: StableId, identifier: string) => void;
		onTurnChange: (
			creatureId: StableId,
			turnId: StableId,
			change: Readonly<TurnEditorChange>
		) => void;
		onRemove: (creatureId: StableId) => void;
	}

	let {
		creature,
		name,
		characterName,
		factions,
		targetTurns,
		onFactionChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onRemove
	}: Props = $props();
</script>

<fieldset class="creature" aria-label={name}>
	<legend>{name}</legend>
	<label>
		<span>Faction</span>
		<select
			value={creature.factionId}
			onchange={(event) => onFactionChange(creature.id, event.currentTarget.value as StableId)}
		>
			{#each factions as faction (faction.id)}
				<option value={faction.id}>{faction.name}</option>
			{/each}
		</select>
	</label>
	{#if creature.kind === 'character'}
		<label>
			<span>Character name</span>
			<input
				aria-label={`Character name: ${characterName}`}
				value={characterName}
				oninput={(event) => onCharacterNameChange(creature.characterId, event.currentTarget.value)}
			/>
		</label>
	{:else if creature.kind === 'npc'}
		<label>
			<span>NPC identifier</span>
			<input
				value={creature.identifier}
				oninput={(event) => onNpcIdentifierChange(creature.id, event.currentTarget.value)}
			/>
		</label>
	{/if}
	{#each creature.turns as turn (turn.id)}
		<TurnEditor
			{turn}
			{targetTurns}
			onChange={(change) => onTurnChange(creature.id, turn.id, change)}
		/>
	{/each}
	<button
		class="quiet-button"
		type="button"
		aria-label={`Remove ${name}`}
		onclick={() => onRemove(creature.id)}
	>
		Remove creature
	</button>
</fieldset>
