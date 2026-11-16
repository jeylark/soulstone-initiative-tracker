/** @type {import('eslint').Rule.RuleModule} */
const noCrossComponentStyles = {
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
			/**
			 * @param {import('eslint').Rule.Node | import('svelte-eslint-parser/lib/ast/index.js').SvelteStyleElement} node
			 */
			SvelteStyleElement(node) {
				if (node.type !== 'SvelteStyleElement') {
					return;
				}

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

export default noCrossComponentStyles;
