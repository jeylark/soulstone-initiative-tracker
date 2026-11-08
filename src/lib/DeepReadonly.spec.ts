import { describe, expect, expectTypeOf, it } from 'vitest';
import type { DeepReadonly } from './DeepReadonly';

describe('DeepReadonly', () => {
	it('recursively marks object properties and arrays readonly while preserving Date', () => {
		type Input = {
			name: string;
			nested: { values: number[] };
			updatedAt: Date;
		};
		type Expected = {
			readonly name: string;
			readonly nested: { readonly values: readonly number[] };
			readonly updatedAt: Date;
		};

		expectTypeOf<DeepReadonly<Input>>().toEqualTypeOf<Expected>();

		const value: DeepReadonly<Input> = {
			name: 'Aria',
			nested: { values: [1, 2] },
			updatedAt: new Date('2025-01-02T03:04:05.000Z')
		};
		expect(value.updatedAt).toBeInstanceOf(Date);
	});
});
