import { JSONMultiResourceManager } from "./jsonResourceManager";
import { slugify } from "../common/util";
import { getCharacterById } from "./characters";
import type { Character } from "../common/gameData";
import {
    isScript,
    type NewScript,
    type Script,
    type ScriptCharacter,
    type ScriptCharacterEntry,
    type ScriptWithCharacters
} from "../common/gameData";

export const SCRIPTS_MANAGER = new JSONMultiResourceManager<Script>('scripts', isScript);

function hydrateCharacters(entries: ScriptCharacterEntry[]): ScriptCharacter[] {
    const characters: ScriptCharacter[] = [];
    for (const entry of entries) {
        const character = getCharacterById(entry.characterId);
        if (!character) {
            console.warn(`Script references unknown character id "${entry.characterId}", skipping.`);
            continue;
        }
        characters.push({
            ...character,
            firstNightOrder: entry.firstNightOrder,
            otherNightOrder: entry.otherNightOrder
        });
    }
    return characters;
}

type NightOrderField = 'firstNightOrder' | 'otherNightOrder';
type DefaultNightOrderField = 'defaultFirstNightOrder' | 'defaultOtherNightOrder';
type WakesField = 'wakes_first_night' | 'wakes_other_nights';

function recalculateNightOrderField(
    entries: ScriptCharacterEntry[],
    characters: Map<string, Character | null>,
    field: NightOrderField,
    defaultField: DefaultNightOrderField,
    wakesField: WakesField
): void {
    // Characters that don't wake this night are expected to stay null forever - they don't
    // signal that a recalculation is needed, and shouldn't be included in the ranking.
    const wakingEntries = entries.filter(e => characters.get(e.characterId)?.[wakesField]);
    if (!wakingEntries.some(e => e[field] === null)) return;

    // Only waking characters with a scraped default can be ranked - a waking character with no
    // default (e.g. a manually-created homebrew character) keeps whatever order it already had.
    const rankable = wakingEntries.filter(e => characters.get(e.characterId)?.[defaultField] != null);
    const rankByCharacterId = new Map(
        [...rankable]
            .sort((a, b) => characters.get(a.characterId)![defaultField]! - characters.get(b.characterId)![defaultField]!)
            .map((e, i) => [e.characterId, i + 1])
    );
    for (const entry of rankable) {
        entry[field] = rankByCharacterId.get(entry.characterId)!;
    }
    for (const entry of entries) {
        if (!characters.get(entry.characterId)?.[wakesField]) entry[field] = null;
    }
}

// Whenever a character that wakes this night is missing an order (e.g. a newly-added
// character), the whole night's order for the script is recalculated from each waking
// character's canonical default night order, rather than leaving gaps.
export function recalculateNightOrders(entries: ScriptCharacterEntry[]): ScriptCharacterEntry[] {
    const recalculated = entries.map(e => ({ ...e }));
    const characters = new Map(recalculated.map(e => [e.characterId, getCharacterById(e.characterId)]));

    recalculateNightOrderField(recalculated, characters, 'firstNightOrder', 'defaultFirstNightOrder', 'wakes_first_night');
    recalculateNightOrderField(recalculated, characters, 'otherNightOrder', 'defaultOtherNightOrder', 'wakes_other_nights');

    return recalculated;
}

export function listScripts(): Script[] {
    return [...SCRIPTS_MANAGER.values].sort((a, b) => a.name.localeCompare(b.name));
}

export function listScriptsWithCharacters(): ScriptWithCharacters[] {
    return listScripts().map(s => ({ ...s, characters: hydrateCharacters(s.characters) }));
}

export function getScriptById(id: string): Script | null {
    return SCRIPTS_MANAGER.get(id) ?? null;
}

export function getScriptWithCharacters(id: string): ScriptWithCharacters | null {
    const script = getScriptById(id);
    if (!script) {
        console.warn(`Failed to find script with id "${id}" - not found`);
        return null;
    }
    return { ...script, characters: hydrateCharacters(script.characters) };
}

export function getCharactersForScript(scriptId: string): ScriptCharacter[] {
    const script = getScriptById(scriptId);
    if (!script) return [];
    return hydrateCharacters(script.characters);
}

export function createScript(script: NewScript): Script {
    const id = slugify(script.name);
    if (SCRIPTS_MANAGER.get(id)) {
        throw new Error(`A script with the name "${script.name}" already exists`);
    }
    return SCRIPTS_MANAGER.add({ id, ...script, characters: [] });
}

export function updateScript(id: string, fields: Partial<NewScript>): Script | null {
    const existing = getScriptById(id);
    if (!existing) return null;

    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return existing;

    return SCRIPTS_MANAGER.add({ ...existing, ...Object.fromEntries(entries) });
}

export function deleteScript(id: string): boolean {
    if (!SCRIPTS_MANAGER.get(id)) return false;
    SCRIPTS_MANAGER.delete(id);
    return true;
}

export function addCharacterToScript(scriptId: string, characterId: string): void {
    const script = getScriptById(scriptId);
    if (!script) throw new Error(`No script found with id "${scriptId}"`);
    if (script.characters.some(c => c.characterId === characterId)) return;

    SCRIPTS_MANAGER.add({
        ...script,
        characters: recalculateNightOrders([...script.characters, { characterId, firstNightOrder: null, otherNightOrder: null }])
    });
}

export function removeCharacterFromScript(scriptId: string, characterId: string): boolean {
    const script = getScriptById(scriptId);
    if (!script) return false;

    const characters = script.characters.filter(c => c.characterId !== characterId);
    if (characters.length === script.characters.length) return false;

    SCRIPTS_MANAGER.add({ ...script, characters });
    return true;
}

export type ScriptCharacterInput = {
    characterId: string;
    firstNightOrder: number | null;
    otherNightOrder: number | null;
};

export function setScriptCharacters(scriptId: string, entries: ScriptCharacterInput[]): void {
    const script = getScriptById(scriptId);
    if (!script) throw new Error(`No script found with id "${scriptId}"`);

    SCRIPTS_MANAGER.add({ ...script, characters: recalculateNightOrders(entries) });
}
