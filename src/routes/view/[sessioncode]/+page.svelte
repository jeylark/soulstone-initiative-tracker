<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import type { TurnOrderDisplayItem } from '#lib/challenge';
	import { TurnOrderList, ViewPage } from '#lib/components';
	import { joinLiveSession, LiveSessionRequestError } from '../../../lib/live-session-client';

	let turnOrder = $state<readonly TurnOrderDisplayItem[]>([]);
	let isLoading = $state(true);
	let errorMessage = $state('');

	async function loadLiveSession(): Promise<void> {
		try {
			const session = await joinLiveSession(page.params.sessioncode ?? '');
			turnOrder = session.turnOrder;
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
		void loadLiveSession();
	});
</script>

<ViewPage title="Live session">
	<p>Session code: <code>{page.params.sessioncode}</code></p>
	{#if isLoading}
		<p role="status">Loading live session...</p>
	{:else if errorMessage}
		<p role="alert">{errorMessage}</p>
	{:else if turnOrder.length === 0}
		<p role="status">The active session has no generated turn order.</p>
	{:else}
		<TurnOrderList items={turnOrder} />
	{/if}
</ViewPage>
