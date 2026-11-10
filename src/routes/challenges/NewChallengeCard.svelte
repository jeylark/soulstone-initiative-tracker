<script lang="ts">
	import { ActionButton, Card } from '#lib/components';

	interface Props {
		/** Whether the create action is unavailable, for example while another operation is running. */
		isDisabled: boolean;
		/** Whether a new challenge is currently being created. */
		isCreating: boolean;
		/** Called when the DM asks to create a new challenge. */
		onCreate: () => void;
	}

	let { isDisabled, isCreating, onCreate }: Props = $props();
</script>

<Card title="New challenge" headingLevel="h3" headerSize="medium" class="new-challenge-card">
	<div class="new-challenge-body">
		<ActionButton disabled={isDisabled} onclick={onCreate}>
			{isCreating ? 'Creating…' : 'Create new challenge'}
		</ActionButton>
	</div>
</Card>

<style>
	/* Fill the grid cell so the card matches the height of neighboring challenge cards. */
	:global(.new-challenge-card) {
		height: 100%;
		box-sizing: border-box;
	}

	.new-challenge-body {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100%;
	}
</style>
