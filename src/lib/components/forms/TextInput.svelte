<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import './form-controls.css';

	interface Props extends Omit<HTMLInputAttributes, 'type'> {
		label: string;
		isLabelVisuallyHidden?: boolean;
	}

	let { label, isLabelVisuallyHidden = false, class: className = '', ...rest }: Props = $props();
</script>

<label class="form-field">
	<span class:visually-hidden={isLabelVisuallyHidden}>{label}</span>
	<input {...rest} class={`form-control ${className}`} type="text" />
</label>
