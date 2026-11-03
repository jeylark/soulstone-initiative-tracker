<script lang="ts">
	interface Props {
		factionName: string;
		onCreate: (name: string) => void;
		onCancel: () => void;
	}

	let { factionName, onCreate, onCancel }: Props = $props();
	let name = $state('');

	function submit() {
		const normalizedName = name.trim();
		if (!normalizedName) return;

		onCreate(normalizedName);
		name = '';
	}
</script>

<form
	class="inline-form faction-entry-form"
	onsubmit={(event) => {
		event.preventDefault();
		submit();
	}}
>
	<h3>Player character</h3>
	<label>
		<span>Character name</span>
		<input
			aria-label={`Character name for ${factionName}`}
			bind:value={name}
			autocomplete="off"
			required
		/>
	</label>
	<button type="submit">Save Player</button>
	<button class="quiet-button" type="button" onclick={onCancel}>Cancel</button>
</form>
