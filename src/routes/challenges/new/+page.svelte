<script lang="ts">
	import {
		DEFAULT_INITIATIVE_ROLL_MODES,
		createUuid,
		type Challenge,
		type Faction,
		type NpcType,
		type PlayerCharacter,
		type StableId,
		type Turn,
		type TurnInitiative
	} from '#lib';
	import ViewPage from '#lib/components/ViewPage.svelte';

	type InitiativeChoice =
		| 'none'
		| 'roll'
		| 'static'
		| 'fixed-top'
		| 'fixed-bottom'
		| 'relative-before'
		| 'relative-after';

	const createdAt = new Date();
	let challenge = $state<Challenge>({
		id: createUuid(),
		name: '',
		createdAt,
		updatedAt: createdAt,
		factions: [],
		npcTypes: [],
		initiativeRollModes: { ...DEFAULT_INITIATIVE_ROLL_MODES },
		fairnessWeight: 0,
		creatures: []
	});
	let reusableCharacters = $state<PlayerCharacter[]>([]);
	let isAddingFaction = $state(false);
	let isAddingNpcType = $state(false);
	let newFactionName = $state('');
	let newNpcTypeName = $state('');
	let newNpcInitiativeStat = $state(1);
	let newCharacterName = $state('');
	let newCharacterFactionId = $state<StableId | ''>('');
	let newNpcTypeId = $state<StableId | ''>('');
	let newNpcIdentifier = $state('');

	function addFaction() {
		const name = newFactionName.trim();
		if (!name) return;

		const faction = { id: createUuid(), name } satisfies Faction;
		challenge.factions.push(faction);
		newCharacterFactionId ||= faction.id;
		newFactionName = '';
		isAddingFaction = false;
	}

	function removeFaction(factionId: StableId) {
		if (challenge.creatures.some((creature) => creature.factionId === factionId)) return;
		challenge.factions = challenge.factions.filter((faction) => faction.id !== factionId);
		if (newCharacterFactionId === factionId) {
			newCharacterFactionId = challenge.factions[0]?.id ?? '';
		}
	}

	function addNpcType() {
		const name = newNpcTypeName.trim();
		if (!name || !Number.isSafeInteger(newNpcInitiativeStat) || newNpcInitiativeStat < 1) return;

		const npcType = {
			id: createUuid(),
			name,
			initiativeStat: newNpcInitiativeStat
		} satisfies NpcType;
		challenge.npcTypes.push(npcType);
		newNpcTypeId ||= npcType.id;
		newNpcTypeName = '';
		newNpcInitiativeStat = 1;
		isAddingNpcType = false;
	}

	function removeNpcType(npcTypeId: StableId) {
		if (
			challenge.creatures.some(
				(creature) => creature.kind === 'npc' && creature.creatureTypeId === npcTypeId
			)
		) {
			return;
		}
		challenge.npcTypes = challenge.npcTypes.filter((npcType) => npcType.id !== npcTypeId);
		if (newNpcTypeId === npcTypeId) newNpcTypeId = challenge.npcTypes[0]?.id ?? '';
	}

	function createTurn(): Turn {
		return { id: createUuid(), isHidden: false, initiative: { kind: 'roll' } };
	}

	function addCharacter() {
		const name = newCharacterName.trim();
		if (!name || !newCharacterFactionId) return;

		const character = { id: createUuid(), name } satisfies PlayerCharacter;
		reusableCharacters.push(character);
		challenge.creatures.push({
			id: createUuid(),
			kind: 'character',
			characterId: character.id,
			factionId: newCharacterFactionId,
			turns: [createTurn()]
		});
		newCharacterName = '';
	}

	function addNpc() {
		const identifier = newNpcIdentifier.trim();
		if (!identifier || !newNpcTypeId || !newCharacterFactionId) return;

		challenge.creatures.push({
			id: createUuid(),
			kind: 'npc',
			creatureTypeId: newNpcTypeId,
			identifier,
			factionId: newCharacterFactionId,
			turns: [createTurn()]
		});
		newNpcIdentifier = '';
	}

	function characterName(characterId: StableId): string {
		return (
			reusableCharacters.find((character) => character.id === characterId)?.name ?? 'Character'
		);
	}

	function npcName(creatureTypeId: StableId, identifier: string): string {
		const typeName =
			challenge.npcTypes.find((npcType) => npcType.id === creatureTypeId)?.name ?? 'NPC';
		return `${typeName} ${identifier}`.trim();
	}

	function updateCharacterName(characterId: StableId, name: string) {
		const character = reusableCharacters.find((item) => item.id === characterId);
		if (character) character.name = name;
	}

	function initiativeChoice(initiative: Readonly<TurnInitiative> | null): InitiativeChoice {
		if (!initiative) return 'none';
		if (initiative.kind === 'roll' || initiative.kind === 'static') return initiative.kind;
		if (initiative.kind === 'fixed-position') {
			return initiative.from === 'top' ? 'fixed-top' : 'fixed-bottom';
		}
		return `relative-${initiative.relation}`;
	}

	function setTurnInitiative(creatureId: StableId, choice: InitiativeChoice) {
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		const turn = creature?.turns[0];
		if (!turn) return;

		const otherTurn = challenge.creatures.find((item) => item.id !== creatureId)?.turns[0];
		if (choice === 'none') turn.initiative = null;
		else if (choice === 'roll') turn.initiative = { kind: 'roll' };
		else if (choice === 'static') turn.initiative = { kind: 'static', value: 0 };
		else if (choice === 'fixed-top' || choice === 'fixed-bottom') {
			turn.initiative = {
				kind: 'fixed-position',
				from: choice === 'fixed-top' ? 'top' : 'bottom',
				position: 1
			};
		} else if (otherTurn) {
			turn.initiative = {
				kind: 'relative-position',
				relation: choice === 'relative-before' ? 'before' : 'after',
				distance: 1,
				targetTurnId: otherTurn.id
			};
		}
	}

	function removeCreature(creatureId: StableId) {
		challenge.creatures = challenge.creatures.filter((creature) => creature.id !== creatureId);
	}
