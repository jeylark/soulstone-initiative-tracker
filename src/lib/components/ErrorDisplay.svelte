<script lang="ts">
	import ActionButton from './ActionButton.svelte';

	interface Props {
		message: string;
		details?: string;
	}

	let { message, details = '' }: Props = $props();
	const detailsId = $props.id();
	let areDetailsVisible = $state(false);
</script>

<section class="error-display">
	<p class="error-message" role="alert">{message}</p>
	{#if details}
		<ActionButton
			variant="neutral"
			aria-expanded={areDetailsVisible}
			aria-controls={detailsId}
			onclick={() => (areDetailsVisible = !areDetailsVisible)}
		>
			{areDetailsVisible ? 'Hide error details' : 'Display error details'}
		</ActionButton>
		<pre id={detailsId} class="error-details" hidden={!areDetailsVisible}>{details}</pre>
	{/if}
</section>

<style>
	.error-display {
		width: 100%;
		margin-block: 16px;
		border: 1px solid var(--color-danger);
		border-inline-start-width: 4px;
		border-radius: 4px;
		padding: 12px 16px;
		background: var(--color-danger-surface);
		color: var(--color-danger);
	}

	.error-message {
		margin: 0 0 12px;
		font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
		font-size: 15px;
		font-weight: 600;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.error-details {
		max-width: 100%;
		margin: 12px 0 0;
		border-top: 1px solid var(--color-danger);
		padding-top: 12px;
		color: var(--color-foreground);
		font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
		font-size: 13px;
		line-height: 1.5;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
</style>
