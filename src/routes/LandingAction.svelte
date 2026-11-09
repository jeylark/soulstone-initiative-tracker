<script lang="ts">
	import { resolve } from '$app/paths';

	let {
		href,
		title,
		description
	}: { href: ReturnType<typeof resolve>; title: string; description: string } = $props();
</script>

<a class="action-button" {href}>
	<span class="action-copy">
		<span class="action-title">{title}</span>
		<span class="action-description">{description}</span>
	</span>
	<span class="action-arrow" aria-hidden="true">→</span>
</a>

<style>
	.action-button {
		display: flex;
		width: 100%;
		min-height: 76px;
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
		text-align: left;
		text-decoration: none;
	}

	.action-copy {
		display: grid;
		gap: 4px;
	}

	.action-title {
		font-size: 16px;
		font-weight: 650;
	}

	.action-description {
		color: var(--color-foreground-muted);
		font-size: 14px;
		line-height: 1.4;
	}

	.action-arrow {
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
		.action-button {
			min-height: clamp(76px, 10vh, 96px);
			padding-inline: 20px;
		}

		.action-title {
			font-size: 18px;
		}

		.action-description {
			font-size: 15px;
		}

		.action-arrow {
			font-size: 22px;
		}
	}
</style>
