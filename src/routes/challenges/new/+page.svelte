<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import {
		ChallengeLibraryStorageError,
		ChallengeLibraryValidationError,
		createUuid,
		getNextFactionColor,
		saveChallengeToLibrary,
		type Challenge
	} from '#lib/challenge';
	import { ErrorDisplay, ViewPage } from '#lib/components';

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
	let errorDetails = $state('');

	function describeSaveError(error: unknown): string {
		if (error instanceof ChallengeLibraryValidationError) {
			return [
				`${error.name}: ${error.message}`,
				...error.issues.map((issue) => `${issue.path}: ${issue.message}`)
			].join('\n');
		}
		if (error instanceof ChallengeLibraryStorageError) {
			return [
				`${error.name}: ${error.message}`,
				error.cause ? `${error.cause.name}: ${error.cause.message}` : ''
			]
				.filter(Boolean)
				.join('\n');
		}
		if (error instanceof Error) return `${error.name}: ${error.message}`;
		return 'An unexpected error occurred while saving.';
	}

	async function createChallenge() {
		errorDetails = '';
		try {
			await saveChallengeToLibrary($state.snapshot(challenge));
		} catch (error) {
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
	{#if errorDetails}
		<ErrorDisplay message="The new challenge could not be saved." details={errorDetails} />
		<button type="button" onclick={() => void createChallenge()}>Try again</button>
	{:else}
		<p>Preparing a new challenge setup.</p>
	{/if}
</ViewPage>
