import { isCanvasLayer, type CanvasLayer } from "$lib/components/DrawableCanvas2/types";
import { v7 } from "uuid";
import { hasValidBluffs } from "./gameData";

export type Alignment = 'good' | 'evil';

// A token on the board. A token with a non-empty playerName is a player (they take a seat and count towards
// the player count); the character is just what's currently assigned to them, and may be null until the
// storyteller picks one. A token with no player name is only a character token, kept as a reminder.
export type PlacedToken = {
    id: string;
    characterId: string | null;
    isDead: boolean;
    // Dead players get one vote for the rest of the game; this is set once they've spent it.
    deadVoteUsed?: boolean;
    alignment: Alignment;
    x: number;
    y: number;
    playerName?: string;
};

export function hasDeadVote(token: { isDead: boolean; deadVoteUsed?: boolean }): boolean {
    return token.isDead && !token.deadVoteUsed;
}

export function isPlayerToken(token: PlacedToken): boolean {
    return (token.playerName ?? '').trim() !== '';
}

// Older saves have no token ids; give each token one so it can be tracked independently of its character.
export function ensureTokenIds<T extends { present: GrimoireStateSnapshot, saveslots: (GrimoireStateSnapshot | null)[] }>(history: T): T {
    for (const snap of [history.present, ...history.saveslots]) {
        for (const token of snap?.placedTokens ?? []) {
            if (typeof token.id !== 'string') token.id = v7();
        }
    }
    return history;
}

export type PlacedReminder = {
    tokenId: string;
    x: number;
    y: number;
};

export type GrimoireStateSnapshot = {
    id: string;
    previousSnapshotId: string | null;
    timestamp: number;
    placedTokens: PlacedToken[];
    placedReminders: PlacedReminder[];
    canvas: {
        layers: CanvasLayer[];
    }
};

export type LoadedPreset = {
    character_ids: string[];
    bluff_sets?: string[][];
    /** Legacy: a single bluff set, from before multiple sets were supported. */
    bluff_ids?: string[];
    // The saved preset this game was set up from, if any; used to credit it with the game's result.
    preset_id?: string | null;
};

export type GrimoireStateHistory = {
    id: string; // clockid
    scriptId: string | null;
    loadedPreset: LoadedPreset | null;
    saveslots: (GrimoireStateSnapshot | null)[];
    present: GrimoireStateSnapshot;
};

function isPlacedToken(obj: any): obj is PlacedToken {
    const result = typeof obj === "object" &&
        typeof obj.x === "number" && isFinite(obj.x) &&
        typeof obj.y === "number" && isFinite(obj.y) &&
        (obj.id === undefined || typeof obj.id === "string") &&
        (obj.characterId === null || typeof obj.characterId === "string") &&
        typeof obj.isDead === "boolean" &&
        (obj.deadVoteUsed === undefined || typeof obj.deadVoteUsed === "boolean") &&
        (obj.alignment === undefined || obj.alignment === "good" || obj.alignment === "evil") &&
        (obj.playerName === undefined || typeof obj.playerName === "string");
    if(!result){
        console.error("Invalid PlacedToken object:", obj);
    }
    return result;
}

function isPlacedReminder(obj: any): obj is PlacedReminder {
    const result = typeof obj === "object" &&
        typeof obj.x === "number" && isFinite(obj.x) &&
        typeof obj.y === "number" && isFinite(obj.y) &&
        typeof obj.tokenId === "string";
    if(!result){
        console.error("Invalid PlacedReminder object:", obj);
    }
    return result;

}

function isLoadedPreset(obj: any): obj is LoadedPreset {
    return typeof obj === "object" &&
        Array.isArray(obj.character_ids) && obj.character_ids.every((id: any) => typeof id === "string") &&
        hasValidBluffs(obj) &&
        (obj.preset_id === undefined || obj.preset_id === null || typeof obj.preset_id === "string");
}

export function validateGrimoireState(obj: any): obj is GrimoireStateSnapshot {
    return typeof obj === "object" &&
        typeof obj.id === "string" &&
        (obj.previousSnapshotId === null || typeof obj.previousSnapshotId === "string") &&
        typeof obj.timestamp === "number" && isFinite(obj.timestamp) &&
        Array.isArray(obj.placedTokens) &&
        obj.placedTokens.every((token: any) => isPlacedToken(token)) &&
        Array.isArray(obj.placedReminders) &&
        obj.placedReminders.every((reminder: any) => isPlacedReminder(reminder)) &&
        typeof obj.canvas === "object" &&
        Array.isArray(obj.placedReminders) &&
        obj.placedReminders.every((reminder: any) => isPlacedReminder(reminder)) &&
        typeof obj.canvas === "object" &&
        Array.isArray(obj.canvas.layers) &&
        obj.canvas.layers.every((layer: any) =>
            isCanvasLayer(layer)
        );
}

