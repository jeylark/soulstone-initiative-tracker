<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		children,
		actions
	}: {
		title: string;
		children: Snippet;
		/** Optional actions displayed beside the title. */ actions?: Snippet;
	} = $props();
</script>

<svelte:head>
	<title>{title} | Soulstone Initiative Tracker</title>
</svelte:head>

<section>
	<div class="view-page-heading">
		<h1>{title}</h1>
		{#if actions}
			<div class="view-page-actions">{@render actions()}</div>
		{/if}
	</div>
	{@render children()}
</section>

<style>
	section {
		padding-block: 24px 16px;
	}

	.view-page-heading {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0 16px;
		margin-block: 24px 16px;
	}

	h1 {
		flex: 1 1 220px;
		min-width: 0;
		margin: 0;
		font-family: var(--font-family-heading);
		font-size: clamp(28px, 6vw, 48px);
		font-weight: 400;
		letter-spacing: -0.03em;
	}

	.view-page-actions {
		display: flex;
		flex: 0 0 auto;
		justify-content: flex-end;
	}
</style>
