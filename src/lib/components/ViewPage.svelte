<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head>
	<title>{title} | Soulstone Initiative Tracker</title>
</svelte:head>

<div class="view">
	<main>
		<a class="back" href={resolve('/')}>Back</a>
		<h1>{title}</h1>
		{@render children()}
	</main>
</div>

<style>
	.view {
		min-height: 100svh;
		background: var(--color-background);
		color: var(--color-foreground);
	}

	main {
		width: min(calc(100% - 40px), 1120px);
		margin-inline: auto;
		padding-block: 24px 64px;
	}

	.back {
		display: inline-block;
		min-height: 24px;
		color: var(--color-accent);
		font-size: 14px;
	}

	.back:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-ring-offset);
	}

	h1 {
		margin: 32px 0 16px;
		font-family: var(--font-family-heading);
		font-size: clamp(28px, 6vw, 48px);
		font-weight: 400;
		letter-spacing: -0.03em;
	}
</style>
