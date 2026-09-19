import { isCanvasLayer, type CanvasLayer } from "$lib/components/DrawableCanvas2/types";
import { v7 } from "uuid";

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
    bluff_ids: string[];
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
        Array.isArray(obj.bluff_ids) && obj.bluff_ids.every((id: any) => typeof id === "string");
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

// Evenly distributes n points around a circle of the given radius (px, relative to board
// center - see PlacedToken.x/y), starting at the top and going clockwise.
export function computeCirclePositions(n: number, radius: number = 440): { x: number, y: number }[] {
    return Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
        return { x: Math.round(radius * Math.cos(angle)), y: Math.round(radius * Math.sin(angle)) };
    });
}

// Y of the row of off-seat tokens: above the top seat of the default circle (radius 440) with room to spare.
const OFF_SEAT_ROW_Y = -700;

// Lays n points out in a horizontal row centred on x = 0.
export function computeRowPositions(n: number, y: number, spacing: number = 170): { x: number, y: number }[] {
    return Array.from({ length: n }, (_, i) => ({ x: Math.round((i - (n - 1) / 2) * spacing), y }));
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
export function layoutTokensAtDefaultPositions(
    tokens: PlacedToken[],
    reminders: PlacedReminder[],
    isFixed: (token: PlacedToken) => boolean = () => false
): { tokens: PlacedToken[], reminders: PlacedReminder[] } {
    const players = tokens.filter(t => isPlayerToken(t) && !isFixed(t));
    if (players.length === 0) return { tokens, reminders };

    const newPositionOf = new Map<PlacedToken, { x: number, y: number }>();
    const circle = computeCirclePositions(players.length);
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
    bluffIds: string[],
    offSeats: { characterId: string, alignment: Alignment }[] = []
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
    // Characters that don't take a seat (player_count == 0) sit in a row above the town, apart from it.
    const rowPositions = computeRowPositions(offSeats.length, OFF_SEAT_ROW_Y);
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
        bluff_ids: bluffIds
    };
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
