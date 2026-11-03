<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Soulstone Initiative Tracker</title>
	<meta
		name="description"
		content="Create a challenge, open a saved challenge, or join a live session."
	/>
</svelte:head>

<section aria-labelledby="page-title">
	<h1 id="page-title">Initiative Tracker</h1>

	<ul aria-label="Available actions">
		<li>
			<a class="action-button" href={resolve('/challenges/new')}>
				<span>New challenge</span>
				<span aria-hidden="true">→</span>
			</a>
		</li>
		<li>
			<a class="action-button" href={resolve('/challenges')}>
				<span>Open saved challenge</span>
				<span aria-hidden="true">→</span>
			</a>
		</li>
		<li>
			<a class="action-button" href={resolve('/join')}>
				<span>Join a live session</span>
				<span aria-hidden="true">→</span>
			</a>
		</li>
	</ul>
</section>

<style>
	section {
		padding-top: clamp(64px, 12vh, 112px);
	}

	h1 {
		margin: 0 0 28px;
		font-family: var(--font-family-heading);
		font-size: clamp(26px, 8vw, 42px);
		font-weight: 400;
		letter-spacing: -0.045em;
		white-space: nowrap;
	}

	ul {
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--color-border-subtle);
		list-style: none;
	}

	li {
		margin: 0;
	}

	.action-button {
		display: flex;
		width: 100%;
		min-height: 64px;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 0 16px;
		border: 0;
		border-bottom: 1px solid var(--color-border-subtle);
		border-radius: 0;
		background: transparent;
		color: var(--color-foreground);
		cursor: pointer;
		font: inherit;
		font-size: 15px;
		text-align: left;
		text-decoration: none;
	}

	.action-button span:last-child {
		color: var(--color-accent);
		font-size: 19px;
	}

	.action-button:hover {
		background: var(--color-accent-hover);
	}

	.action-button:focus-visible {
		outline: var(--focus-ring);
		outline-offset: var(--focus-ring-offset);
	}

	@media (min-width: 760px) {
		section {
			display: grid;
			min-height: calc(100svh - 168px);
			grid-template-columns: minmax(max-content, 1fr) minmax(0, 1.1fr);
			align-items: center;
			column-gap: clamp(48px, 8vw, 128px);
			padding-block: 48px;
		}

		h1 {
			margin: 0;
			font-size: clamp(48px, 6vw, 76px);
			line-height: 1.08;
		}

		.action-button {
			min-height: clamp(72px, 10vh, 92px);
			padding-inline: 20px;
			font-size: clamp(16px, 1.5vw, 19px);
		}

		.action-button span:last-child {
			font-size: 22px;
		}
	}

	@media (min-width: 1440px) {
		section {
			column-gap: 140px;
		}
	}
</style>
