/**
 * Recursively marks a value and its nested properties as readonly.
 * @typeParam T Type whose nested properties should be readonly.
 */

export type DeepReadonly<T> = T extends readonly (infer U)[]
	? readonly DeepReadonly<U>[]
	: T extends Date
		? Date
		: T extends object
			? {
					readonly [K in keyof T]: DeepReadonly<T[K]>;
				}
			: T;
