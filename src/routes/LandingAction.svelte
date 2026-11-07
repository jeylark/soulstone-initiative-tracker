<script lang="ts">
	import { resolve } from '$app/paths';

	let { href, label }: { href: ReturnType<typeof resolve>, label: string } = $props();
</script>

<a class="action-button" href={href}>
	<span>{label}</span>
	<span aria-hidden="true">→</span>
</a>

<style>
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
		.action-button {
			min-height: clamp(72px, 10vh, 92px);
			padding-inline: 20px;
			font-size: clamp(16px, 1.5vw, 19px);
		}

		.action-button span:last-child {
			font-size: 22px;
		}
	}
</style>
