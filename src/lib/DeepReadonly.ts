/**
 * Recursively marks a value and its nested properties as readonly.
 * @typeParam T Type whose nested properties should be readonly.
 */
export type DeepReadonly<T> = T extends (...args: any[]) => unknown
	? T
	: T extends readonly unknown[]
		? {
				readonly [P in keyof T]: DeepReadonly<T[P]>;
			}
		: T extends object
			? {
					readonly [P in keyof T]: DeepReadonly<T[P]>;
				}
			: T;
