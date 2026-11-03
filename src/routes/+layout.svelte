<script lang="ts">
	import '../app.css';
	import { theme } from '#lib/theme.svelte.ts';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/soulstone-logo.png" />
</svelte:head>

<div class:theme-dark={theme.isDarkMode} class="app-shell">
	<header>
		<img src="/soulstone-logo.png" alt="" width="40" height="40" />
		<span>Soulstone</span>
		<button type="button" aria-pressed={theme.isDarkMode} onclick={() => theme.toggle()}>
			{#if theme.isDarkMode}
				<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<circle cx="10" cy="10" r="3.5" />
					<path
						d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2"
					/>
				</svg>
				Light mode
			{:else}
				<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<path d="M16.8 12.6A7.3 7.3 0 0 1 7.4 3.2a7.4 7.4 0 1 0 9.4 9.4Z" />
				</svg>
				Dark mode
			{/if}
		</button>
	</header>
	<nav aria-label="Page navigation">
		<a href={resolve('/challenges/new')}>New Challenge</a>
		<a href={resolve('/challenges')}>Saved Challenges</a>
		<a href={resolve('/join')}>Join</a>
	</nav>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		display: flex;
		min-height: 100vh;
		min-height: 100svh;
		flex-direction: column;
		background: var(--color-background);
		color: var(--color-foreground);
		transition:
			background-color var(--transition-theme),
			color var(--transition-theme);
	}

	header,
	nav,
	main {
		width: min(calc(100% - 40px), 1120px);
		margin-inline: auto;
	}

	main {
		flex: 1;
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 72px;
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	header img {
		display: block;
	}

	header button {
		display: inline-flex;
		min-height: 40px;
		align-items: center;
		gap: 8px;
		margin-left: auto;
		padding: 0 12px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: transparent;
		color: var(--color-foreground);
		cursor: pointer;
		font: inherit;
		font-size: 13px;
	}

	header button:hover {
		border-color: var(--color-accent);
	}

	header button:focus-visible,
	nav a:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-ring-offset);
	}

	header button svg {
		width: 17px;
		stroke: var(--color-accent);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.4;
	}

	nav {
		display: flex;
		min-height: 44px;
		align-items: center;
		gap: 24px;
		border-block: 1px solid var(--color-border);
	}

	nav a {
		min-height: 40px;
		align-content: center;
		color: var(--color-foreground);
		font-size: 13px;
		text-decoration: none;
	}

	nav a:hover {
		color: var(--color-accent);
	}

	main {
		padding-top: 8px;
	}

	@media (max-width: 480px) {
		nav {
			gap: 16px;
			overflow-x: auto;
		}

		nav a {
			flex: 0 0 auto;
		}
	}

	@media (min-width: 760px) {
		header {
			min-height: 84px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell {
			transition: none;
		}
	}
</style>
