<script lang="ts">
	import { ActionButton, ErrorDisplay, SelectInput, ViewPage } from '#lib/components';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChallengeCard from './ChallengeCard.svelte';
	import NewChallengeCard from './NewChallengeCard.svelte';
	import {
		ChallengeLibraryStorageError,
		ChallengeLibraryValidationError,
		ChallengeJsonFileError,
		backupChallengeLibraryToJsonFile,
		createUuid,
		getNextFactionColor,
		loadChallengeLibraryWithDiagnostics,
		prepareChallengeImport,
		readChallengeLibraryJsonFile,
		saveChallengesToLibrary,
		saveChallengeToLibrary,
		type Challenge,
		type ChallengeLibrary
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
	let isUploading = $state(false);
	let uploadErrorDetails = $state('');
	let importMessage = $state('');
	let fileInput: HTMLInputElement;
	let importHeading = $state<HTMLHeadingElement>();
	let pendingLibrary = $state<ChallengeLibrary>();
	let conflicts = $state<readonly Readonly<{ id: string; name: string; canReplace: boolean }>[]>(
		[]
	);
	let resolutions = $state<Record<string, string>>({});
	let hasUnresolvedConflicts = $derived(conflicts.some(({ id }) => !resolutions[id]));
	let draftChallenge: Challenge | undefined;

	function describeError(error: unknown): string {
		if (
			error instanceof ChallengeLibraryValidationError ||
			error instanceof ChallengeJsonFileError
		) {
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

	async function uploadLibrary(): Promise<void> {
		const file = fileInput.files?.[0];
		fileInput.value = '';
		if (!file || isUploading) return;
		isUploading = true;
		uploadErrorDetails = '';
		importMessage = '';
		try {
			const imported = await readChallengeLibraryJsonFile(file);
			const current = await loadChallengeLibraryWithDiagnostics();
			conflicts = imported.challenges.flatMap((challenge) => {
				const id = challenge.id.toLowerCase();
				const hasReadable = current.library.challenges.some(
					(saved) => saved.id.toLowerCase() === id
				);
				const hasUnreadable = current.unreadableChallenges.some(
					(saved) => saved.id?.toLowerCase() === id
				);
				return hasReadable || hasUnreadable
					? [
							{
								id: challenge.id,
								name: challenge.name.trim() || 'Unnamed challenge',
								canReplace: hasReadable
							}
						]
					: [];
			});
			resolutions = {};
			pendingLibrary = imported;
		} catch (error) {
			uploadErrorDetails = describeError(error);
		} finally {
			isUploading = false;
		}
	}

	async function importChallenges(): Promise<void> {
		if (!pendingLibrary || isUploading || hasUnresolvedConflicts) return;
		isUploading = true;
		uploadErrorDetails = '';
		try {
			let library = (await loadChallengeLibraryWithDiagnostics()).library;
			const importedChallenges: Challenge[] = [];
			for (const challenge of $state.snapshot(pendingLibrary).challenges) {
				const resolution = resolutions[challenge.id];
				if (resolution === 'skip') continue;
				const prepared = prepareChallengeImport(
					library,
					{
						content: { formatVersion: 1, challenges: [challenge] },
						isPartial: false,
						unreadableFields: []
					},
					resolution === 'replace'
						? { resolution: 'replace', activeChallengeIds: new Set() }
						: resolution === 'copy'
							? { resolution: 'copy' }
							: undefined
				);
				library = prepared.library;
				importedChallenges.push(prepared.challenge);
			}
			if (importedChallenges.length > 0) await saveChallengesToLibrary(importedChallenges);
			importMessage = `${importedChallenges.length} challenges imported.`;
			pendingLibrary = undefined;
			await loadChallenges();
		} catch (error) {
			uploadErrorDetails = describeError(error);
		} finally {
			isUploading = false;
			if (!pendingLibrary) await focusUploadButton();
		}
	}

	async function focusUploadButton(): Promise<void> {
		await tick();
		document.getElementById('upload-library')?.focus();
	}

	async function cancelImport(): Promise<void> {
		pendingLibrary = undefined;
		uploadErrorDetails = '';
		await focusUploadButton();
	}

	$effect(() => {
		if (pendingLibrary) importHeading?.focus();
	});

	onMount(() => {
		void loadChallenges();
	});
</script>

{#snippet newChallengeCard()}
	<div role="listitem">
		<NewChallengeCard
			isDisabled={isCreating || isUploading || !!pendingLibrary}
			{isCreating}
			onCreate={() => void createChallenge()}
		/>
	</div>
{/snippet}

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
		<div class="challenge-cards" role="list" aria-label="Saved challenges">
			{@render newChallengeCard()}
		</div>
	{:else}
		<h2>Saved challenges</h2>
		<div class="challenge-cards" role="list" aria-label="Saved challenges">
			{@render newChallengeCard()}
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
	{#if downloadErrorDetails}
		<ErrorDisplay
			message="The challenge library could not be downloaded."
			details={downloadErrorDetails}
		/>
	{/if}
	<ActionButton disabled={isDownloading} onclick={() => void downloadLibrary()}>
		{isDownloading ? 'Downloading…' : 'Download Library'}
	</ActionButton>
	<input
		bind:this={fileInput}
		type="file"
		accept=".json,application/json"
		aria-label="Library JSON file"
		hidden
		onchange={() => void uploadLibrary()}
	/>
	<ActionButton
		id="upload-library"
		disabled={isCreating || isUploading || !!pendingLibrary}
		onclick={() => fileInput.click()}
	>
		{isUploading ? 'Uploading…' : 'Upload Library'}
	</ActionButton>
	{#if uploadErrorDetails}
		<ErrorDisplay
			message="The challenge library could not be uploaded."
			details={uploadErrorDetails}
		/>
	{/if}
	{#if pendingLibrary}
		<section aria-labelledby="import-heading">
			<h2 id="import-heading" tabindex="-1" bind:this={importHeading}>Import library</h2>
			<p>
				The file contains {pendingLibrary.challenges.length} challenges. Existing challenges are kept
				unless you choose Replace.
			</p>
			{#each conflicts as conflict (conflict.id)}
				<div class="import-conflict">
					<p>A saved challenge already uses this ID: {conflict.id}.</p>
					{#if !conflict.canReplace}
						<p>The saved record is unreadable and cannot be replaced by a merge.</p>
					{/if}
					<SelectInput
						label={conflict.name}
						value={resolutions[conflict.id] ?? ''}
						onchange={(event) => {
							resolutions[conflict.id] = event.currentTarget.value;
						}}
						disabled={isUploading}
					>
						<option value="">Choose an action</option>
						{#if conflict.canReplace}<option value="replace">Replace existing challenge</option
							>{/if}
						<option value="copy">Import a copy</option>
						<option value="skip">Skip</option>
					</SelectInput>
				</div>
			{/each}
			<ActionButton
				disabled={isUploading || hasUnresolvedConflicts}
				onclick={() => void importChallenges()}
			>
				Import challenges
			</ActionButton>
			<ActionButton variant="neutral" disabled={isUploading} onclick={() => void cancelImport()}
				>Cancel import</ActionButton
			>
		</section>
	{/if}
	{#if importMessage}<p role="status">{importMessage}</p>{/if}
</ViewPage>

<style>
	h2 {
		margin: 24px 0 12px;
		font-size: 18px;
		font-weight: 600;
	}

	.import-conflict {
		margin-block: 16px;
		overflow-wrap: anywhere;
	}

	.challenge-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 360px));
		gap: 12px;
		margin: 0 0 24px;
	}
</style>
