<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { createUuid, saveChallengeToLibrary, type Challenge } from '#lib';
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
	let errorMessage = $state('');

	async function createChallenge() {
		errorMessage = '';
		try {
			await saveChallengeToLibrary($state.snapshot(challenge));
		} catch {
			errorMessage = 'The new challenge could not be saved.';
			return;
		}
		await goto(resolve('/challenges/[challengeId]/setup', { challengeId: challenge.id }), {
			// eslint-disable-next-line @typescript-eslint/naming-convention -- SvelteKit fixes this option name
			replace: true
		});
	}

	onMount(() => {
		void createChallenge();
	});
</script>

<ViewPage title="New challenge">
	{#if errorMessage}
		<p role="alert">{errorMessage}</p>
		<button type="button" onclick={() => void createChallenge()}>Try again</button>
	{:else}
		<p>Preparing a new challenge setup.</p>
	{/if}
</ViewPage>
