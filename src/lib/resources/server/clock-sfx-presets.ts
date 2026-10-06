import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { v7 } from "uuid";
import { isClockSfxPreset, type ClockSfxPreset, type ClockSfxSlot, CLOCK_SFX_SLOTS } from "$lib/audio/common/clockSfxPreset";
import { getAcceptedExtensionsForResourceType } from "../common/types";
import { getMimeTypeForExtension, slugify } from "../common/util";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { findResourceById, getResourceData } from "./resources";

const RESOURCE_DATA_DIR = process.env.RESOURCE_DATA_DIR || "data/resources";
/** The uploaded sounds, as `<presetId>-<slot><ext>`. */
const CLOCK_SFX_FILE_DIR = join(RESOURCE_DATA_DIR, 'clocksfx');

export const ACCEPTED_CLOCK_SFX_EXTENSIONS = getAcceptedExtensionsForResourceType('sfx');

const CLOCK_SFX_PRESET_MANAGER = new JSONMultiResourceManager<ClockSfxPreset>('clocksfx-presets', isClockSfxPreset);

/** Oldest first. */
export function listClockSfxPresets(): ClockSfxPreset[] {
    return [...CLOCK_SFX_PRESET_MANAGER.values].sort((a, b) => a.createdAt - b.createdAt);
}

export function getClockSfxPreset(id: string): ClockSfxPreset | undefined {
    return CLOCK_SFX_PRESET_MANAGER.get(id);
}

export function getDefaultClockSfxPresetId(): string | null {
    return listClockSfxPresets()[0]?.id ?? null;
}

export function createClockSfxPreset(name: string): ClockSfxPreset {
    return CLOCK_SFX_PRESET_MANAGER.add({
        id: v7(),
        name,
        createdAt: Date.now(),
        final: null,
        reminder: null,
        gain: 1,
        balance: 0,
        pan: 0
    } satisfies ClockSfxPreset);
}

export function updateClockSfxPreset(id: string, changes: Pick<ClockSfxPreset, 'name'|'gain'|'balance'|'pan'>): ClockSfxPreset | undefined {
    const preset = getClockSfxPreset(id);
    if(!preset) return undefined;
    return CLOCK_SFX_PRESET_MANAGER.add({
        ...preset,
        name: changes.name,
        gain: changes.gain,
        balance: changes.balance,
        pan: changes.pan
    });
}

export function deleteClockSfxPreset(id: string): boolean {
    const preset = getClockSfxPreset(id);
    if(!preset) return false;
    for(const slot of CLOCK_SFX_SLOTS) removeFile(preset, slot);
    CLOCK_SFX_PRESET_MANAGER.delete(id);
    return true;
}

export function getClockSfxFilePath(preset: ClockSfxPreset, slot: ClockSfxSlot): string | null {
    const file = preset[slot];
    if(!file) return null;
    return join(CLOCK_SFX_FILE_DIR, `${preset.id}-${slot}${file.ext}`);
}

export function getClockSfxFileMimeType(preset: ClockSfxPreset, slot: ClockSfxSlot): string | null {
    const file = preset[slot];
    return file ? getMimeTypeForExtension(file.ext) : null;
}

function removeFile(preset: ClockSfxPreset, slot: ClockSfxSlot) {
    const filepath = getClockSfxFilePath(preset, slot);
    if(filepath && existsSync(filepath)) unlinkSync(filepath);
}

export class UnsupportedClockSfxFileError extends Error {
    constructor(filename: string) {
        super(`Unsupported audio file "${filename}". Allowed: ${ACCEPTED_CLOCK_SFX_EXTENSIONS.join(', ')}`);
        this.name = "UnsupportedClockSfxFileError";
    }
}

/** Stores `data` as the preset's sound for `slot`, replacing any previous one. The extension comes from `filename`. */
export function setClockSfxFile(id: string, slot: ClockSfxSlot, filename: string, data: Buffer): ClockSfxPreset | undefined {
    const preset = getClockSfxPreset(id);
    if(!preset) return undefined;
    const ext = extname(filename).toLowerCase();
    if(!ACCEPTED_CLOCK_SFX_EXTENSIONS.includes(ext)) throw new UnsupportedClockSfxFileError(filename);

    removeFile(preset, slot); // The old one may have had a different extension
    const updated: ClockSfxPreset = { ...preset, [slot]: { ext, version: Date.now() } };
    if(!existsSync(CLOCK_SFX_FILE_DIR)) mkdirSync(CLOCK_SFX_FILE_DIR, { recursive: true });
    writeFileSync(getClockSfxFilePath(updated, slot)!, data);
    return CLOCK_SFX_PRESET_MANAGER.add(updated);
}

export function deleteClockSfxFile(id: string, slot: ClockSfxSlot): ClockSfxPreset | undefined {
    const preset = getClockSfxPreset(id);
    if(!preset) return undefined;
    removeFile(preset, slot);
    return CLOCK_SFX_PRESET_MANAGER.add({ ...preset, [slot]: null });
}

/**
 * Turns a pre-preset clock's own choice of sfx resources into a preset (copying the files over), and returns its
 * id - or null if it had no bells. Clocks that picked the same pair of sounds share one preset.
 */
export function migrateLegacyClockSfx(finalResourceId: string|null, reminderResourceId: string|null): string|null {
    if(!finalResourceId && !reminderResourceId) return null;
    const id = `legacy-${slugify(finalResourceId ?? 'none')}-${slugify(reminderResourceId ?? 'none')}`;
    if(getClockSfxPreset(id)) return id;

    const finalResource = finalResourceId ? findResourceById(finalResourceId) : null;
    const reminderResource = reminderResourceId ? findResourceById(reminderResourceId) : null;
    CLOCK_SFX_PRESET_MANAGER.add({
        id,
        name: `Imported (${finalResource?.name ?? 'none'} / ${reminderResource?.name ?? 'none'})`,
        createdAt: 0, // Before any made by hand, so it stays the default for new games
        final: null,
        reminder: null,
        gain: 1,
        balance: 0,
        pan: 0
    } satisfies ClockSfxPreset);

    for(const [slot, resource] of [['final', finalResource], ['reminder', reminderResource]] as const){
        const data = resource && getResourceData(resource);
        if(data) setClockSfxFile(id, slot, resource.id, data);
    }
    console.log(`Migrated legacy clock bell sounds to clock SFX preset ${id}`);
    return id;
}
