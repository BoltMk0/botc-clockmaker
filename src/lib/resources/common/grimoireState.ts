import { isCanvasLayer, type CanvasLayer } from "$lib/components/DrawableCanvas2/types";
import { v7 } from "uuid";

export type Alignment = 'good' | 'evil';

export type PlacedToken = {
    characterId: string;
    isDead: boolean;
    alignment: Alignment;
    x: number;
    y: number;
    playerName?: string;
};

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
        typeof obj.characterId === "string" &&
        typeof obj.isDead === "boolean" &&
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

// Puts every token back at its default start position: tokens that take a seat go round the circle (in their
// current order), the rest go in the row above it. Everything else about each token is left as it was.
export function layoutTokensAtDefaultPositions(
    tokens: PlacedToken[],
    takesSeat: (characterId: string) => boolean
): PlacedToken[] {
    const seatCount = tokens.filter(t => takesSeat(t.characterId)).length;
    const circle = computeCirclePositions(seatCount);
    const row = computeRowPositions(tokens.length - seatCount, OFF_SEAT_ROW_Y);
    let seatIndex = 0;
    let rowIndex = 0;
    return tokens.map(t => ({ ...t, ...(takesSeat(t.characterId) ? circle[seatIndex++] : row[rowIndex++]) }));
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
