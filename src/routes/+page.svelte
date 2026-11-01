<script lang="ts">
	let darkMode = $state(false);
</script>

<svelte:head>
	<title>Soulstone Initiative Tracker</title>
	<meta
		name="description"
		content="Create a challenge, open a saved challenge, or join a live session."
	/>
</svelte:head>

<div class:dark={darkMode} class="app-shell">
	<main>
		<header>
			<img src="/soulstone-logo.png" alt="" width="40" height="40" />
			<span>Soulstone</span>
		</header>

		<section aria-labelledby="page-title">
			<h1 id="page-title">Initiative Tracker</h1>

			<ul aria-label="Available actions">
				<li>
					<span>New challenge</span>
					<span aria-hidden="true">→</span>
				</li>
				<li>
					<span>Open saved challenge</span>
					<span aria-hidden="true">→</span>
				</li>
				<li>
					<span>Join a live session</span>
					<span aria-hidden="true">→</span>
				</li>
			</ul>
		</section>
	</main>

	<footer>
		<button type="button" aria-pressed={darkMode} onclick={() => (darkMode = !darkMode)}>
			{#if darkMode}
				<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<circle cx="10" cy="10" r="3.5" />
					<path d="M10 1.8v2M10 16.2v2M18.2 10h-2M3.8 10h-2m14-5.8-1.4 1.4M5.6 14.4l-1.4 1.4m11.6 0-1.4-1.4M5.6 5.6 4.2 4.2" />
				</svg>
				Light mode
			{:else}
				<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<path d="M16.8 12.6A7.3 7.3 0 0 1 7.4 3.2a7.4 7.4 0 1 0 9.4 9.4Z" />
				</svg>
				Dark mode
			{/if}
		</button>
	</footer>
</div>

<style>
	.app-shell {
		--background: #f2f5f8;
		--foreground: #17263c;
		--rule: #d8e0e8;
		--divider: #cbd6e2;
		--accent: #075da8;

		display: flex;
		min-height: 100vh;
		flex-direction: column;
		background: var(--background);
		color: var(--foreground);
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}

	.app-shell.dark {
		--background: #101a2b;
		--foreground: #eaf3fc;
		--rule: #29374a;
		--divider: #34445a;
		--accent: #69c8f0;
	}

	main {
		width: min(100% - 48px, 480px);
		margin-inline: auto;
	}

	header {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 72px;
		border-bottom: 1px solid var(--rule);
		font-size: 14px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	header img {
		display: block;
	}

	section {
		padding-top: clamp(72px, 16vh, 144px);
	}

	h1 {
		margin: 0 0 28px;
		font-family: Georgia, 'Times New Roman', serif;
		font-size: clamp(32px, 8vw, 42px);
		font-weight: 400;
		letter-spacing: -0.045em;
	}

	ul {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--divider);
		list-style: none;
	}

	li {
		display: flex;
		min-height: 62px;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		border-bottom: 1px solid var(--divider);
		font-size: 15px;
	}

	li span:last-child {
		color: var(--accent);
		font-size: 19px;
	}

	footer {
		display: flex;
		width: min(100% - 48px, 480px);
		justify-content: flex-end;
		margin: auto auto 20px;
		padding-top: 24px;
	}

	button {
		display: inline-flex;
		min-height: 40px;
		align-items: center;
		gap: 8px;
		padding: 0 12px;
		border: 1px solid var(--rule);
		border-radius: 4px;
		background: transparent;
		color: var(--foreground);
		cursor: pointer;
		font: inherit;
		font-size: 13px;
	}

	button:hover {
		border-color: var(--accent);
	}

	button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 3px;
	}

	button svg {
		width: 17px;
		stroke: var(--accent);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 1.4;
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell {
			transition: none;
		}
	}
</style>
