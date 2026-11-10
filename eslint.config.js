import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['src/**/*.{js,ts,svelte}'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte']
			}
		},
		rules: {
			'@typescript-eslint/prefer-readonly-parameter-types': [
				'error',
				{
					ignoreInferredTypes: true,
					treatMethodsAsReadonly: true
				}
			],
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'typeLike',
					format: ['PascalCase'],
					custom: {
						regex: '^(?!.*[A-Z]{2,})[A-Z][A-Za-z0-9]*$',
						match: true
					}
				},
				{
					selector: 'import',
					format: ['camelCase', 'PascalCase'],
					custom: {
						regex: '^(?:(?!.*[A-Z]{2,})[a-z][A-Za-z0-9]*|[A-Z][A-Za-z0-9]*)$',
						match: true
					}
				},
				{
					selector: 'variable',
					format: ['camelCase', 'UPPER_CASE'],
					custom: {
						regex: '^(?:(?!.*[A-Z]{2,})[a-z][A-Za-z0-9]*|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)$',
						match: true
					}
				},
				{
					selector: ['variable', 'parameter', 'property', 'accessor'],
					types: ['boolean'],
					format: null,
					custom: {
						regex: '^(is|are|has|have|can)[A-Z]',
						match: true
					}
				},
				{
					selector: 'classProperty',
					modifiers: ['static', 'readonly'],
					format: ['UPPER_CASE']
				},
				{
					selector: ['property', 'parameter', 'function', 'method', 'accessor'],
					format: ['camelCase'],
					custom: {
						regex: '^(?!.*[A-Z]{2,})[a-z][A-Za-z0-9]*$',
						match: true
					}
				},
				{
					selector: 'default',
					format: ['camelCase'],
					custom: {
						regex: '^(?!.*[A-Z]{2,})[a-z][A-Za-z0-9]*$',
						match: true
					}
				}
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Override or add rule settings here, such as:
		// 'svelte/button-has-type': 'error'
		rules: {}
	}
);
