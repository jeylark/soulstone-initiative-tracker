import type { StableId } from '#lib';

export type InitiativeChoice =
	| 'none'
	| 'roll-app'
	| 'roll-manual'
	| 'static'
	| 'fixed-top'
	| 'fixed-bottom'
	| 'relative-before'
	| 'relative-after';

export type TurnEditorChange =
	| { kind: 'choice'; choice: InitiativeChoice }
	| { kind: 'static-value'; value: number }
	| { kind: 'fixed-from'; from: 'top' | 'bottom' }
	| { kind: 'fixed-position'; position: number }
	| { kind: 'relative-relation'; relation: 'before' | 'after' }
	| { kind: 'relative-distance'; distance: number }
	| { kind: 'relative-target'; targetTurnId: StableId };

export interface TurnTarget {
	id: StableId;
	name: string;
}
