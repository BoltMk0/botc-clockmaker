import { v7 } from "uuid";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { getScriptWithCharacters } from "./scripts";
import { isPreset, type Preset, type PresetFull, type NewPreset } from "../common/gameData";

export const PRESETS_MANAGER = new JSONMultiResourceManager<Preset>('presets', isPreset);

// Presets saved before victories were tracked have no counts on disk.
function withDefaults(preset: Preset): Preset {
    return { ...preset, evil_victories: preset.evil_victories ?? 0, good_victories: preset.good_victories ?? 0 };
}

function hydrate(preset: Preset): PresetFull {
    const script = getScriptWithCharacters(preset.script_id);
    if (!script) throw new Error(`Failed to load script with id "${preset.script_id}" for preset with id "${preset.id}"`);
    return { ...preset, script };
}

export function getPreset(id: string): Preset | null {
    const preset = PRESETS_MANAGER.get(id);
    return preset ? withDefaults(preset) : null;
}

export function getFullPreset(id: string): PresetFull | null {
    const preset = getPreset(id);
    if (!preset) return null;
    return hydrate(preset);
}

export function listPresets(): Preset[] {
    return [...PRESETS_MANAGER.values].map(withDefaults);
}

export function listPresetsForScript(scriptId: string): Preset[] {
    return listPresets().filter(p => p.script_id === scriptId);
}

export function listFullPresets(): PresetFull[] {
    return listPresets().map(hydrate);
}

export function createPreset(preset: NewPreset): Preset {
    const newPreset: Preset = {
        id: v7(),
        name: preset.name,
        script_id: preset.script_id,
        character_ids: preset.character_ids ?? [],
        bluff_ids: preset.bluff_ids ?? [],
        evil_victories: 0,
        good_victories: 0
    };
    const created = PRESETS_MANAGER.add(newPreset);
    console.log("Created preset with id", created.id);
    return created;
}

export function updatePreset(id: string, fields: Partial<NewPreset>): Preset | null {
    const existing = getPreset(id);
    if (!existing) return null;

    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return existing;

    return PRESETS_MANAGER.add({ ...existing, ...Object.fromEntries(entries) });
}

export function recordPresetVictory(id: string, winner: 'good' | 'evil'): Preset | null {
    const existing = getPreset(id);
    if (!existing) return null;
    return PRESETS_MANAGER.add({
        ...existing,
        good_victories: existing.good_victories + (winner === 'good' ? 1 : 0),
        evil_victories: existing.evil_victories + (winner === 'evil' ? 1 : 0)
    });
}

export function deletePreset(id: string): boolean {
    if (!PRESETS_MANAGER.get(id)) return false;
    PRESETS_MANAGER.delete(id);
    return true;
}
