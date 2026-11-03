<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} | Soulstone Initiative Tracker</title>
</svelte:head>

<section>
	<h1>{title}</h1>
	{@render children()}
</section>

<style>
	section {
		padding-block: 24px 64px;
	}

	h1 {
		margin: 24px 0 16px;
		font-family: var(--font-family-heading);
		font-size: clamp(28px, 6vw, 48px);
		font-weight: 400;
		letter-spacing: -0.03em;
	}
</style>
