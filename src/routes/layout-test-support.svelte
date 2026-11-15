<script lang="ts">
	import Layout from './+layout.svelte';
	import ChallengePage from './challenges/[challengeId]/+page.svelte';

	let isChallengeVisible = $state(true);
</script>

<Layout data={{}} params={{}}>
	<button onclick={() => (isChallengeVisible = !isChallengeVisible)}>Toggle challenge</button>
	{#if isChallengeVisible}
		<ChallengePage />
	{/if}
</Layout>
