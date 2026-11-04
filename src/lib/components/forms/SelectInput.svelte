<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLSelectAttributes } from 'svelte/elements';
	import './form-controls.css';

	interface Props extends Omit<HTMLSelectAttributes, 'children'> {
		children: Snippet;
		label: string;
		isLabelVisuallyHidden?: boolean;
	}

	let {
		class: className = '',
		children,
		label,
		isLabelVisuallyHidden = false,
		...rest
	}: Props = $props();
</script>

<label class="form-field">
	<span class:visually-hidden={isLabelVisuallyHidden}>{label}</span>
	<select {...rest} class={`form-control ${className}`}>
		{@render children()}
	</select>
</label>
