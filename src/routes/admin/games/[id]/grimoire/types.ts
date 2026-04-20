import type { ReminderToken, ScriptCharacter } from "$lib/common/database/types";
import type { CanvasLayer, CanvasToolType } from "$lib/components/DrawableCanvas2/types";

export type PlacedToken = {
    character: ScriptCharacter;
    isDead: boolean;
    x: number;
    y: number;
};

export type PlacedReminder = {
    token: ReminderToken;
    x: number;
    y: number;
};

export type SavedToken = { characterId: number; isDead: boolean; x: number; y: number };
export type SavedReminder = { tokenId: number; characterId: number; text: string | null; x: number; y: number };


export type GrimoireStateSnapshot = {
    placedTokens: PlacedToken[];
    placedReminders: PlacedReminder[];
    canvas: {
        layers: CanvasLayer[];
        tools: CanvasToolType[];
    }
}

export function validateGrimoireState(obj: any): obj is GrimoireStateSnapshot {
    return typeof obj === "object" &&
        Array.isArray(obj.placedTokens) &&
        obj.placedTokens.every((token: any) =>
            typeof token === "object" &&
            typeof token.x === "number" && isFinite(token.x) &&
            typeof token.y === "number" && isFinite(token.y) &&
            typeof token.character === "object" &&
            typeof token.character.id === "number"
        ) &&
        Array.isArray(obj.placedReminders) &&
        obj.placedReminders.every((reminder: any) =>
            typeof reminder === "object" &&
            typeof reminder.x === "number" && isFinite(reminder.x) &&
            typeof reminder.y === "number" && isFinite(reminder.y) &&
            typeof reminder.token === "object" &&
            typeof reminder.token.id === "string"
        ) &&
        typeof obj.canvas === "object" &&
        Array.isArray(obj.canvas.layers) &&
        obj.canvas.layers.every((layer: any) =>
            typeof layer === "object" &&
            Array.isArray(layer.strokes) &&
            layer.strokes.every((stroke: any) =>
                typeof stroke === "object" &&
                Array.isArray(stroke.points) &&
                stroke.points.every((point: any) =>
                    typeof point === "object" &&
                    typeof point.x === "number" && isFinite(point.x) &&
                    typeof point.y === "number" && isFinite(point.y)
                ) &&
                typeof stroke.tool === "object" &&
                typeof stroke.tool.type === "string"
            )
        ) &&
        Array.isArray(obj.canvas.tools) &&
        obj.canvas.tools.every((tool: any) =>
            typeof tool === "object" &&
            typeof tool.type === "string"
        );
}