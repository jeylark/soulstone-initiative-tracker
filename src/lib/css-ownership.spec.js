import { ESLint, RuleTester } from 'eslint';
import svelteParser from 'svelte-eslint-parser';
import { describe, expect, it } from 'vitest';
import rule from '../../eslint/no-cross-component-styles.js';

const ruleTester = new RuleTester({
	languageOptions: {
		parser: svelteParser,
		parserOptions: { ecmaVersion: 'latest', sourceType: 'module' }
	}
});

describe('no-global-svelte-styles', () => {
	it('parses this JavaScript spec with the configured project service', async () => {
		const eslint = new ESLint();
		const results = await eslint.lintFiles(['src/lib/css-ownership.spec.js']);

		expect(results).toHaveLength(1);
		expect(results[0]?.fatalErrorCount).toBe(0);
	}, 15000);

	it('allows shared stylesheet imports and caller-owned classes', () => {
		expect(
			ruleTester.run('no-global-svelte-styles', rule, {
				valid: [
					{
						code: '<script>import \'./shared.css\';</script><div class="shared-class" />',
						filename: '/repo/src/lib/components/Owner.svelte'
					},
					{
						code: '<Component class="caller-owned" /><style>.caller-owned { color: red; }</style>',
						filename: '/repo/src/lib/components/Owner.svelte'
					}
				],
				invalid: [
					{
						code: '<Component class="caller-owned" /><style>:global(.caller-owned) { color: red; }</style>',
						filename: '/repo/src/lib/components/Owner.svelte',
						errors: [{ messageId: 'globalSelector' }]
					},
					{
						code: '<div class="foreign" /><style>:global(.foreign) { color: red; }</style>',
						filename: '/repo/src/lib/components/Owner.svelte',
						errors: [{ messageId: 'globalSelector' }]
					}
				]
			})
		).toBeUndefined();
	});
});
