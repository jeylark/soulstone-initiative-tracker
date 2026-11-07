import type { StableId } from '#lib/challenge';

/** Initiative placement choices exposed by the turn editor. */
export type InitiativeChoice =
	/** Calculate initiative in the app. */
	| 'roll-app'
	/** Enter an initiative result manually. */
	| 'roll-manual'
	/** Use a fixed initiative value. */
	| 'static'
	/** Place the turn at a fixed position from the top. */
	| 'fixed-top'
	/** Place the turn at a fixed position from the bottom. */
	| 'fixed-bottom'
	/** Place the turn before another turn. */
	| 'relative-before'
	/** Place the turn after another turn. */
	| 'relative-after';

/** A typed update emitted by one of the turn editor's controls. */
export type TurnEditorChange =
	| {
			/** Discriminant selecting a replacement placement mode. */
			kind: 'choice';
			/** New placement mode selected in the editor. */
			choice: InitiativeChoice;
	  }
	| {
			/** Discriminant selecting a fixed-value update. */
			kind: 'static-value';
			/** New fixed initiative value. */
			value: number;
	  }
	| {
			/** Discriminant selecting a fixed-position origin update. */
			kind: 'fixed-from';
			/** End of the order from which the position is counted. */
			from: 'top' | 'bottom';
	  }
	| {
			/** Discriminant selecting a fixed-position update. */
			kind: 'fixed-position';
			/** New one-based position from the selected end. */
			position: number;
	  }
	| {
			/** Discriminant selecting a relative-placement relation update. */
			kind: 'relative-relation';
			/** Whether this turn is placed before or after its target. */
			relation: 'before' | 'after';
	  }
	| {
			/** Discriminant selecting a relative-placement distance update. */
			kind: 'relative-distance';
			/** New number of positions between this turn and its target. */
			distance: number;
	  }
	| {
			/** Discriminant selecting a relative-placement target update. */
			kind: 'relative-target';
			/** Stable ID of the turn that determines this turn's position. */
			targetTurnId: StableId;
	  };

/** A turn available as a target for relative placement. */
export interface TurnTarget {
	/** Stable ID used to refer to the target turn. */
	id: StableId;
	/** Human-readable target name shown in the selector. */
	name: string;
}
