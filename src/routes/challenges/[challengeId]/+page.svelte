<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { getContext, onMount, type Snippet } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		CHALLENGE_FORMAT_VERSION,
		loadChallengeLibraryWithDiagnostics,
		saveChallengeToLibrary,
		getChallengeSetupIssues,
		saveChallengeToJsonFile,
		type Challenge,
		type StableId
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, ViewPage } from '#lib/components';
	import RollPanel from './RollPanel.svelte';
	import RunPanel from './RunPanel.svelte';
	import SetupPanel from './SetupPanel.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';
	type WorkflowTab = 'setup' | 'roll' | 'run';
	const workflowTabs: readonly WorkflowTab[] = ['setup', 'roll', 'run'];
	const tabLabels: Readonly<Record<WorkflowTab, string>> = {
		setup: 'Setup',
		roll: 'Roll',
		run: 'Run'
	};
	let loadStatus = $state<LoadStatus>('loading');
	let loadErrorDetails = $state('');
	let challenge = $state<Challenge>();
	let activeTab = $state<WorkflowTab>('setup');
	let hasSaveError = $state(false);
	let downloadErrorDetails = $state('');
	let isTransitioning = $state(false);
	let setupIssues = $derived(challenge ? getChallengeSetupIssues(challenge) : []);
	let invalidInitiativeTurnIds = $state<readonly StableId[]>([]);
	let missingInitiativeTurnIds = $state<readonly StableId[]>([]);
	let rollValidationCount = $derived.by(() => {
		const missingIds = new Set(missingInitiativeTurnIds);
		const currentMissingIds =
			challenge?.creatures.flatMap((creature) =>
				creature.turns
					.filter(
						(turn) =>
							turn.initiative.kind === 'roll' &&
							missingIds.has(turn.id) &&
							challenge?.runState?.initiativeResults[turn.id] === undefined
					)
					.map((turn) => turn.id)
			) ?? [];
		return new Set([...invalidInitiativeTurnIds, ...currentMissingIds]).size;
	});
	let runValidationCount = $state(0);
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;
	const header = getContext<
		{ setContent: (content: Snippet) => void; clearContent: (content: Snippet) => void } | undefined
	>('app-header-content');

	$effect(() => {
		if (loadStatus !== 'ready' || !challenge || !header) return;
		header.setContent(workflowTabContent);
		return () => header.clearContent(workflowTabContent);
	});

	onMount(() => {
		void (async () => {
			try {
				const { library, unreadableChallenges } = await loadChallengeLibraryWithDiagnostics();
				challenge = library.challenges.find((item) => item.id === page.params.challengeId);
				const unreadable = unreadableChallenges.find((item) => item.id === page.params.challengeId);
				loadErrorDetails =
					unreadable?.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n') ?? '';
				loadStatus = challenge ? 'ready' : unreadable ? 'error' : 'not-found';
				if (challenge) {
					const requestedTabValue = page.url.searchParams.get('tab');
					const requestedTab = workflowTabs.find((tab) => tab === requestedTabValue);
					const canOpenRequestedTab =
						requestedTab === 'setup' ||
						(requestedTab !== undefined && getChallengeSetupIssues(challenge).length === 0);
					activeTab = canOpenRequestedTab ? requestedTab : 'setup';
					if (requestedTabValue !== null && activeTab === 'setup') {
						await updateTabUrl('setup');
					}
				}
			} catch (error) {
				loadErrorDetails =
					error instanceof Error
						? `${error.name}: ${error.message}`
						: 'An unexpected error occurred.';
				loadStatus = 'error';
			}
		})();
	});

	$effect(() => {
		if (loadStatus !== 'ready' || !challenge) return;

		const snapshotChallenge = $state.snapshot(challenge);
		if (isFirstRun) {
			isFirstRun = false;
			return;
		}
		const timeout = setTimeout(() => {
			if (saveTimeout === timeout) saveTimeout = undefined;
			void enqueueSave(snapshotChallenge).catch(() => undefined);
		}, 300);
		saveTimeout = timeout;
		return () => {
			clearTimeout(timeout);
			if (saveTimeout === timeout) saveTimeout = undefined;
		};
	});

	function enqueueSave(snapshotChallenge: DeepReadonly<Challenge>): Promise<void> {
		const toSave = { ...snapshotChallenge, updatedAt: new Date() };
		const pendingSave = saveQueue.then(() => saveChallengeToLibrary(toSave));
		saveQueue = pendingSave.then(
			() => {
				hasSaveError = false;
			},
			() => {
				hasSaveError = true;
			}
		);
		return pendingSave;
	}

	async function saveNow(): Promise<void> {
		if (!challenge) return;
		if (saveTimeout !== undefined) {
			clearTimeout(saveTimeout);
			saveTimeout = undefined;
		}
		try {
			await enqueueSave($state.snapshot(challenge));
			hasSaveError = false;
		} catch {
			hasSaveError = true;
			throw new Error('Challenge changes could not be saved.');
		}
	}

	async function downloadChallenge(): Promise<void> {
		if (!challenge) return;
		downloadErrorDetails = '';
		try {
			const library = {
				formatVersion: CHALLENGE_FORMAT_VERSION,
				challenges: [$state.snapshot(challenge)]
			};
			await saveChallengeToJsonFile(library, challenge.id);
		} catch (error) {
			downloadErrorDetails =
				error instanceof Error
					? `${error.name}: ${error.message}`
					: 'An unexpected error occurred.';
		}
	}

	async function updateTabUrl(tab: WorkflowTab): Promise<void> {
		const challengeId = challenge?.id ?? page.params.challengeId;
		if (!challengeId) return;
		const url = new URL(page.url.toString());
		if (tab === 'setup') url.searchParams.delete('tab');
		else url.searchParams.set('tab', tab);
		await goto(resolve(`challenges/${challengeId}${url.search}`), {
			['replace']: true
		});
	}

	async function selectTab(tab: WorkflowTab, isFocusRequested = false): Promise<void> {
		if (tab === activeTab || isTransitioning) return;
		if (tab !== 'setup' && setupIssues.length > 0) return;
		try {
			await saveNow();
		} catch {
			// Keep the current panel open when its latest changes could not be saved.
			return;
		}

		const previousTab = activeTab;
		activeTab = tab;
		if (isFocusRequested) document.getElementById(`challenge-tab-${tab}`)?.focus();
		try {
			await updateTabUrl(tab);
		} catch {
			activeTab = previousTab;
		}
	}

	function handleTabKeydown(
		event: Readonly<{ key: string; preventDefault: () => void }>,
		tab: WorkflowTab
	): void {
		const currentIndex = workflowTabs.indexOf(tab);
		let nextIndex: number | undefined;
		if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % workflowTabs.length;
		else if (event.key === 'ArrowLeft') {
			nextIndex = (currentIndex + workflowTabs.length - 1) % workflowTabs.length;
		} else if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = workflowTabs.length - 1;
		if (nextIndex === undefined) return;

		event.preventDefault();
		const nextTab = workflowTabs[nextIndex];
		if (!nextTab) return;
		void selectTab(nextTab, true);
	}
