<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		loadChallengeLibrary,
		saveChallengeToLibrary,
		validateChallengeSetup,
		type Challenge
	} from '#lib/challenge';
	import { ErrorDisplay, ViewPage } from '#lib/components';
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
	let challenge = $state<Challenge>();
	let activeTab = $state<WorkflowTab>('setup');
	let hasSaveError = $state(false);
	let setupIssues = $derived(challenge ? validateChallengeSetup(challenge) : []);
	let saveQueue: Promise<void> = Promise.resolve();
	let saveTimeout: ReturnType<typeof setTimeout> | undefined;
	let isFirstRun = true;

	onMount(() => {
		void (async () => {
			try {
				const library = await loadChallengeLibrary();
				challenge = library.challenges.find((item) => item.id === page.params.challengeId);
				loadStatus = challenge ? 'ready' : 'not-found';
			} catch {
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

	async function selectTab(tab: WorkflowTab): Promise<void> {
		if (tab === activeTab) return;
		if (tab !== 'setup' && setupIssues.length > 0) return;
		try {
			await saveNow();
			activeTab = tab;
		} catch {
			// Keep the current panel open when its latest changes could not be saved.
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
		void selectTab(nextTab).then(() => {
			if (activeTab === nextTab) document.getElementById(`challenge-tab-${nextTab}`)?.focus();
		});
	}
</script>

{#if loadStatus === 'loading'}
	<ViewPage title="Loading challenge">
		<p>Loading challenge…</p>
	</ViewPage>
{:else if loadStatus !== 'ready' || !challenge}
	<ViewPage title="Challenge unavailable">
		{#if loadStatus === 'not-found'}
			<ErrorDisplay message="The challenge was not found." />
		{:else}
			<ErrorDisplay message="The challenge could not be loaded." />
		{/if}
		<a href={resolve('/challenges')}>Return to challenges</a>
	</ViewPage>
{:else}
	<div class="challenge-workflow">
		<div class="workflow-tabs" role="tablist" aria-label="Challenge workflow">
			{#each workflowTabs as tab (tab)}
				<button
					id={`challenge-tab-${tab}`}
					role="tab"
					aria-selected={activeTab === tab}
					aria-disabled={tab !== 'setup' && setupIssues.length > 0}
					aria-controls={`challenge-panel-${tab}`}
					tabindex={activeTab === tab ? 0 : -1}
					onclick={() => void selectTab(tab)}
					onkeydown={(event) => handleTabKeydown(event, tab)}
				>
					{tabLabels[tab]}
				</button>
			{/each}
		</div>
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
				<SetupPanel sharedChallenge={challenge} onTabChange={selectTab} />
			{:else if activeTab === 'roll'}
				<RollPanel sharedChallenge={challenge} onTabChange={selectTab} />
			{:else}
				<RunPanel sharedChallenge={challenge} onSave={saveNow} />
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
		gap: 4px;
		border-bottom: 1px solid var(--color-border-subtle);
	}

	.workflow-tabs button {
		min-width: 88px;
		min-height: 44px;
		border: 0;
		border-bottom: 3px solid transparent;
		padding: 8px 16px;
		background: transparent;
		color: var(--color-foreground-muted);
		font: inherit;
		font-weight: 600;
		cursor: pointer;
	}

	.workflow-tabs button[aria-selected='true'] {
		border-bottom-color: var(--color-accent);
		color: var(--color-foreground);
	}

	.workflow-tabs button:focus-visible {
		outline: var(--focus-ring);
		outline-offset: -2px;
	}

	[role='tabpanel'] {
		min-width: 0;
	}

	@media (max-width: 480px) {
		.workflow-tabs button {
			flex: 1 1 0;
			min-width: 0;
		}
	}
</style>
