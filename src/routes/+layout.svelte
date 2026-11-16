<script lang="ts">
	import '../app.css';
	import { theme } from '#lib';
	import { resolve } from '$app/paths';
	import { ActionButton } from '#lib/components';
	import { setContext, type Snippet } from 'svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
	let headerContent = $state<Snippet>();
	let headerHeight = $state<number>();
	setContext('app-header-content', {
		setContent(content: Snippet) {
			headerContent = content;
		},
		clearContent(content: Snippet) {
			if (headerContent === content) headerContent = undefined;
		}
	});
</script>

<svelte:head>
	<link rel="icon" type="image/png" href="/soulstone-logo.png" />
</svelte:head>

<div
	class:theme-dark={theme.isDarkMode}
	class="app-shell"
	style:--app-sticky-header-height={headerHeight ? `${headerHeight}px` : undefined}
>
	<header bind:clientHeight={headerHeight}>
		<div class="header-content">
			<a class="home-link" href={resolve('/')} aria-label="Soulstone home" title="Soulstone home">
				<img src="/soulstone-logo.png" alt="" width="40" height="40" />
				<span class="header-label">Soulstone</span>
			</a>
			<div class="header-center">
				{#if headerContent}
					{@render headerContent()}
				{/if}
			</div>
			<div class="theme-toggle-action">
				<ActionButton
					variant="neutral"
					aria-pressed={theme.isDarkMode}
					aria-label={theme.isDarkMode ? 'Light mode' : 'Dark mode'}
					title={theme.isDarkMode ? 'Light mode' : 'Dark mode'}
					onclick={() => theme.toggle()}
				>
					{#if theme.isDarkMode}
						<svg class="theme-toggle-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
							<circle cx="10" cy="10" r="3.5" />
							<path
								d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2"
							/>
						</svg>
						<span class="header-label">Light mode</span>
					{:else}
						<svg class="theme-toggle-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
							<path d="M16.8 12.6A7.3 7.3 0 0 1 7.4 3.2a7.4 7.4 0 1 0 9.4 9.4Z" />
						</svg>
						<span class="header-label">Dark mode</span>
					{/if}
				</ActionButton>
			</div>
		</div>
	</header>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.app-shell {
		--app-header-min-height: 72px;
		--app-sticky-header-height: var(--app-header-min-height);
		--app-sticky-footer-height: 0px;

		display: flex;
		min-height: 100vh;
		min-height: 100svh;
		flex-direction: column;
		overflow-x: clip;
		background: var(--color-background);
		color: var(--color-foreground);
		transition:
			background-color var(--transition-theme),
			color var(--transition-theme);
	}

	.header-content,
	main {
		width: min(calc(100% - 40px), 1120px);
		margin-inline: auto;
	}

	main {
		flex: 1;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--color-background);
	}

	.header-content {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
		min-height: var(--app-header-min-height);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	header img {
		display: block;
	}

	.header-center {
		display: flex;
		justify-content: center;
		min-width: 0;
	}

	.home-link {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		color: inherit;
		text-decoration: none;
	}

	.home-link:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-ring-offset);
	}

	header .theme-toggle-icon {
		width: 17px;
		stroke: var(--color-accent);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.4;
	}

	main {
		padding-top: 8px;
	}

	@media (min-width: 760px) {
		.app-shell {
			--app-header-min-height: 84px;
		}
	}

	@media (max-width: 759px) {
		.header-label {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell {
			transition: none;
		}
	}
</style>
