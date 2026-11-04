<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ViewPage from '#lib/components/ViewPage.svelte';

	const routeChallenge = page.state.challenge;
	const isChallengeAvailable =
		routeChallenge !== undefined && routeChallenge.id === page.params.challengeId;
</script>

<ViewPage title={isChallengeAvailable ? 'Running challenge' : 'Challenge unavailable'}>
	{#if isChallengeAvailable}
		<p>{routeChallenge.name}</p>
	{:else}
		{#if routeChallenge === undefined}
			<p>The running challenge state is missing.</p>
		{:else}
			<p>The challenge in page state does not match this URL.</p>
		{/if}
		<a href={resolve('/')}>Return to home</a>
	{/if}
</ViewPage>
