<script lang="ts">
	import LandingAction from './LandingAction.svelte';
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Soulstone Initiative Tracker</title>
	<meta name="description" content="Manage your own challenge or watch a running challenge." />
</svelte:head>

<section aria-labelledby="page-title">
	<h1 id="page-title">Initiative Tracker</h1>

	<ul aria-label="Available actions">
		<li>
			<LandingAction
				href={resolve('/challenges')}
				title="Host"
				description="Manage your own challenge"
			/>
		</li>
		<li>
			<LandingAction href={resolve('/view')} title="Join" description="Watch a running challenge" />
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
	}

	@media (min-width: 1440px) {
		section {
			column-gap: 140px;
		}
	}
</style>
