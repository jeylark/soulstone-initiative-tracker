<script lang="ts">
	import { page } from '$app/state';
	import { ViewPage } from '#lib/components';
</script>

<ViewPage title="Live session">
	<p>Session code: <code>{page.params.sessioncode}</code></p>
	<p role="status">The live session view is not available yet.</p>
</ViewPage>
