<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import type { DeepReadonly } from '#lib';
	import {
		advanceTurn,
		createTurnOrderDisplay,
		createTurnDisplayLookup,
		loadChallengeLibrary,
		prepareTurnOrder,
		pruneTieDecisions,
		type TurnOrderPreparation,
		saveChallengeToLibrary,
		type Challenge,
		type ChallengeRunState,
		type StableId
	} from '#lib/challenge';
	import { ActionButton, ErrorDisplay, TurnOrderList, ViewPage } from '#lib/components';
	import {
		createLiveSession,
		deleteLiveSessionCredential,
		endLiveSession,
		loadLiveSessionCredential,
		LiveSessionRequestError,
		regenerateViewerCode,
		resumeLiveSession,
		saveLiveSessionCredential,
		updateLiveSession,
		type LiveSessionCredential,
		type LiveSessionDescriptor
	} from '#lib';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

	interface Props {
		sharedChallenge?: Challenge;
		onSave?: () => Promise<void>;
		onTabChange?: (tab: 'setup') => Promise<void> | void;
		onTransitionChange?: (isTransitioning: boolean) => void;
	}

	let { sharedChallenge, onSave, onTabChange, onTransitionChange }: Props = $props();
	type GenerationIssue = Exclude<TurnOrderPreparation, { status: 'generated' }>;

	let loadStatus = $state<LoadStatus>('loading');
	let hasSaveError = $state(false);
	let isSaving = $state(false);
	let isLoadingLiveSession = $state(true);
	let isStartingLiveSession = $state(false);
	let isRegeneratingViewerCode = $state(false);
	let isEndingLiveSession = $state(false);
	let savedLiveSessionCredential = $state<LiveSessionCredential>();
	let liveSessionCredential = $state<LiveSessionCredential>();
	let liveSession = $state<LiveSessionDescriptor>();
	let liveSessionErrorDetails = $state('');
	let localChallenge = $state<Challenge>();
	let challenge = $derived(sharedChallenge ?? localChallenge);
	let generationIssue = $state<GenerationIssue>();
	let saveQueue: Promise<void> = Promise.resolve();
	let isEditing = $derived(challenge?.runState?.spawnEdit !== undefined);
	let isSpawnCurrent = $derived(challenge?.runState?.generatedTurnOrder?.[0]?.kind === 'spawn');
	let turnDisplayLookup = $derived.by(() =>
		challenge ? createTurnDisplayLookup(challenge) : new Map()
	);
	let hiddenTurnIds = $derived.by(
		() =>
			new Set(
				[...turnDisplayLookup.entries()]
					.filter(([, display]) => display.isHidden)
					.map(([turnId]) => turnId)
			)
	);
	let clampedTurnIds = $derived.by(() => {
		if (!challenge?.runState?.generatedTurnOrder) return [];
		const preparation = prepareTurnOrder(challenge, challenge.runState.initiativeResults);
		return preparation.status === 'generated' ? preparation.clampedTurnIds : [];
	});
	let generatedOrderDisplay = $derived.by(() => {
		const generatedTurnOrder = challenge?.runState?.generatedTurnOrder;
		return generatedTurnOrder
			? createTurnOrderDisplay(
					generatedTurnOrder,
					turnDisplayLookup,
					challenge?.runState?.initiativeResults
				)
			: undefined;
	});

	onMount(() => {
		if (sharedChallenge) {
			loadStatus = 'ready';
			void restoreLiveSession();
			return;
		}
		void (async () => {
			try {
				const library = await loadChallengeLibrary();
				const loadedChallenge = library.challenges.find(
					(item) => item.id === page.params.challengeId
				);
				if (!loadedChallenge) {
					loadStatus = 'not-found';
					return;
				}
				localChallenge = loadedChallenge;
				loadStatus = 'ready';
				void restoreLiveSession();
			} catch {
				loadStatus = 'error';
			}
		})();
	});

	async function restoreLiveSession(): Promise<void> {
		if (!challenge) {
			isLoadingLiveSession = false;
			return;
		}
		try {
			const credential = await loadLiveSessionCredential(challenge.id);
			if (!credential) return;
			savedLiveSessionCredential = credential;
			isLoadingLiveSession = false;
			await resumeSavedLiveSession();
		} catch (error) {
			liveSessionErrorDetails = describeSessionError(error);
		} finally {
			isLoadingLiveSession = false;
		}
	}

	async function resumeSavedLiveSession(): Promise<void> {
		if (!challenge || !savedLiveSessionCredential) return;

		isLoadingLiveSession = true;
		liveSessionErrorDetails = '';
		try {
			liveSession = await resumeLiveSession(savedLiveSessionCredential, $state.snapshot(challenge));
			liveSessionCredential = savedLiveSessionCredential;
		} catch (error) {
			liveSessionErrorDetails = describeSessionError(error);
			if (
				error instanceof LiveSessionRequestError &&
				(error.status === 401 || error.status === 404)
			) {
				try {
					await deleteLiveSessionCredential(challenge.id);
					savedLiveSessionCredential = undefined;
				} catch (storageError) {
					liveSessionErrorDetails += `\n${describeSessionError(storageError)}`;
				}
			}
		} finally {
			isLoadingLiveSession = false;
		}
	}

	function describeSessionError(error: unknown): string {
		return error instanceof Error
			? `${error.name}: ${error.message}`
			: 'An unexpected error occurred.';
	}

	async function publishLiveSessionUpdate(): Promise<void> {
		const credential = liveSessionCredential ?? savedLiveSessionCredential;
		if (!challenge || !credential) return;

		try {
			liveSession = await updateLiveSession(credential, $state.snapshot(challenge));
			liveSessionErrorDetails = '';
		} catch (error) {
			liveSessionErrorDetails = describeSessionError(error);
		}
	}

	async function startLiveSession(): Promise<void> {
		if (
			!challenge ||
			!generatedOrderDisplay ||
			isStartingLiveSession ||
			liveSession ||
			savedLiveSessionCredential
		) {
			return;
		}

		isStartingLiveSession = true;
		liveSessionErrorDetails = '';
		try {
			const created = await createLiveSession($state.snapshot(challenge));
			liveSession = created.session;
			const credential: LiveSessionCredential = {
				challengeId: challenge.id,
				sessionId: created.session.id,
				reconnectToken: created.reconnectToken
			};
			liveSessionCredential = credential;
			try {
				await saveLiveSessionCredential(credential);
				savedLiveSessionCredential = credential;
			} catch (storageError) {
				try {
					await endLiveSession(credential);
					liveSession = undefined;
					liveSessionCredential = undefined;
					liveSessionErrorDetails = `The reconnect credential could not be saved, so the session was ended.\n${describeSessionError(storageError)}`;
				} catch (endError) {
					liveSessionErrorDetails = `The session started, but its reconnect credential could not be saved.\n${describeSessionError(storageError)}\nThe session could not be ended.\n${describeSessionError(endError)}`;
				}
			}
		} catch (error) {
			liveSessionErrorDetails = describeSessionError(error);
		} finally {
			isStartingLiveSession = false;
		}
	}

	async function regenerateLiveSessionViewerCode(): Promise<void> {
		if (!liveSession || !savedLiveSessionCredential || isRegeneratingViewerCode) return;

		isRegeneratingViewerCode = true;
		liveSessionErrorDetails = '';
		try {
			liveSession = await regenerateViewerCode(savedLiveSessionCredential);
		} catch (error) {
			liveSessionErrorDetails = describeSessionError(error);
		} finally {
			isRegeneratingViewerCode = false;
		}
	}

	async function endCurrentLiveSession(): Promise<void> {
		const credential = liveSessionCredential ?? savedLiveSessionCredential;
		if (!credential || isEndingLiveSession) return;
		if (
			!window.confirm(
				'End this live session? Viewers will lose access, and you will need to start a new session to share again.'
			)
		) {
			return;
		}

		isEndingLiveSession = true;
		liveSessionErrorDetails = '';
		try {
			await endLiveSession(credential);
		} catch (error) {
			liveSessionErrorDetails = describeSessionError(error);
			return;
		} finally {
			isEndingLiveSession = false;
		}

		try {
			await deleteLiveSessionCredential(credential.challengeId);
		} catch (error) {
			liveSessionErrorDetails = `The server session ended, but its saved reconnect credential could not be removed.\n${describeSessionError(error)}`;
		}
		liveSession = undefined;
		liveSessionCredential = undefined;
		savedLiveSessionCredential = undefined;
	}

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

	async function saveRunState(
		nextRunState: DeepReadonly<ChallengeRunState>,
		previousRunState: DeepReadonly<ChallengeRunState> | undefined
	): Promise<boolean> {
		if (!challenge) return false;
		const challengeToSave = { ...$state.snapshot(challenge), runState: nextRunState };
		isSaving = true;
		onTransitionChange?.(true);
		try {
			challenge.runState = nextRunState as ChallengeRunState;
			if (sharedChallenge && onSave) await onSave();
			else await enqueueSave(challengeToSave);
			hasSaveError = false;
			await publishLiveSessionUpdate();
			return true;
		} catch {
			challenge.runState = previousRunState as ChallengeRunState | undefined;
			hasSaveError = true;
			return false;
		} finally {
			isSaving = false;
			onTransitionChange?.(false);
		}
	}

	async function startEditing(): Promise<void> {
		const runState = challenge?.runState;
		if (!challenge || isSaving || !runState || !isSpawnCurrent || runState.spawnEdit) return;

		generationIssue = undefined;
		const snapshotRunState = $state.snapshot(runState);
		const nextRunState: ChallengeRunState = {
			...snapshotRunState,
			generatedTurnOrder: [{ kind: 'spawn' }],
			spawnEdit: {
				newCreatureIds: [],
				newNpcTypeIds: [],
				newTurnIds: [],
				lockedInitiativeTurnIds: Object.keys(snapshotRunState.initiativeResults) as StableId[]
			}
		};
		if (!(await saveRunState(nextRunState, runState))) return;
		await onTabChange?.('setup');
	}

	async function generateTurnOrder(): Promise<void> {
		if (!challenge || isSaving) return;

		generationIssue = undefined;
		const runState = challenge.runState ?? { initiativeResults: {} };
		const preparation = prepareTurnOrder(
			challenge,
			runState.initiativeResults,
			runState.tieDecisions
		);
		if (preparation.status !== 'generated') {
			generationIssue = preparation;
			return;
		}

		const snapshotChallenge = $state.snapshot(challenge);
		const nextRunState: ChallengeRunState = {
			...(snapshotChallenge.runState ?? { initiativeResults: {} }),
			generatedTurnOrder: [...preparation.order]
		};
		if (runState.spawnEdit) {
			// Spawn stays current; the later Next turn action completes it.
			const spawn = nextRunState.generatedTurnOrder?.pop();
			if (spawn) nextRunState.generatedTurnOrder?.unshift(spawn);
			delete nextRunState.spawnEdit;
		}
		if (runState.tieDecisions !== undefined) {
			nextRunState.tieDecisions = pruneTieDecisions(
				challenge,
				runState.initiativeResults,
				runState.tieDecisions
			);
		}
		await saveRunState(nextRunState, challenge.runState);
	}

	async function advanceToNextTurn(): Promise<void> {
		if (!challenge?.runState?.generatedTurnOrder || isSaving || isEditing) return;

		const previousRunState = challenge.runState;
		const nextRunState = advanceTurn($state.snapshot(previousRunState), hiddenTurnIds);
		await saveRunState(nextRunState, previousRunState);
	}

	async function updateCreatureVisibility(creatureId: StableId, isHidden: boolean): Promise<void> {
		if (!challenge) return;
		const creature = challenge.creatures.find((item) => item.id === creatureId);
		if (!creature || creature.isHidden === isHidden) return;

		const isCreatureHiddenBeforeUpdate = creature.isHidden;
		creature.isHidden = isHidden;
		try {
			if (sharedChallenge && onSave) await onSave();
			else await enqueueSave($state.snapshot(challenge));
			await publishLiveSessionUpdate();
		} catch {
			creature.isHidden = isCreatureHiddenBeforeUpdate;
			hasSaveError = true;
		}
	}
