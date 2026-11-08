import type { ValidationIssue } from '#lib/challenge';

/**
 * Finds the validation message for one setup field.
 * @param issues Setup validation issues for the challenge.
 * @param path Data path of the field, such as `$.creatures[0].name`.
 * @returns The messages for the path joined with spaces, or `undefined` when the field is valid.
 */
export function issueMessage(issues: readonly ValidationIssue[], path: string): string | undefined {
	const messages = issues.filter((issue) => issue.path === path).map((issue) => issue.message);
	return messages.length > 0 ? messages.join(' ') : undefined;
}
