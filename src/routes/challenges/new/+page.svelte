<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { createUuid, type Challenge, type PlayerCharacter } from '#lib';
	import { getNextFactionColor } from '#lib/challenge/faction-colors.js';
	import ViewPage from '#lib/components/ViewPage.svelte';

	const createdAt = new Date();
	const playersColor = getNextFactionColor([]);
	const enemiesColor = getNextFactionColor([{ color: playersColor }]);
	let challenge = $state<Challenge>({
		id: createUuid(),
		name: '',
		createdAt,
		updatedAt: createdAt,
		factions: [
			{ id: createUuid(), name: 'Players', color: playersColor },
			{ id: createUuid(), name: 'Enemies', color: enemiesColor }
		],
		npcTypes: [],
		fairnessWeight: 3,
		creatures: []
	});
	let reusableCharacters = $state<PlayerCharacter[]>([]);

	onMount(() => {
		void goto(resolve('/challenges/[challengeId]/setup', { challengeId: challenge.id }), {
			// eslint-disable-next-line @typescript-eslint/naming-convention -- SvelteKit fixes this option name
			replace: true,
			// eslint-disable-next-line @typescript-eslint/naming-convention -- SvelteKit fixes this option name
			persistState: true,
			state: {
				challenge: $state.snapshot(challenge),
				reusableCharacters: $state.snapshot(reusableCharacters)
			}
		});
	});
</script>

<ViewPage title="New challenge">
	<p>Preparing a new challenge setup.</p>
</ViewPage>