</script>

<ViewPage title="New challenge">
	<div class="setup">
		<section class="settings" aria-labelledby="challenge-settings-heading">
			<h2 id="challenge-settings-heading">Challenge settings</h2>
			<label>
				<span>Challenge name</span>
				<input bind:value={challenge.name} autocomplete="off" />
			</label>
			<label>
				<span>Fairness weight</span>
				<input bind:value={challenge.fairnessWeight} type="number" min="0" step="1" />
			</label>
			<label>
				<span>Character initiative</span>
				<select bind:value={challenge.initiativeRollModes.characters}>
					<option value="manual">Enter results manually</option>
					<option value="app">Roll in the app</option>
				</select>
			</label>
			<label>
				<span>NPC initiative</span>
				<select bind:value={challenge.initiativeRollModes.npcs}>
					<option value="manual">Enter results manually</option>
					<option value="app">Roll in the app</option>
				</select>
			</label>
		</section>

		<section class="setup-section" aria-labelledby="factions-heading">
			<div class="section-heading">
				<h2 id="factions-heading">Factions</h2>
				<button type="button" onclick={() => (isAddingFaction = true)}>Add faction</button>
			</div>
			{#if challenge.factions.length > 0}
				<ul class="entity-list">
					{#each challenge.factions as faction (faction.id)}
						<li>
							<label>
								<span>Faction name</span>
								<input aria-label={`Faction name: ${faction.name}`} bind:value={faction.name} />
							</label>
							<button
								class="quiet-button"
								type="button"
								disabled={challenge.creatures.some((creature) => creature.factionId === faction.id)}
								aria-label={`Remove faction ${faction.name}`}
								title="Factions assigned to creatures cannot be removed"
								onclick={() => removeFaction(faction.id)}
							>
								Remove
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if isAddingFaction}
				<form
					class="inline-form"
					onsubmit={(event) => {
						event.preventDefault();
						addFaction();
					}}
				>
					<label>
						<span>New faction name</span>
						<input bind:value={newFactionName} required />
					</label>
					<button type="submit">Save faction</button>
					<button class="quiet-button" type="button" onclick={() => (isAddingFaction = false)}>
						Cancel
					</button>
				</form>
			{/if}
		</section>

		<section class="setup-section" aria-labelledby="npc-types-heading">
			<div class="section-heading">
				<h2 id="npc-types-heading">NPC types</h2>
				<button type="button" onclick={() => (isAddingNpcType = true)}>Add NPC type</button>
			</div>
			{#if challenge.npcTypes.length > 0}
				<ul class="entity-list">
					{#each challenge.npcTypes as npcType (npcType.id)}
						<li>
							<label>
								<span>NPC type name</span>
								<input aria-label={`NPC type name: ${npcType.name}`} bind:value={npcType.name} />
							</label>
							<label>
								<span>Initiative stat (d6)</span>
								<input
									aria-label={`Initiative stat for ${npcType.name}`}
									bind:value={npcType.initiativeStat}
									type="number"
									min="1"
									step="1"
								/>
							</label>
							<input bind:value={newFactionName} required />
							<button
								class="quiet-button"
								type="button"
								disabled={challenge.creatures.some(
									(creature) => creature.kind === 'npc' && creature.creatureTypeId === npcType.id
								)}
								aria-label={`Remove NPC type ${npcType.name}`}
								title="Types used by creatures cannot be removed"
								onclick={() => removeNpcType(npcType.id)}
							>
								Remove
							</button>
						</li>
					{/each}
				</ul>
			{/if}
			{#if isAddingNpcType}
				<form
					class="inline-form"
					onsubmit={(event) => {
						event.preventDefault();
						addNpcType();
					}}
				>
					<label>
						<span>New NPC type name</span>
						<input bind:value={newNpcTypeName} required />
						<input bind:value={newNpcTypeName} required />
					</label>
					<label>
						<span>Initiative stat (d6)</span>
						<input bind:value={newNpcInitiativeStat} type="number" min="1" step="1" required />
					</label>
					<button type="submit">Save NPC type</button>
					<button class="quiet-button" type="button" onclick={() => (isAddingNpcType = false)}>
						Cancel
					</button>
				</form>
			{/if}
		</section>

		<section class="setup-section" aria-labelledby="creatures-heading">
			<div class="section-heading">
				<h2 id="creatures-heading">Creatures</h2>
			</div>
			<div class="add-creature-forms">
				<form
					class="inline-form"
					onsubmit={(event) => {
						event.preventDefault();
						addCharacter();
					}}
				>
					<h3>Player character</h3>
					<label>
						<span>Character name</span>
						<input bind:value={newCharacterName} autocomplete="off" required />
					</label>
					<label>
						<span>Faction</span>
						<select
							bind:value={newCharacterFactionId}
							required
							disabled={!challenge.factions.length}
						>
							<option value="" disabled>Select a faction</option>
							{#each challenge.factions as faction (faction.id)}
								<option value={faction.id}>{faction.name}</option>
							{/each}
						</select>
					</label>
					<button type="submit" disabled={!challenge.factions.length}>Add character</button>
				</form>
				<form
					class="inline-form"
					onsubmit={(event) => {
						event.preventDefault();
						addNpc();
					}}
				>
					<h3>NPC</h3>
					<label>
						<span>NPC type</span>
						<select bind:value={newNpcTypeId} required disabled={!challenge.npcTypes.length}>
							<option value="" disabled>Select an NPC type</option>
							{#each challenge.npcTypes as npcType (npcType.id)}
								<option value={npcType.id}>{npcType.name}</option>
							{/each}
						</select>
					</label>
					<label>
						<span>NPC identifier</span>
						<input bind:value={newNpcIdentifier} autocomplete="off" required />
					</label>
					<label>
						<span>Faction</span>
						<select
							bind:value={newCharacterFactionId}
							required
							disabled={!challenge.factions.length}
						>
							<option value="" disabled>Select a faction</option>
							{#each challenge.factions as faction (faction.id)}
								<option value={faction.id}>{faction.name}</option>
							{/each}
						</select>
					</label>
					<button type="submit" disabled={!challenge.factions.length || !challenge.npcTypes.length}>
						Add NPC
					</button>
				</form>
			</div>

			{#if challenge.creatures.length > 0}
				<div class="creature-list">
					{#each challenge.creatures as creature (creature.id)}
						{@const name =
							creature.kind === 'character'
								? characterName(creature.characterId)
								: npcName(creature.creatureTypeId, creature.identifier)}
						<fieldset class="creature" aria-label={name}>
							<legend>{name}</legend>
							<label>
								<span>Faction</span>
								<select bind:value={creature.factionId}>
									{#each challenge.factions as faction (faction.id)}
										<option value={faction.id}>{faction.name}</option>
									{/each}
								</select>
							</label>
							{#if creature.kind === 'character'}
								<label>
									<span>Character name</span>
									<input
										aria-label={`Character name: ${characterName(creature.characterId)}`}
										value={reusableCharacters.find(
											(character) => character.id === creature.characterId
										)?.name ?? ''}
										oninput={(event) =>
											updateCharacterName(creature.characterId, event.currentTarget.value)}
									/>
								</label>
							{:else if creature.kind === 'npc'}
								<label>
									<span>NPC identifier</span>
									<input bind:value={creature.identifier} />
								</label>
							{/if}
							{#each creature.turns as turn (turn.id)}
								<div class="turn-settings">
									<label>
										<span>Turn initiative</span>
										<select
											value={initiativeChoice(turn.initiative)}
											onchange={(event) =>
												setTurnInitiative(
													creature.id,
													event.currentTarget.value as InitiativeChoice
												)}
										>
											<option value="none">No initiative</option>
											<option value="roll">Roll or enter a result</option>
											<option value="static">Static value</option>
											<option value="fixed-top">Fixed position from top</option>
											<option value="fixed-bottom">Fixed position from bottom</option>
											<option
												value="relative-before"
												disabled={!challenge.creatures.some((item) => item.id !== creature.id)}
											>
												Before another turn
											</option>
											<option
												value="relative-after"
												disabled={!challenge.creatures.some((item) => item.id !== creature.id)}
											>
												After another turn
											</option>
										</select>
									</label>
									{#if turn.initiative?.kind === 'static'}
										<label>
											<span>Static initiative</span>
											<input bind:value={turn.initiative.value} type="number" step="1" />
										</label>
									{:else if turn.initiative?.kind === 'fixed-position'}
										<label>
											<span>Count from</span>
											<select bind:value={turn.initiative.from}>
												<option value="top">Top</option>
												<option value="bottom">Bottom</option>
											</select>
										</label>
										<label>
											<span>Position</span>
											<input bind:value={turn.initiative.position} type="number" min="1" step="1" />
										</label>
									{:else if turn.initiative?.kind === 'relative-position'}
										<label>
											<span>Relationship</span>
											<select bind:value={turn.initiative.relation}>
												<option value="before">Before</option>
												<option value="after">After</option>
											</select>
										</label>
										<label>
											<span>Distance</span>
											<input bind:value={turn.initiative.distance} type="number" min="0" step="1" />
										</label>
										<label>
											<span>Target turn</span>
											<select bind:value={turn.initiative.targetTurnId}>
												{#each challenge.creatures.filter((item) => item.id !== creature.id) as target (target.id)}
													<option value={target.turns[0].id}>
														{target.kind === 'character'
															? characterName(target.characterId)
															: npcName(target.creatureTypeId, target.identifier)}
													</option>
												{/each}
											</select>
										</label>
									{/if}
								</div>
							{/each}
							<button
								class="quiet-button"
								type="button"
								aria-label={`Remove ${name}`}
								onclick={() => removeCreature(creature.id)}
							>
								Remove creature
							</button>
						</fieldset>
					{/each}
				</div>
			{/if}
		</section>
	</div>
</ViewPage>

<style>
	.setup {
		max-width: 1080px;
	}

	h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}

	h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 600;
	}

	.settings,
	.add-creature-forms {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 16px 24px;
	}

	.settings {
		padding-bottom: 24px;
	}

	.setup-section {
		padding-block: 20px 24px;
		border-top: 1px solid var(--color-border);
	}

	.section-heading,
	.entity-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.section-heading {
		margin-bottom: 12px;
	}

	.entity-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.entity-list li {
		min-height: 40px;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.inline-form {
		display: flex;
		align-items: end;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 12px;
	}

	.add-creature-forms .inline-form {
		align-items: end;
		padding-block: 12px;
	}

	.inline-form h3 {
		flex-basis: 100%;
	}

	label {
		display: grid;
		flex: 1 1 180px;
		gap: 6px;
		min-width: 0;
		font-size: 14px;
	}

	input,
	select,
	button {
		min-height: 40px;
		border: 1px solid var(--color-border-subtle);
		border-radius: 4px;
		font: inherit;
	}

	input,
	select {
		width: 100%;
		padding: 8px 10px;
		color: var(--color-foreground);
		background: var(--color-background);
	}

	button {
		padding: 8px 14px;
		color: white;
		border-color: var(--color-accent);
		background: var(--color-accent);
		cursor: pointer;
	}

	.quiet-button {
		color: var(--color-foreground);
		border-color: transparent;
		background: transparent;
	}

	button:disabled,
	select:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	:where(input, select, button):focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-ring-offset);
	}

	.creature-list {
		display: grid;
		gap: 16px;
		margin-top: 16px;
	}

	.creature {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: end;
		gap: 14px 20px;
		min-width: 0;
		margin: 0;
		padding: 16px 0;
		border: 0;
		border-top: 1px solid var(--color-border-subtle);
	}

	.creature legend {
		padding: 0 8px 0 0;
		font-size: 17px;
		font-weight: 600;
	}

	.turn-settings {
		display: contents;
	}

	.creature > button {
		justify-self: start;
	}

	@media (max-width: 640px) {
		.settings,
		.add-creature-forms,
		.creature {
			grid-template-columns: minmax(0, 1fr);
		}

		.inline-form > button {
			flex: 1 1 auto;
		}
	}
</style>
