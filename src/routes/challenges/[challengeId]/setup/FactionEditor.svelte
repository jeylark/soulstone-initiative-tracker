<script lang="ts">
	import {
		FACTION_COLORS,
		type ChallengeCreature,
		type Faction,
		type FactionColor,
		type NpcType,
		type StableId,
		type ValidationIssue
	} from '#lib/challenge';
	import type { TurnEditorChange, TurnTarget } from './challenge-setup-types';
	import CreatureEditor from './CreatureEditor.svelte';
	import { issueMessage } from './issue-messages';
	import {
		ActionButton,
		Card,
		ColorPickerInput,
		EntityList,
		EntityListItem,
		TextInput
	} from '#lib/components';

	interface Props {
		faction: Readonly<Faction>;
		creatures: readonly ChallengeCreature[];
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		factionIndex: number;
		npcTypeId: StableId | '';
		onRename: (factionId: StableId, name: string) => void;
		onColorChange: (factionId: StableId, color: FactionColor) => void;
		onRemove: (factionId: StableId) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
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
		factionIndex,
		npcTypeId,
		onRename,
		onColorChange,
		onRemove,
		onCreateCharacter,
		onCreateNpc,
		onCreatureVisibilityChange,
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

	let factionNameError = $derived(issueMessage(setupIssues, `$.factions[${factionIndex}].name`));

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
		removeText="Remove faction"
		onRemove={() => onRemove(faction.id)}
	>
		<TextInput
			label="Faction name"
			aria-label={`Faction name: ${faction.name}`}
			value={faction.name}
			isInvalid={factionNameError !== undefined}
			invalidMessage={factionNameError}
			oninput={(event) => onRename(faction.id, event.currentTarget.value)}
		/>
		<ColorPickerInput
			label={`Faction color for ${faction.name}`}
			name={`faction-color-${faction.id}`}
			options={FACTION_COLORS}
			value={faction.color}
			onchange={(color) => onColorChange(faction.id, color)}
		/>

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
						? creature.name
						: npcName(creature.creatureTypeId, creature.identifier)}
				<CreatureEditor
					{creature}
					{name}
					characterName={creature.kind === 'character' ? creature.name : ''}
					characterInitiativeStat={creature.kind === 'character'
						? creature.initiativeStat
						: undefined}
					{setupIssues}
					issuePath={`$.creatures[${creatures.indexOf(creature)}]`}
					{npcTypes}
					targetTurns={targetTurns()}
					onVisibilityChange={onCreatureVisibilityChange}
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