</script>

{#snippet workflowTabContent()}
	<div class="workflow-tabs" role="tablist" aria-label="Challenge workflow">
		{#each workflowTabs as tab (tab)}
			{@const validationCount =
				tab === 'setup'
					? setupIssues.length
					: tab === 'roll'
						? rollValidationCount
						: runValidationCount}
			<button
				id={`challenge-tab-${tab}`}
				role="tab"
				aria-label={tabLabels[tab]}
				aria-selected={activeTab === tab}
				aria-disabled={(tab !== 'setup' && setupIssues.length > 0) ||
					(isTransitioning && tab !== activeTab)}
				aria-describedby={validationCount > 0 ? `challenge-tab-${tab}-validation` : undefined}
				aria-controls={`challenge-panel-${tab}`}
				tabindex={activeTab === tab ? 0 : -1}
				onclick={() => void selectTab(tab)}
				onkeydown={(event) => handleTabKeydown(event, tab)}
			>
				{tabLabels[tab]}
				{#if validationCount > 0}
					<span class="validation-count" aria-hidden="true">{validationCount}</span>
					<span id={`challenge-tab-${tab}-validation`} class="tab-validation-description">
						{validationCount} validation {validationCount === 1 ? 'error' : 'errors'}
					</span>
				{/if}
			</button>
		{/each}
	</div>
{/snippet}

{#snippet downloadAction()}
	<ActionButton onclick={() => void downloadChallenge()}>Download</ActionButton>
{/snippet}

{#if loadStatus === 'loading'}
	<ViewPage title="Loading challenge">
		<p>Loading challenge…</p>
	</ViewPage>
{:else if loadStatus !== 'ready' || !challenge}
	<ViewPage title="Challenge unavailable">
		{#if loadStatus === 'not-found'}
			<ErrorDisplay message="The challenge was not found." />
		{:else}
			<ErrorDisplay message="The challenge could not be loaded." details={loadErrorDetails} />
		{/if}
		<a href={resolve('/challenges')}>Return to challenges</a>
	</ViewPage>
{:else}
	<div class="challenge-workflow">
		{#if downloadErrorDetails}
			<ErrorDisplay
				message="The challenge could not be downloaded."
				details={downloadErrorDetails}
			/>
		{/if}
		{#if !header}
			{@render workflowTabContent()}
		{/if}
		{#if hasSaveError}
			<ErrorDisplay message="Changes could not be saved." />
		{/if}
		<div
			id={`challenge-panel-${activeTab}`}
			role="tabpanel"
			aria-labelledby={`challenge-tab-${activeTab}`}
			tabindex="0"
		>
			{#if activeTab === 'setup'}
				<SetupPanel sharedChallenge={challenge} titleActions={downloadAction} />
			{:else if activeTab === 'roll'}
				<RollPanel
					sharedChallenge={challenge}
					{missingInitiativeTurnIds}
					onInvalidInitiativeChange={(turnIds) => (invalidInitiativeTurnIds = turnIds)}
					titleActions={downloadAction}
				/>
			{:else}
				<RunPanel
					sharedChallenge={challenge}
					onSave={saveNow}
					onTabChange={selectTab}
					onTransitionChange={(value) => (isTransitioning = value)}
					onValidationCountChange={(count) => (runValidationCount = count)}
					onMissingInitiativeChange={(turnIds) => (missingInitiativeTurnIds = turnIds)}
					titleActions={downloadAction}
				/>
			{/if}
		</div>
	</div>
{/if}

<style>
	.challenge-workflow {
		padding-top: 20px;
	}

	.workflow-tabs {
		display: flex;
		width: min(100%, 400px);
		gap: 4px;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.workflow-tabs button {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1 1 0;
		min-width: 0;
		min-height: 44px;
		gap: 8px;
		border: 0;
		border-bottom: 3px solid transparent;
		padding: 8px;
		background: transparent;
		color: var(--color-foreground);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.validation-count {
		display: inline-flex;
		min-width: 20px;
		height: 20px;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		padding-inline: 5px;
		background: var(--color-danger-surface);
		color: var(--color-danger);
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.tab-validation-description {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
		border: 0;
	}

	.workflow-tabs button[aria-selected='true'] {
		border-bottom-color: var(--color-accent);
		color: var(--color-foreground);
	}

	.workflow-tabs button[aria-disabled='true'] {
		color: color-mix(in srgb, var(--color-foreground) 55%, var(--color-background));
		cursor: not-allowed;
	}

	.workflow-tabs button:focus-visible {
		outline: var(--focus-ring);
		outline-offset: -2px;
	}

	[role='tabpanel'] {
		min-width: 0;
	}
</style>
