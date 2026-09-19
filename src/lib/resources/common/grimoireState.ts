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
