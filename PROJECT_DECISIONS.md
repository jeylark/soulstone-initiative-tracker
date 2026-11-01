# Soulstone Initiative Tracker: Project Decisions

This document records the product and architecture decisions discussed so far. It is intended as a handoff point for future work.

## Product

- The app is a helper for **Soulstone**, a custom dungeon crawler.
- A **challenge** may take one play session or span several sessions.
- A **creature** belongs to a faction and has a name. A player-controlled **character** is a creature. Other creatures are **NPCs**.
- Each NPC has a **creature type**. Multiple NPCs can share a type; an NPC's name combines its type with a custom identifier.
- A challenge has configurable factions. "Player" and "Monster" are common examples, not required faction names or a fixed limit.
- A creature usually has one turn, but may have zero or multiple turns.
- Each turn may have its own initiative value. Players roll initiative and the DM enters the results; a value may also be set directly.
- To roll initiative, roll a number of d6 equal to the creature's initiative stat and sum the highest three dice, or all dice if fewer than three were rolled.
- For each turn, the DM can choose to roll initiative, enter a static initiative value, place it at the Nth position from the top or bottom, or place it N positions before or after a specified turn. Position-based placement is applied after the rest of the list is calculated.
- Turn-order generation takes the ordered lists of initiative values and the hooked initiatives for each faction as inputs, and produces an ordered list of turns.
- By default, players roll and the DM enters their results; the app rolls for NPCs. The DM can choose otherwise.
- Existing rolled initiative results remain unchanged when the order is recalculated. The DM must explicitly reroll to change them.
- When two turns in the same faction have the same rolled initiative, the DM decides which goes first. Other initiative tie-break criteria are not decided yet.
- The DM can hide or show a creature's turns in the list. In the DM view, hidden turns remain visible but are greyed out. In read-only view, hidden turns are omitted.
- At the end of the turn list, each round has a **Spawn** step. The DM can add creatures to or remove creatures from the challenge there. Changes may require the turn order to be recalculated.

## Challenge workflow

1. The DM creates a challenge or loads one from their device.
2. The DM can reuse player characters from a previous challenge. Groups may have different DMs, players, and characters; their membership can also change.
3. The DM specifies the NPC creature types that appear in the challenge.
4. The DM adds creatures to factions, including any factions needed beyond the common Player and Monster factions.
5. Where needed, the DM sets a creature's turn count and how turns without initiative are ordered.
6. Players roll initiative; the DM records the results.
7. The DM starts or resumes the challenge, and the turn order is calculated.
8. Creatures take their turns in order. At the end of the list, the DM handles Spawn and the order is recalculated when necessary.

## App navigation and views

- The landing page offers:
  - Create a new challenge.
  - Load an existing challenge.
  - Display a running challenge in read-only mode.
- The UI will use **Svelte** and be organized into components.
- The DM manages the challenge. A read-only view on another device shows the running turn order without editing capabilities.
- The read-only view updates during play. Its connection and sharing mechanism have not been chosen yet.

## Storage and hosting

- The app should be hostable on the user's own server.
- The DM's challenge library and other required persistent challenge data live in the browser, using **IndexedDB**.
- The DM can download challenge data as a file for backup or transfer between devices. The exact file format and import/export workflow remain to be specified.
- Starting or resuming a challenge sends the data needed for sharing to the server, which keeps the active session **in memory only**.
- The DM must be able to reload or restart their browser and regain access to the session they were managing, as long as the server session is still running.
- Ending a session removes its data from server memory.
- Because there is no server-side persistence in this design, a server restart or crash loses active sessions. The DM can restore from their local challenge and start a new session; viewers would need to reconnect.
- PostgreSQL and other persistent server-side databases are not part of the current design.

## Still to decide

- How read-only viewers join a live session and how the DM securely reconnects after a browser restart.
- The challenge file format and import behavior.
- Exact Svelte/server framework, deployment details, and any authentication requirements.
- Whether a future session should persist through server restarts; the current choice is no.