export function isGrimoireStateHistory(obj: any): obj is GrimoireStateHistory {
    return obj !== null && obj !== undefined && typeof obj === "object" &&
        (obj.scriptId === null || typeof obj.scriptId === "string") &&
        (obj.loadedPreset === null || isLoadedPreset(obj.loadedPreset)) &&
        Array.isArray(obj.saveslots) &&
        obj.saveslots.every((slot: any) => slot === null || validateGrimoireState(slot)) &&
        validateGrimoireState(obj.present);
}

// Diameter of a token on the grim board, in board px (the view zooms to fit the screen, so this never changes).
export const BOARD_TOKEN_SIZE = 150;
// Radii of the guide rings drawn on the board, as multiples of the token size.
export const ALIGNMENT_RING_FACTORS = [1.9, 2.6, 3.3];

// Radius the players are seated at: the middle guide ring, or the outer one when there are too many players for
// neighbouring tokens to sit clear of each other on the middle one.
export function seatCircleRadius(n: number): number {
    for (const factor of ALIGNMENT_RING_FACTORS.slice(1)) {
        const radius = BOARD_TOKEN_SIZE * factor;
        if (n < 2 || 2 * radius * Math.sin(Math.PI / n) >= BOARD_TOKEN_SIZE) return radius;
    }
    return BOARD_TOKEN_SIZE * ALIGNMENT_RING_FACTORS[ALIGNMENT_RING_FACTORS.length - 1];
}

// Evenly distributes n points around a circle of the given radius (px, relative to board
// center - see PlacedToken.x/y), starting at the top and going clockwise.
export function computeCirclePositions(n: number, radius: number = seatCircleRadius(n)): { x: number, y: number }[] {
    return Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return { x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
    });
}

// Top-left corner of the row of off-seat tokens: above the top seat of the seat circle (outer ring at most) with room to spare.
const OFF_SEAT_ROW_START = { x: -700, y: -700 };

// Lays n points out in a horizontal row, the first at `start` and the rest to its right.
export function computeRowPositions(n: number, start: { x: number, y: number }, spacing: number = 170): { x: number, y: number }[] {
    return Array.from({ length: n }, (_, i) => ({ x: start.x + i * spacing, y: start.y }));
}

// Lays n points out in rows of at most `perRow`, each row centred on x=0, the first at the given y and the rest below it.
export function computeCenteredRowPositions(n: number, y: number, perRow: number = 5, spacing: number = 170): { x: number, y: number }[] {
    return Array.from({ length: n }, (_, i) => {
        const row = Math.floor(i / perRow);
        const inRow = Math.min(perRow, n - row * perRow);
        const totalWidth = (inRow - 1) * spacing;
        return { x: -totalWidth / 2 + (i % perRow) * spacing, y: y + row * spacing };
    });
}

