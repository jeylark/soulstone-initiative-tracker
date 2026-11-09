type Transform = (value: unknown) => unknown;

function pickFields(
	value: unknown,
	fields: readonly string[],
	transforms: Readonly<Record<string, Transform>> = {}
): unknown {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
	const record = value as Readonly<Record<string, unknown>>;
	return Object.fromEntries(
		fields
			.filter((field) => Object.hasOwn(record, field))
			.map((field) => [field, transforms[field] ? transforms[field](record[field]) : record[field]])
	);
}

function mapItems(value: unknown, transform: Transform): unknown {
	return Array.isArray(value) ? Array.from(value, transform) : value;
}

function getKind(value: unknown): unknown {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Readonly<Record<string, unknown>>).kind
		: undefined;
}

function sanitizeInitiative(value: unknown): unknown {
	switch (getKind(value)) {
		case 'roll':
			return pickFields(value, ['kind', 'mode']);
		case 'static':
			return pickFields(value, ['kind', 'value']);
		case 'fixed-position':
			return pickFields(value, ['kind', 'from', 'position']);
		case 'relative-position':
			return pickFields(value, ['kind', 'relation', 'index', 'targetTurnId']);
		default:
			return pickFields(value, [
				'kind',
				'mode',
				'value',
				'from',
				'position',
				'relation',
				'index',
				'targetTurnId'
			]);
	}
}

function sanitizeCreature(value: unknown): unknown {
	const commonFields = ['id', 'kind', 'factionId', 'isHidden', 'turns'];
	const fields =
		getKind(value) === 'character'
			? [...commonFields, 'name', 'initiativeStat']
			: getKind(value) === 'npc'
				? [...commonFields, 'creatureTypeId', 'identifier']
				: [...commonFields, 'name', 'initiativeStat', 'creatureTypeId', 'identifier'];
	return pickFields(value, fields, {
		turns: (turns) =>
			mapItems(turns, (turn) =>
				pickFields(turn, ['id', 'initiative'], { initiative: sanitizeInitiative })
			)
	});
}

function sanitizeRunState(value: unknown): unknown {
	return pickFields(
		value,
		['initiativeResults', 'generatedTurnOrder', 'spawnCount', 'tieDecisions', 'spawnEdit'],
		{
			spawnEdit: (edit) =>
				pickFields(
					edit,
					['newCreatureIds', 'newNpcTypeIds', 'newTurnIds', 'lockedInitiativeTurnIds'],
					Object.fromEntries(
						['newCreatureIds', 'newNpcTypeIds', 'newTurnIds', 'lockedInitiativeTurnIds'].map(
							(key) => [key, (ids: unknown) => mapItems(ids, (id) => id)]
						)
					)
				),
			initiativeResults: (results) =>
				typeof results === 'object' && results !== null && !Array.isArray(results)
					? Object.fromEntries(Object.entries(results))
					: results,
			tieDecisions: (decisions) =>
				mapItems(decisions, (decision) => mapItems(decision, (id) => id)),
			generatedTurnOrder: (order) =>
				mapItems(order, (entry) =>
					pickFields(entry, getKind(entry) === 'spawn' ? ['kind'] : ['kind', 'turnId'])
				)
		}
	);
}

function sanitizeChallenge(value: unknown): unknown {
	return pickFields(
		value,
		[
			'id',
			'name',
			'createdAt',
			'updatedAt',
			'factions',
			'npcTypes',
			'fairnessWeight',
			'creatures',
			'runState'
		],
		{
			factions: (factions) =>
				mapItems(factions, (faction) => pickFields(faction, ['id', 'name', 'color'])),
			npcTypes: (types) =>
				mapItems(types, (npcType) => pickFields(npcType, ['id', 'name', 'initiativeStat'])),
			creatures: (creatures) => mapItems(creatures, sanitizeCreature),
			runState: sanitizeRunState
		}
	);
}

/**
 * Removes fields outside the current model without coercing or validating known data.
 * @param value Untrusted library data; malformed known fields remain available for diagnostics.
 * @returns Sanitized unknown data, preserving dates, identifiers, order and dynamic result keys.
 */
export function sanitizeChallengeLibraryData(value: unknown): unknown {
	return pickFields(value, ['formatVersion', 'challenges'], {
		challenges: (challenges) => mapItems(challenges, sanitizeChallenge)
	});
}
