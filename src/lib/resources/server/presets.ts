import { v7 } from "uuid";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { getScriptWithCharacters } from "./scripts";
import { isPreset, bluffSetsOf, type Preset, type PresetFull, type NewPreset } from "../common/gameData";
import { isPresetPlay, todayPlayDate, type PresetPlay, type PresetPlaySummary, type PresetWinner } from "../common/presetPlays";

export const PRESETS_MANAGER = new JSONMultiResourceManager<Preset>('presets', isPreset);
/** Each game played from a preset, kept apart from the presets so their grim snapshots don't weigh down preset lists. */
export const PRESET_PLAYS_MANAGER = new JSONMultiResourceManager<PresetPlay>('preset-plays', isPresetPlay);

// Presets saved before victories were tracked have no counts on disk.
function withDefaults(preset: Preset): Preset {
    const { bluff_ids: _legacy, ...rest } = preset;
    return { ...rest, bluff_sets: bluffSetsOf(preset), evil_victories: preset.evil_victories ?? 0, good_victories: preset.good_victories ?? 0 };
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
        grim_character_ids: preset.grim_character_ids,
        bluff_sets: preset.bluff_sets ?? [],
        rating: preset.rating ?? null,
        notes: preset.notes ?? '',
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

function adjustVictories(preset: Preset, winner: PresetWinner, by: 1 | -1): Preset {
    return PRESETS_MANAGER.add({
        ...preset,
        good_victories: Math.max(0, preset.good_victories + (winner === 'good' ? by : 0)),
        evil_victories: Math.max(0, preset.evil_victories + (winner === 'evil' ? by : 0))
    });
}

/**
 * Logs a game played from the preset and credits its winner. The victory counts also cover games from before plays
 * were logged, so they can be higher than the number of logged plays.
 */
export function recordPresetVictory(id: string, winner: PresetWinner, details: Pick<PresetPlay, 'grim'> & { date?: string } = {}): { preset: Preset, play: PresetPlay } | null {
    const existing = getPreset(id);
    if (!existing) return null;
    const play = PRESET_PLAYS_MANAGER.add({
        id: v7(),
        preset_id: id,
        date: details.date ?? todayPlayDate(),
        winner,
        ...(details.grim ? { grim: details.grim } : {})
    } satisfies PresetPlay);
    return { preset: adjustVictories(existing, winner, 1), play };
}

/** The preset's logged plays, most recent first. */
export function listPresetPlays(presetId: string): PresetPlay[] {
    return PRESET_PLAYS_MANAGER.values
        .filter(p => p.preset_id === presetId)
        // Ids are time-ordered (v7), so they break ties between plays on the same day.
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

export function summarisePresetPlay({ grim, ...rest }: PresetPlay): PresetPlaySummary {
    return { ...rest, has_grim: !!grim };
}

export function getPresetPlay(presetId: string, playId: string): PresetPlay | null {
    const play = PRESET_PLAYS_MANAGER.get(playId);
    return play?.preset_id === presetId ? play : null;
}

/** Deletes a logged play and takes its win back off the preset's counts. */
export function deletePresetPlay(presetId: string, playId: string): Preset | null {
    const play = getPresetPlay(presetId, playId);
    const preset = getPreset(presetId);
    if (!play || !preset) return null;
    PRESET_PLAYS_MANAGER.delete(playId);
    return adjustVictories(preset, play.winner, -1);
}

export function deletePreset(id: string): boolean {
    if (!PRESETS_MANAGER.get(id)) return false;
    PRESETS_MANAGER.delete(id);
    for (const play of listPresetPlays(id)) PRESET_PLAYS_MANAGER.delete(play.id);
    return true;
}
