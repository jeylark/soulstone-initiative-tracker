export default {
	meta: {
		type: 'problem',
		docs: {
			description: 'Disallow global Svelte style selectors'
		},
		messages: {
			globalSelector: 'Avoid :global(); use a shared stylesheet or explicit caller-owned class.'
		},
		schema: []
	},
	create(context) {
		return {
			SvelteStyleElement(node) {
				const styleText = node.children
					.map((child) => (typeof child.value === 'string' ? child.value : ''))
					.join('');
				if (/:global\s*\(/.test(styleText)) {
					context.report({ node, messageId: 'globalSelector' });
				}
			}
		};
	}
};
