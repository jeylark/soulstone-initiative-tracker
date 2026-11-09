<script lang="ts">
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChallengeCard from './ChallengeCard.svelte';
	import {
		ChallengeLibraryStorageError,
		ChallengeLibraryValidationError,
		backupChallengeLibraryToJsonFile,
		createUuid,
		getNextFactionColor,
		loadChallengeLibraryWithDiagnostics,
		saveChallengeToLibrary,
		type Challenge
	} from '#lib/challenge';

	type LoadStatus = 'loading' | 'ready' | 'error';

	let loadStatus = $state<LoadStatus>('loading');
	let challenges = $state<readonly Challenge[]>([]);
	let loadErrorDetails = $state('');
	let unreadableDetails = $state('');
	let createErrorDetails = $state('');
	let downloadErrorDetails = $state('');
	let isCreating = $state(false);
	let isDownloading = $state(false);
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
		unreadableDetails = '';
		try {
			const result = await loadChallengeLibraryWithDiagnostics();
			challenges = result.library.challenges;
			unreadableDetails = result.unreadableChallenges
				.map((entry) =>
					[
						`${entry.name?.trim() || `Challenge ${entry.index + 1}`}${entry.id ? ` (${entry.id})` : ''}`,
						...entry.issues.map((issue) => `${issue.path}: ${issue.message}`)
					].join('\n')
				)
				.join('\n\n');
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

	async function downloadLibrary(): Promise<void> {
		if (isDownloading) return;
		isDownloading = true;
		downloadErrorDetails = '';
		try {
			await backupChallengeLibraryToJsonFile();
		} catch (error) {
			downloadErrorDetails = describeError(error);
		} finally {
			isDownloading = false;
		}
	}

	onMount(() => {
		void loadChallenges();
	});
</script>

<ViewPage title="Challenges">
	{#if loadStatus === 'ready' && unreadableDetails}
		<ErrorDisplay
			message="Some saved challenges could not be loaded."
			details={unreadableDetails}
		/>
	{/if}
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
		<div class="challenge-cards" role="list" aria-label="Saved challenges">
			{#each challenges as challenge (challenge.id)}
				<div role="listitem">
					<ChallengeCard {challenge} />
				</div>
			{/each}
		</div>
	{/if}
	{#if createErrorDetails && loadStatus !== 'error'}
		<ErrorDisplay message="The new challenge could not be saved." details={createErrorDetails} />
		<ActionButton variant="neutral" onclick={() => void createChallenge()}>Try again</ActionButton>
	{/if}
	<ActionButton disabled={isCreating} onclick={() => void createChallenge()}>
		{isCreating ? 'Creating…' : 'Create new challenge'}
	</ActionButton>
	{#if downloadErrorDetails}
		<ErrorDisplay
			message="The challenge library could not be downloaded."
			details={downloadErrorDetails}
		/>
	{/if}
	<ActionButton disabled={isDownloading} onclick={() => void downloadLibrary()}>
		{isDownloading ? 'Downloading…' : 'Download Library'}
	</ActionButton>
</ViewPage>

<style>
	h2 {
		margin: 24px 0 12px;
		font-size: 18px;
		font-weight: 600;
	}

	.challenge-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 360px));
		gap: 12px;
		margin: 0 0 24px;
	}
</style>
