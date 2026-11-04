<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		FactionColor,
		NpcType,
		PlayerCharacter,
		StableId
	} from '#lib';
	import { FACTION_COLORS } from '../../challenge/faction-colors.js';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import CreatureEditor from './CreatureEditor.svelte';
	import EntityList from '../EntityList.svelte';
	import EntityListItem from '../EntityListItem.svelte';
	import ActionButton from '../ActionButton.svelte';
	import Card from '../Card.svelte';
	import TextInput from '../forms/TextInput.svelte';

	interface Props {
		faction: Readonly<Faction>;
		factions: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		characters: readonly PlayerCharacter[];
		npcTypes: readonly NpcType[];
		npcTypeId: StableId | '';
		onRename: (factionId: StableId, name: string) => void;
		onColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemove: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureFactionChange: (creatureId: StableId, factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
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
		onRemoveCreature: (creatureId: StableId) => void;
	}

	let {
		faction,
		factions,
		creatures,
		characters,
		npcTypes,
		npcTypeId,
		onRename,
		onColorChange,
		onRemove,
		onCreateCharacter,
		onCreateNpc,
		onCreatureFactionChange,
		onCreatureVisibilityChange,
		onNpcTypeChange,
		onCharacterNameChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemoveCreature
	}: Props = $props();
	let factionCreatures = $derived(
		creatures.filter((creature) => creature.factionId === faction.id)
	);

	function characterName(characterId: StableId): string {
		return characters.find((character) => character.id === characterId)?.name ?? 'Character';
	}

	function npcName(creatureTypeId: StableId, identifier: string): string {
		const typeName = npcTypes.find((npcType) => npcType.id === creatureTypeId)?.name ?? 'NPC';
		return `${typeName} ${identifier}`.trim();
	}

	function targetTurns(): TurnTarget[] {
		return creatures.flatMap((creature) => {
			const name =
				creature.kind === 'character'
					? characterName(creature.characterId)
					: npcName(creature.creatureTypeId, creature.identifier);
			return creature.turns.map((turn, index) => ({
				id: turn.id,
				name: `${name} - Turn ${index + 1}`
			}));
		});
	}
</script>

<Card title={faction.name} headingLevel="h3" headerSize="medium" variant="inset" spacing="compact">
	<EntityListItem
		class="faction-panel"
		legend={faction.name}
		removeLabel={`Remove faction ${faction.name}`}
		onRemove={() => onRemove(faction.id)}
	>
		<TextInput
			label="Faction name"
			aria-label={`Faction name: ${faction.name}`}
			value={faction.name}
			oninput={(event) => onRename(faction.id, event.currentTarget.value)}
		/>
		<fieldset class="faction-colors">
			<legend>Faction color for {faction.name}</legend>
			<div class="faction-color-options">
				{#each FACTION_COLORS as paletteColor (paletteColor.value)}
					<label class="faction-color-option">
						<input
							type="radio"
							name={`faction-color-${faction.id}`}
							value={paletteColor.value}
							checked={faction.color === paletteColor.value}
							onchange={() => onColorChange(faction.id, paletteColor.value)}
						/>
						<span class="faction-color-swatch" style={`--faction-color: ${paletteColor.hex}`}
						></span>
						<span>{paletteColor.label}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<EntityList>
			{#snippet actions()}
				<ActionButton onclick={() => onCreateCharacter(faction.id)}>Add Player</ActionButton>
				<ActionButton disabled={!npcTypeId} onclick={() => onCreateNpc(faction.id)}>
					Add NPC
				</ActionButton>
			{/snippet}
			{#each factionCreatures as creature (creature.id)}
				{@const name =
					creature.kind === 'character'
						? characterName(creature.characterId)
						: npcName(creature.creatureTypeId, creature.identifier)}
				<CreatureEditor
					{creature}
					{name}
					characterName={creature.kind === 'character' ? characterName(creature.characterId) : ''}
					{factions}
					{npcTypes}
					targetTurns={targetTurns()}
					onFactionChange={onCreatureFactionChange}
					onVisibilityChange={onCreatureVisibilityChange}
					{onNpcTypeChange}
					{onCharacterNameChange}
					{onNpcIdentifierChange}
					{onTurnChange}
					{onAddTurn}
					{onRemoveTurn}
					onRemove={onRemoveCreature}
				/>
			{/each}
		</EntityList>
	</EntityListItem>
</Card>
