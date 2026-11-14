<script lang="ts">
	import type { DeepReadonly } from '#lib';
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
	import { ColorPickerInput, EntityList, TextInput } from '#lib/components';

	interface Props {
		faction?: Readonly<Faction>;
		factions?: readonly Faction[];
		creatures: readonly ChallengeCreature[];
		npcTypes: readonly NpcType[];
		setupIssues: readonly ValidationIssue[];
		factionIndex: number;
		npcTypeId: StableId | '';
		canManageFactions: boolean;
		canManageCreaturesAndTurns: boolean;
		isCreatureConfigurable: (creatureId: StableId) => boolean;
		isTurnConfigurable: (turnId: StableId) => boolean;
		onRename: (factionId: StableId, name: string) => void;
		onColorChange: (factionId: StableId, color: FactionColor) => void;
		onCreateCharacter: (factionId: StableId) => void;
		onCreateNpc: (factionId: StableId) => void;
		onCreatureVisibilityChange: (creatureId: StableId, isHidden: boolean) => void;
		onCreatureFactionChange?: (creatureId: StableId, factionId: StableId) => void;
		onNpcTypeChange: (creatureId: StableId, npcTypeId: StableId) => boolean;
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
		factions = [],
		creatures,
		npcTypes,
		setupIssues,
		factionIndex,
		npcTypeId,
		canManageFactions,
		canManageCreaturesAndTurns,
		isCreatureConfigurable,
		isTurnConfigurable,
		onRename,
		onColorChange,
		onCreateCharacter,
		onCreateNpc,
		onCreatureVisibilityChange,
		onCreatureFactionChange,
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
		creatures.filter((creature) =>
			faction
				? creature.factionId === faction.id
				: !factions.some((item) => item.id === creature.factionId)
		)
	);

	let factionNameError = $derived(issueMessage(setupIssues, `$.factions[${factionIndex}].name`));

	function npcName(creatureTypeId: StableId, identifier: string): string {
		const typeName = npcTypes.find((npcType) => npcType.id === creatureTypeId)?.name ?? 'NPC';
		return `${typeName} ${identifier}`.trim();
	}

	function creatureDisplayName(creature: DeepReadonly<ChallengeCreature>): string {
		return creature.kind === 'character'
			? creature.name
			: npcName(creature.creatureTypeId, creature.identifier);
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

	function siblingCount(turnId: StableId): number {
		const turn = creatures.flatMap((creature) => creature.turns).find((item) => item.id === turnId);
		if (turn?.initiative.kind !== 'relative-position') return 0;
		const { targetTurnId, relation } = turn.initiative;
		return creatures.reduce(
			(count, creature) =>
				count +
				creature.turns.filter((item) => {
					const initiative = item.initiative;
					return (
						initiative.kind === 'relative-position' &&
						initiative.targetTurnId === targetTurnId &&
						initiative.relation === relation
					);
				}).length,
			0
		);
	}
</script>

{#snippet creatureList()}
	<EntityList
		layout={faction ? 'grid' : 'stack'}
		entities={factionCreatures}
		adds={faction
			? [
					{
						label: 'Add Player',
						isDisabled: !canManageCreaturesAndTurns,
						onAdd: () => onCreateCharacter(faction.id)
					},
					{
						label: 'Add NPC',
						isDisabled: !canManageCreaturesAndTurns || !npcTypeId,
						onAdd: () => onCreateNpc(faction.id)
					}
				]
			: []}
		legendSelector={creatureDisplayName}
		removeLabelSelector={(creature) => `Remove ${creatureDisplayName(creature)}`}
		itemOptionsSelector={(creature) => ({
			headingLevel: 'h4',
			headerSize: 'medium',
			spacing: 'compact',
			removeText: 'Remove creature',
			isRemoveDisabled: !canManageCreaturesAndTurns,
			fieldsetAttributes: {
				class: 'creature',
				['data-entity-id']: creature.id,
				['aria-label']: creatureDisplayName(creature)
			}
		})}
		onRemove={(creature) => onRemoveCreature(creature.id)}
	>
		{#snippet entityEditor(creature)}
			{@const name = creatureDisplayName(creature)}
			<CreatureEditor
				{creature}
				{name}
				characterName={creature.kind === 'character' ? creature.name : ''}
				characterInitiativeStat={creature.kind === 'character'
					? creature.initiativeStat
					: undefined}
				{setupIssues}
				issuePath={`$.creatures[${creatures.findIndex((item) => item.id === creature.id)}]`}
				{npcTypes}
				{factions}
				targetTurns={targetTurns()}
				{siblingCount}
				{canManageCreaturesAndTurns}
				isConfigurable={isCreatureConfigurable(creature.id)}
				{isTurnConfigurable}
				onFactionChange={faction ? undefined : onCreatureFactionChange}
				onVisibilityChange={onCreatureVisibilityChange}
				{onNpcTypeChange}
				{onCharacterNameChange}
				{onCharacterInitiativeStatChange}
				{onNpcIdentifierChange}
				{onTurnChange}
				{onAddTurn}
				{onRemoveTurn}
			/>
		{/snippet}
	</EntityList>
{/snippet}

{#if faction}
	<div>
		<fieldset disabled={!canManageFactions}>
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
				isDisabled={!canManageFactions}
				onchange={(color) => onColorChange(faction.id, color)}
			/>
		</fieldset>

		{@render creatureList()}
	</div>
{:else}
	<section aria-label="Unassigned creatures">
		<h3>Unassigned creatures</h3>
		{@render creatureList()}
	</section>
{/if}
