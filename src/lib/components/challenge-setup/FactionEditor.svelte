<script lang="ts">
	import type {
		ChallengeCreature,
		Faction,
		FactionColor,
		NpcType,
		StableId,
		ValidationIssue
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
		creatures: readonly ChallengeCreature[];
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		npcTypeId: StableId | '';
		onRename: (factionId: StableId, name: string) => void;
		onColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemove: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
		onMoveTurn: (creatureId: StableId, turnId: StableId, direction: 'up' | 'down') => void;
		onMoveCreature: (creatureId: StableId, direction: 'up' | 'down') => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => void;
		onCharacterNameChange: (creatureId: StableId, name: string) => void;
		onCharacterInitiativeStatChange: (
			creatureId: StableId,
			initiativeStat: number | undefined
		) => void;
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
		creatures,
		npcTypes,
		setupIssues,
		npcTypeId,
		onRename,
		onColorChange,
		onRemove,
		onCreateCharacter,
		onCreateNpc,
		onCreatureVisibilityChange,
		onMoveTurn,
		onMoveCreature,
		onNpcTypeChange,
		onCharacterNameChange,
		onCharacterInitiativeStatChange,
		onNpcIdentifierChange,
		onTurnChange,
		onAddTurn,
		onRemoveTurn,
		onRemoveCreature
	}: Props = $props();
	let factionCreatures = $derived(
		creatures.filter((creature) => creature.factionId === faction.id)
	);

	function characterInitiativeStatError(creatureId: StableId): string | undefined {
		const creatureIndex = creatures.findIndex((creature) => creature.id === creatureId);
		return setupIssues.find(
			(issue) => issue.path === `$.creatures[${creatureIndex}].initiativeStat`
		)?.message;
	}

	function npcName(creatureTypeId: StableId, identifier: string): string {
		const typeName = npcTypes.find((npcType) => npcType.id === creatureTypeId)?.name ?? 'NPC';
		return `${typeName} ${identifier}`.trim();
	}

	function targetTurns(): TurnTarget[] {
		return creatures.flatMap((creature) => {
			const name =
				creature.kind === 'character'
					? creature.name
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
			{#each factionCreatures as creature, index (creature.id)}
				{@const name =
					creature.kind === 'character'
						? creature.name
						: npcName(creature.creatureTypeId, creature.identifier)}
				<CreatureEditor
					{creature}
					{name}
					factionName={faction.name}
					canMoveUp={index > 0}
					canMoveDown={index < factionCreatures.length - 1}
					characterName={creature.kind === 'character' ? creature.name : ''}
					characterInitiativeStat={creature.kind === 'character'
						? creature.initiativeStat
						: undefined}
					characterInitiativeStatError={creature.kind === 'character'
						? characterInitiativeStatError(creature.id)
						: undefined}
					{npcTypes}
					targetTurns={targetTurns()}
					onVisibilityChange={onCreatureVisibilityChange}
					{onMoveTurn}
					onMove={(direction) => onMoveCreature(creature.id, direction)}
					{onNpcTypeChange}
					{onCharacterNameChange}
					{onCharacterInitiativeStatChange}
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
