<script lang="ts">
	import { ActionButton, TextInput, ViewPage } from '#lib/components';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { joinLiveSession, LiveSessionRequestError } from '#lib';

	let sessionCode = $state('');
	let invalidMessage = $state('');
	let isJoining = $state(false);

	async function submitSessionCode(): Promise<void> {
		if (isJoining) return;
		sessionCode = sessionCode.trim().toUpperCase();
		if (!sessionCode) {
			invalidMessage = 'Enter a session code.';
			return;
		}
		if (
			!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}(?:[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4})?$/.test(
				sessionCode
			)
		) {
			invalidMessage = 'Enter a 4- or 8-character code.';
			return;
		}
		invalidMessage = '';
		const submittedCode = sessionCode;
		isJoining = true;
		try {
			await joinLiveSession(submittedCode);
			await goto(resolve('/view/[sessioncode]', { sessioncode: submittedCode }));
		} catch (error) {
			invalidMessage =
				error instanceof LiveSessionRequestError
					? error.message
					: 'Unable to join the live session. Check the code and try again.';
		} finally {
			isJoining = false;
		}
	}
</script>

<ViewPage title="Join a live session">
	<form
		onsubmit={(event) => {
			event.preventDefault();
			void submitSessionCode();
		}}
	>
		<TextInput
			label="Session code"
			name="sessionCode"
			value={sessionCode}
			maxlength={8}
			autocomplete="off"
			spellcheck={false}
			disabled={isJoining}
			isInvalid={invalidMessage !== ''}
			{invalidMessage}
			oninput={(event) => {
				sessionCode = event.currentTarget.value;
				invalidMessage = '';
			}}
		/>
		<ActionButton type="submit" disabled={isJoining}>Join session</ActionButton>
		{#if isJoining}
			<p role="status">Joining live session...</p>
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
