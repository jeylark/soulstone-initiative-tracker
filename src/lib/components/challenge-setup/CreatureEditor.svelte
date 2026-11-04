<script lang="ts">
	import type { ChallengeCreature, Faction, NpcType, StableId } from '#lib';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import TurnEditor from './TurnEditor.svelte';
	import Card from '../Card.svelte';

	interface Props {
		creature: ChallengeCreature;
		name: string;
		characterName: string;
		factions: readonly Faction[];
		npcTypes: readonly NpcType[];
		targetTurns: readonly TurnTarget[];
		onFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => void;
		onCharacterNameChange: (characterId: StableId, name: string) => void;
		onNpcIdentifierChange: (creatureId: StableId, identifier: string) => void;
		onTurnChange: (
			creatureId: StableId,
			turnId: StableId,
			change: Readonly<TurnEditorChange>
		) => void;
		onAddTurn: (creatureId: StableId) => void;
		onRemoveTurn: (creatureId: StableId, turnId: StableId) => void;
		onRemove: (creatureId: StableId) => void;
	}

	let {
		creature,
		name,
		characterName,
		factions,
		npcTypes,
		targetTurns,
		onFactionChange,
		onNpcTypeChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemove
	}: Props = $props();
</script>

<Card title={name} headingLevel="h4" headerSize="medium" spacing="compact">
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
					oninput={(event) =>
						onCharacterNameChange(creature.characterId, event.currentTarget.value)}
				/>
			</label>
		{:else if creature.kind === 'npc'}
			<label>
				<span>NPC type</span>
				<select
					aria-label={`NPC type for ${name}`}
					value={creature.creatureTypeId}
					onchange={(event) => onNpcTypeChange(creature.id, event.currentTarget.value as StableId)}
				>
					{#each npcTypes as npcType (npcType.id)}
						<option value={npcType.id}>{npcType.name}</option>
					{/each}
				</select>
			</label>
			<label>
				<span>NPC identifier</span>
				<input
					value={creature.identifier}
					oninput={(event) => onNpcIdentifierChange(creature.id, event.currentTarget.value)}
				/>
			</label>
		{/if}
		{#each creature.turns as turn, index (turn.id)}
			<TurnEditor
				{turn}
				turnNumber={index + 1}
				creatureName={name}
				targetTurns={targetTurns.filter((target) => target.id !== turn.id)}
				onChange={(change) => onTurnChange(creature.id, turn.id, change)}
				onRemove={() => onRemoveTurn(creature.id, turn.id)}
			/>
		{/each}
		<button
			type="button"
			aria-label={`Add turn for ${name}`}
			onclick={() => onAddTurn(creature.id)}
		>
			Add turn
		</button>
		<button
			class="quiet-button warning-button"
			type="button"
			aria-label={`Remove ${name}`}
			onclick={() => onRemove(creature.id)}
		>
			Remove creature
		</button>
	</fieldset>
</Card>
