<script lang="ts">
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		ChallengeLibraryStorageError,
		ChallengeLibraryValidationError,
		createUuid,
		getNextFactionColor,
		loadChallengeLibrary,
		saveChallengeToLibrary,
		type Challenge
	} from '#lib/challenge';

	type LoadStatus = 'loading' | 'ready' | 'error';

	let loadStatus = $state<LoadStatus>('loading');
	let challenges = $state<readonly Challenge[]>([]);
	let loadErrorDetails = $state('');
	let createErrorDetails = $state('');
	let isCreating = $state(false);
	let draftChallenge: Challenge | undefined;

	function describeError(error: unknown): string {
		if (error instanceof ChallengeLibraryValidationError) {
			return [
				`${error.name}: ${error.message}`,
				...error.issues.map((issue) => `${issue.path}: ${issue.message}`)
			].join('\n');
		}
		if (error instanceof ChallengeLibraryStorageError) {
			return [`${error.name}: ${error.message}`, error.cause ? error.cause.message : '']
				.filter(Boolean)
				.join('\n');
		}
		if (error instanceof Error) return `${error.name}: ${error.message}`;
		return 'An unexpected error occurred.';
	}

	async function loadChallenges(): Promise<void> {
		loadStatus = 'loading';
		loadErrorDetails = '';
		try {
			challenges = (await loadChallengeLibrary()).challenges;
			loadStatus = 'ready';
		} catch (error) {
			loadErrorDetails = describeError(error);
			loadStatus = 'error';
		}
	}

	function createDraftChallenge(): Challenge {
		const createdAt = new Date();
		const playersColor = getNextFactionColor([]);
		const enemiesColor = getNextFactionColor([{ color: playersColor }]);
		return {
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
		};
	}

	async function createChallenge(): Promise<void> {
		if (isCreating) return;
		isCreating = true;
		createErrorDetails = '';
		draftChallenge ??= createDraftChallenge();
		try {
			await saveChallengeToLibrary($state.snapshot(draftChallenge));
			await goto(resolve('/challenges/[challengeId]', { challengeId: draftChallenge.id }), {
				// eslint-disable-next-line @typescript-eslint/naming-convention -- SvelteKit fixes this option name
				replace: true
			});
		} catch (error) {
			createErrorDetails = describeError(error);
		} finally {
			isCreating = false;
		}
	}

	onMount(() => {
		void loadChallenges();
	});
</script>

<ViewPage title="Challenges">
	{#if loadStatus === 'loading'}
		<p>Loading saved challenges…</p>
	{:else if loadStatus === 'error'}
		{#if createErrorDetails}
			<ErrorDisplay message="The new challenge could not be saved." details={createErrorDetails} />
			<ActionButton variant="neutral" onclick={() => void createChallenge()}>Try again</ActionButton
			>
		{:else}
			<ErrorDisplay
				message="The saved challenges could not be loaded."
				details={loadErrorDetails}
			/>
			<ActionButton variant="neutral" onclick={() => void loadChallenges()}>Try again</ActionButton>
		{/if}
	{:else if challenges.length === 0}
		<p>No saved challenges yet.</p>
	{:else}
		<h2>Saved challenges</h2>
		<ul aria-label="Saved challenges">
			{#each challenges as challenge (challenge.id)}
				<li>
					<a href={resolve('/challenges/[challengeId]', { challengeId: challenge.id })}>
						{challenge.name || 'Untitled challenge'}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
	{#if createErrorDetails && loadStatus !== 'error'}
		<ErrorDisplay message="The new challenge could not be saved." details={createErrorDetails} />
		<ActionButton variant="neutral" onclick={() => void createChallenge()}>Try again</ActionButton>
	{/if}
	<ActionButton disabled={isCreating} onclick={() => void createChallenge()}>
		{isCreating ? 'Creating…' : 'Create new challenge'}
	</ActionButton>
</ViewPage>

<style>
	h2 {
		margin: 24px 0 12px;
		font-size: 18px;
		font-weight: 600;
	}

	ul {
		margin: 0 0 24px;
		padding-inline-start: 24px;
	}

	li + li {
		margin-top: 8px;
	}
</style>
