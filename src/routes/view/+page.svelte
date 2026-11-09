<script lang="ts">
	import { ActionButton, TextInput, ViewPage } from '#lib/components';

	let sessionCode = $state('');
	let invalidMessage = $state('');
	let hasSubmittedValidCode = $state(false);

	function submitSessionCode() {
		sessionCode = sessionCode.trim().toUpperCase();
		hasSubmittedValidCode = false;
		if (!sessionCode) {
			invalidMessage = 'Enter a session code.';
			return;
		}
		if (!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(sessionCode)) {
			invalidMessage =
				'Enter an 8-character code using letters A-Z (except I and O) and numbers 2-9.';
			return;
		}
		invalidMessage = '';
		hasSubmittedValidCode = true;
	}
</script>

<ViewPage title="Join a live session">
	<form
		onsubmit={(event) => {
			event.preventDefault();
			submitSessionCode();
		}}
	>
		<TextInput
			label="Session code"
			name="sessionCode"
			value={sessionCode}
			autocomplete="off"
			spellcheck={false}
			isInvalid={invalidMessage !== ''}
			{invalidMessage}
			oninput={(event) => {
				sessionCode = event.currentTarget.value;
				invalidMessage = '';
				hasSubmittedValidCode = false;
			}}
		/>
		<ActionButton type="submit">Join session</ActionButton>
		{#if hasSubmittedValidCode}
			<p role="status">Joining live sessions is not available yet.</p>
		{/if}
	</form>
</ViewPage>

<style>
	form {
		display: grid;
		gap: 16px;
		max-inline-size: 32rem;
	}

	form :global(.ui-button) {
		justify-self: start;
	}
</style>
