import type { Readable, Writable } from "svelte/store";

type CanvasToolTypeBase = {
    type: string;
}

type CanvasPenToolType = CanvasToolTypeBase & {
    type: "pen";
    color: string;
    width: number;
}

type CanvasEraserToolType = CanvasToolTypeBase & {
    type: "eraser";
    width: number;
}

export type CanvasPoint = {
    x: number;
    y: number;
}

export type CanvasStroke = {
    tool: CanvasToolType;
    points: CanvasPoint[];
}

export type CanvasLayer = {
    strokes: CanvasStroke[];
}

export type CanvasToolType = CanvasPenToolType | CanvasEraserToolType;

export function validateToolType(obj: any): obj is CanvasToolType {
    if (typeof obj !== 'object' || typeof obj.type !== 'string') return false;
    switch (obj.type) {
        case 'pen':
            return typeof obj.color === 'string' && typeof obj.width === 'number' && isFinite(obj.width) && obj.width > 0;
        case 'eraser':
            return typeof obj.width === 'number' && isFinite(obj.width) && obj.width > 0;
        default:
            return false;
    }
}

export function isTool(obj: any): obj is CanvasToolType {
    return validateToolType(obj);
}

export function isPoint(obj: any): obj is CanvasPoint{
    return typeof obj === 'object' &&
        typeof obj.x === 'number' && isFinite(obj.x) &&
        typeof obj.y === 'number' && isFinite(obj.y);
}

export type LayerControls = {
    createLayer: () => void;
    layers: () => Writable<CanvasLayer[]>;
    activeLayerIndex: () => Writable<number>;
    clearLayer: (index: number) => void;
    deleteLayer: (index: number) => void;
    setActiveLayer: (index: number) => void;
}