</script>

<ViewPage title="Turn order">
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<div class="run-layout">
			<section aria-label="Challenge controls and status">
				<p>{challenge.name}</p>
				{#if generatedOrderDisplay}
					<p>Spawns: {challenge.runState?.spawnCount ?? 0}</p>
				{/if}
				{#if generatedOrderDisplay?.hasUnknownTurnIds}
					<p role="status">
						Some saved turns are no longer in this challenge and are omitted from the turn order.
					</p>
				{/if}
				{#if clampedTurnIds.length > 0}
					<p role="status">Some placement values exceed the available order and were clamped.</p>
					<ul aria-label="Turns with clamped placement">
						{#each clampedTurnIds as turnId (turnId)}
							<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
						{/each}
					</ul>
				{/if}

				{#if generationIssue?.status === 'missing-results'}
					<ErrorDisplay
						message="Turn order cannot be generated until every rolling turn has a result."
					/>
					<ul aria-label="Turns missing initiative results">
						{#each generationIssue.turnIds as turnId (turnId)}
							<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
						{/each}
					</ul>
				{:else if generationIssue?.status === 'unresolved-ties'}
					<ErrorDisplay
						message="Turn order cannot be generated until tied turns in the same faction are ordered on the Roll tab."
					/>
					<ul aria-label="Unresolved initiative ties">
						{#each generationIssue.groups as group (group.join())}
							<li>
								{group
									.map((turnId) => turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn')
									.join(', ')}
							</li>
						{/each}
					</ul>
				{:else if generationIssue?.status === 'placement-error'}
					<ErrorDisplay message="Turn placement could not be resolved." />
					<ul aria-label="Turns with invalid placement">
						{#each generationIssue.turnIds as turnId (turnId)}
							<li>{turnDisplayLookup.get(turnId)?.label ?? 'Unknown turn'}</li>
						{/each}
					</ul>
				{/if}

				{#if generatedOrderDisplay}
					<ActionButton disabled={isSaving || isEditing} onclick={advanceToNextTurn}>
						Next turn
					</ActionButton>
					<ActionButton disabled={isSaving || isEditing || !isSpawnCurrent} onclick={startEditing}>
						Edit Challenge
					</ActionButton>
					<section aria-label="Live session">
						<h2>Live session</h2>
						{#if liveSession}
							<p>Viewer code: <output>{liveSession.viewerCode}</output></p>
							{#if savedLiveSessionCredential}
								<ActionButton
									disabled={isRegeneratingViewerCode}
									onclick={regenerateLiveSessionViewerCode}
								>
									{isRegeneratingViewerCode ? 'Regenerating…' : 'Regenerate viewer code'}
								</ActionButton>
							{/if}
							<ActionButton disabled={isEndingLiveSession} onclick={endCurrentLiveSession}>
								{isEndingLiveSession ? 'Ending…' : 'End live session'}
							</ActionButton>
						{:else if savedLiveSessionCredential}
							<p>A saved live session could not be resumed.</p>
							<ActionButton disabled={isLoadingLiveSession} onclick={resumeSavedLiveSession}>
								Retry session resume
							</ActionButton>
							<ActionButton disabled={isEndingLiveSession} onclick={endCurrentLiveSession}>
								{isEndingLiveSession ? 'Ending…' : 'End live session'}
							</ActionButton>
						{:else}
							<p>Start a live session to let viewers join this challenge.</p>
							<ActionButton
								disabled={isLoadingLiveSession || isStartingLiveSession}
								onclick={startLiveSession}
							>
								{isStartingLiveSession ? 'Starting…' : 'Start live session'}
							</ActionButton>
						{/if}
						{#if liveSessionErrorDetails}
							<ErrorDisplay
								message="The live session could not be started, resumed, or ended."
								details={liveSessionErrorDetails}
							/>
						{/if}
					</section>
				{/if}
				{#if !challenge.runState?.generatedTurnOrder || isEditing}
					<ActionButton disabled={isSaving} onclick={generateTurnOrder}>
						{isEditing ? 'Calculate Turn Order' : 'Generate turn order'}
					</ActionButton>
				{/if}
				{#if hasSaveError}
					<ErrorDisplay message="Changes could not be saved." />
				{/if}
			</section>

			{#if generatedOrderDisplay}
				<section aria-label="Turn cards">
					<TurnOrderList
						items={generatedOrderDisplay.items}
						onVisibilityChange={updateCreatureVisibility}
					/>
				</section>
			{/if}
		</div>
	{:else}
		{#if loadStatus === 'not-found'}
			<ErrorDisplay message="The challenge was not found." />
		{:else}
			<ErrorDisplay message="The challenge could not be loaded." />
		{/if}
		<a href={resolve('/challenges')}>Return to challenges</a>
	{/if}
</ViewPage>

<style>
	.run-layout {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		align-items: start;
		gap: clamp(24px, 4vw, 48px);
	}

	.run-layout > * {
		min-width: 0;
	}

	@media (max-width: 759px) {
		.run-layout {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
