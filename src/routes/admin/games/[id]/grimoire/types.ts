import { isCanvasLayer, type CanvasLayer } from "$lib/components/DrawableCanvas2/types";
import { v7 } from "uuid";

export type PlacedToken = {
    characterId: number;
    isDead: boolean;
    x: number;
    y: number;
};

export type PlacedReminder = {
    tokenId: number;
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

export type GrimoireStateHistory = {
    saveslots: (GrimoireStateSnapshot | null)[];
    present: GrimoireStateSnapshot;
};

function isPlacedToken(obj: any): obj is PlacedToken {
    const result = typeof obj === "object" &&
        typeof obj.x === "number" && isFinite(obj.x) &&
        typeof obj.y === "number" && isFinite(obj.y) &&
        typeof obj.characterId === "number" &&
        typeof obj.isDead === "boolean";
    if(!result){
        console.error("Invalid PlacedToken object:", obj);
    }
    return result;
}

function isPlacedReminder(obj: any): obj is PlacedReminder {
    const result = typeof obj === "object" &&
        typeof obj.x === "number" && isFinite(obj.x) &&
        typeof obj.y === "number" && isFinite(obj.y) &&
        typeof obj.tokenId === "number";
    if(!result){
        console.error("Invalid PlacedReminder object:", obj);
    }
    return result;

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

export function validateGrimoireStateHistory(obj: any): obj is GrimoireStateHistory {
    return typeof obj === "object" &&
        Array.isArray(obj.saveslots) &&
        obj.saveslots.every((slot: any) => slot === null || validateGrimoireState(slot)) &&
        validateGrimoireState(obj.present);
}

export function newGrimoireStateHistory(): GrimoireStateHistory {
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
        saveslots: Array(5).fill(null),
        present: initialState
    };
}