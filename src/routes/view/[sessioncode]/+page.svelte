<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { TurnOrderDisplayItem } from '#lib/challenge';
	import { TurnOrderList, ViewPage } from '#lib/components';
	import { joinLiveSession, LiveSessionRequestError } from '../../../lib/live-session-client';

	let turnOrder = $state<readonly TurnOrderDisplayItem[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');
	let hasConnectionError = $state(false);
	let hasEnded = $state(false);

	async function loadLiveSession(): Promise<(() => void) | undefined> {
		try {
			const session = await joinLiveSession(page.params.sessioncode ?? '');
			turnOrder = session.turnOrder;
			const eventSource = new EventSource(
				`/api/sessions/${encodeURIComponent(session.session.id)}/events`
			);
			eventSource.addEventListener('turn-order', (event) => {
				try {
					const payload: unknown = JSON.parse((event as MessageEvent<string>).data);
					if (
						typeof payload === 'object' &&
						payload !== null &&
						'turnOrder' in payload &&
						Array.isArray(payload.turnOrder)
					) {
						turnOrder = payload.turnOrder as TurnOrderDisplayItem[];
					}
				} catch {
					errorMessage = 'The live session sent an invalid turn-order update.';
				}
			});
			eventSource.addEventListener('session-ended', () => {
				eventSource.close();
				hasConnectionError = false;
				hasEnded = true;
			});
			eventSource.onopen = () => (hasConnectionError = false);
			eventSource.onerror = () => {
				hasConnectionError = true;
			};
			return () => eventSource.close();
		} catch (error) {
			errorMessage =
				error instanceof LiveSessionRequestError
					? error.message
					: 'Unable to load the live session. Check the code and try again.';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		let closeEventSource: (() => void) | undefined;
		let isCancelled = false;
		void loadLiveSession().then((close) => {
			closeEventSource = close;
			if (isCancelled) closeEventSource?.();
		});
		return () => {
			isCancelled = true;
			closeEventSource?.();
		};
	});
</script>

<ViewPage title="Live session">
	<p>Session code: <code>{page.params.sessioncode}</code></p>
	{#if isLoading}
		<p role="status">Loading live session...</p>
	{:else if errorMessage}
		<p role="alert">{errorMessage}</p>
	{:else if hasEnded}
		<p role="status">This live session has ended.</p>
	{:else if turnOrder.length === 0}
		<p role="status">The active session has no generated turn order.</p>
	{:else}
		<TurnOrderList items={turnOrder} />
		{#if hasConnectionError}
			<p role="status">Connection lost. Reconnecting...</p>
		{/if}
	{/if}
</ViewPage>
