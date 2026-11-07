<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { createUuid, saveChallengeToLibrary, type Challenge } from '#lib';
	import { getNextFactionColor } from '#lib/challenge/faction-colors.js';
	import {
		ChallengeLibraryStorageError,
		ChallengeLibraryValidationError
	} from '#lib/challenge/storage.js';
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
	let errorDetails = $state('');

	function describeSaveError(error: unknown): string {
		if (error instanceof ChallengeLibraryValidationError) {
			const issues = error.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
			return `${error.name}: ${error.message} ${issues}`;
		}
		if (error instanceof ChallengeLibraryStorageError) {
			const cause = error.cause ? ` (${error.cause.name}: ${error.cause.message})` : '';
			return `${error.name}: ${error.message}${cause}`;
		}
		if (error instanceof Error) return `${error.name}: ${error.message}`;
		return 'An unexpected error occurred while saving.';
	}

	async function createChallenge() {
		errorMessage = '';
		errorDetails = '';
		try {
			await saveChallengeToLibrary($state.snapshot(challenge));
		} catch (error) {
			errorMessage = 'The new challenge could not be saved.';
			errorDetails = describeSaveError(error);
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
		<div role="alert">
			<p>{errorMessage}</p>
			<p>{errorDetails}</p>
		</div>
		<button type="button" onclick={() => void createChallenge()}>Try again</button>
	{:else}
		<p>Preparing a new challenge setup.</p>
	{/if}
</ViewPage>
