import { v7 } from "uuid";
import { JSONMultiResourceManager } from "$lib/resources/server/jsonResourceManager";
import { isLightingPreset, newLightingPreset, normalizeLightingPreset, type LightingPreset } from "../common/lightingPreset";

const LIGHTING_PRESET_MANAGER = new JSONMultiResourceManager<LightingPreset>('lighting-presets', isLightingPreset);

/** Oldest first. */
export function listLightingPresets(): LightingPreset[] {
    return [...LIGHTING_PRESET_MANAGER.values].sort((a, b) => a.createdAt - b.createdAt);
}

export function getLightingPreset(id: string): LightingPreset | undefined {
    return LIGHTING_PRESET_MANAGER.get(id);
}

/** The oldest preset, used by games that haven't picked one (as clock sounds do). */
export function getDefaultLightingPresetId(): string | null {
    return listLightingPresets()[0]?.id ?? null;
}

/** The preset a game uses: the one it picked, if it's still there, or the default. */
export function lightingPresetFor(presetId: string | null | undefined): LightingPreset | null {
    const picked = presetId ? getLightingPreset(presetId) : undefined;
    if(picked) return picked;
    const fallback = getDefaultLightingPresetId();
    return fallback ? getLightingPreset(fallback) ?? null : null;
}

export function createLightingPreset(name: string): LightingPreset {
    return LIGHTING_PRESET_MANAGER.add(newLightingPreset(v7(), name));
}

/** Saves a preset as given (from the editor), keeping its id and when it was made. Throws a LightingPresetError if it's wrong. */
export function saveLightingPreset(id: string, value: unknown): LightingPreset | undefined {
    const existing = getLightingPreset(id);
    if(!existing) return undefined;
    const preset = normalizeLightingPreset({ ...(value as object), id, createdAt: existing.createdAt });
    return LIGHTING_PRESET_MANAGER.add(preset);
}

export function addLightingPreset(preset: LightingPreset): LightingPreset {
    return LIGHTING_PRESET_MANAGER.add(preset);
}

export function duplicateLightingPreset(id: string): LightingPreset | undefined {
    const existing = getLightingPreset(id);
    if(!existing) return undefined;
    return LIGHTING_PRESET_MANAGER.add({ ...structuredClone(existing), id: v7(), name: `${existing.name} (copy)`, createdAt: Date.now() });
}

export function deleteLightingPreset(id: string): boolean {
    if(!getLightingPreset(id)) return false;
    LIGHTING_PRESET_MANAGER.delete(id);
    return true;
}