// Clockwise angle of a token around the board centre, from the top (0) round to just under a full turn.
function clockwiseFromTop(t: { x: number, y: number }): number {
    return (Math.atan2(t.y, t.x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
}

const angleOf = (p: { x: number, y: number }) => Math.atan2(p.y, p.x);
// Wraps an angle difference into (-PI, PI].
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

// Spaces the player tokens evenly round the circle, keeping their current order round the table (ranked by
// clockwise angle from the top, so a token dragged in between two others ends up between them). Every other
// token - character tokens with no player name, and reminders - travels with the nearest player by angle: when
// that player moves to their new seat, the token is rotated about the board centre by the same angle, so it
// stays in the same place relative to them. Everything else about each token is left as it was.
// Tokens for which `isFixed` returns true (loric and fabled) stay exactly where they are, and aren't seated as players.
// The players are seated at `radius` (default: see seatCircleRadius).
export function layoutTokensAtDefaultPositions(
    tokens: PlacedToken[],
    reminders: PlacedReminder[],
    isFixed: (token: PlacedToken) => boolean = () => false,
    radius?: number
): { tokens: PlacedToken[], reminders: PlacedReminder[] } {
    const players = tokens.filter(t => isPlayerToken(t) && !isFixed(t));
    if (players.length === 0) return { tokens, reminders };

    const newPositionOf = new Map<PlacedToken, { x: number, y: number }>();
    const circle = computeCirclePositions(players.length, radius ?? seatCircleRadius(players.length));
    [...players].sort((a, b) => clockwiseFromTop(a) - clockwiseFromTop(b))
        .forEach((t, i) => newPositionOf.set(t, circle[i]));

    // How far the nearest player (by angle) rotates about the centre, and so how far to turn a token that follows them.
    const rotationFollowing = (p: { x: number, y: number }): number => {
        const a = angleOf(p);
        let nearest = players[0];
        let nearestDiff = Infinity;
        for (const player of players) {
            const diff = Math.abs(wrapAngle(angleOf(player) - a));
            if (diff < nearestDiff) { nearest = player; nearestDiff = diff; }
        }
        return wrapAngle(angleOf(newPositionOf.get(nearest)!) - angleOf(nearest));
    };
    const rotated = (p: { x: number, y: number }) => {
        const delta = rotationFollowing(p);
        const cos = Math.cos(delta);
        const sin = Math.sin(delta);
        return { x: Math.round(p.x * cos - p.y * sin), y: Math.round(p.x * sin + p.y * cos) };
    };

    return {
        tokens: tokens.map(t => isFixed(t) ? t : ({ ...t, ...(newPositionOf.get(t) ?? rotated(t)) })),
        reminders: reminders.map(r => ({ ...r, ...rotated(r) }))
    };
}

export function newGrimoireStateFromDraw(
    clockId: string,
    scriptId: string,
    seats: { characterId: string, playerName: string, alignment: Alignment }[],
    bluffSets: string[][],
    offSeats: { characterId: string, alignment: Alignment }[] = [],
    presetId: string | null = null
): GrimoireStateHistory {
    const history = newGrimoireStateHistory(clockId, scriptId);
    const positions = computeCirclePositions(seats.length);
    const seatTokens: PlacedToken[] = seats.map((seat, i) => ({
        id: v7(),
        characterId: seat.characterId,
        isDead: false,
        alignment: seat.alignment,
        x: positions[i].x,
        y: positions[i].y,
        playerName: seat.playerName
    }));
    // Tokens sorted onto the grim rather than into the bag sit in a row at the top left, apart from the town.
    const rowPositions = computeRowPositions(offSeats.length, OFF_SEAT_ROW_START);
    const offSeatTokens: PlacedToken[] = offSeats.map((off, i) => ({
        id: v7(),
        characterId: off.characterId,
        isDead: false,
        alignment: off.alignment,
        x: rowPositions[i].x,
        y: rowPositions[i].y
    }));
    history.present.placedTokens = [...seatTokens, ...offSeatTokens];
    history.loadedPreset = {
        character_ids: [...seats.map(s => s.characterId), ...offSeats.map(o => o.characterId)],
        bluff_sets: bluffSets,
        preset_id: presetId
    };
    return history;
}

// Used when going straight to the grim without a draw: every chosen character becomes an unseated
// (no playerName) token laid out in rows of up to 5 from the top of the board, ready for the storyteller to seat by hand.
export function newGrimoireStateWithTokensAlongTop(
    clockId: string,
    scriptId: string,
    characters: { characterId: string, alignment: Alignment }[]
): GrimoireStateHistory {
    const history = newGrimoireStateHistory(clockId, scriptId);
    const positions = computeCenteredRowPositions(characters.length, OFF_SEAT_ROW_START.y);
    history.present.placedTokens = characters.map((c, i) => ({
        id: v7(),
        characterId: c.characterId,
        isDead: false,
        alignment: c.alignment,
        x: positions[i].x,
        y: positions[i].y
    }));
    return history;
}

export function newGrimoireStateHistory(clockId: string, scriptId: string | null = null): GrimoireStateHistory {
    const initialState: GrimoireStateSnapshot = {
        id: v7(),
        previousSnapshotId: null,
        timestamp: Date.now(),
        placedTokens: [],
        placedReminders: [],
        canvas: {
            layers: [{strokes: []}]
        }
    };
    return {
        id: clockId,
        scriptId,
        loadedPreset: null,
        saveslots: Array(5).fill(null),
        present: initialState
    };
}
