<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { loadChallengeLibrary, type Challenge } from '#lib';
	import ViewPage from '#lib/components/ViewPage.svelte';

	type LoadStatus = 'loading' | 'ready' | 'not-found' | 'error';

	let loadStatus = $state<LoadStatus>('loading');
	let challenge = $state<Challenge>();

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
</script>

<ViewPage
	title={loadStatus === 'not-found' || loadStatus === 'error'
		? 'Challenge unavailable'
		: 'Running challenge'}
>
	{#if loadStatus === 'loading'}
		<p>Loading challenge…</p>
	{:else if loadStatus === 'ready' && challenge}
		<p>{challenge.name}</p>
		<a href={resolve('/challenges/[challengeId]/setup', { challengeId: challenge.id })}>
			Return to setup
		</a>
	{:else}
		{#if loadStatus === 'not-found'}
			<p>The challenge was not found.</p>
		{:else}
			<p>The challenge could not be loaded.</p>
		{/if}
		<a href={resolve('/')}>Return to home</a>
	{/if}
</ViewPage>
