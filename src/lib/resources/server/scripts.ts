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

// Scripts saved before the script's own night order was told apart from the character's call it firstNightOrder
// and otherNightOrder.
for (const script of [...SCRIPTS_MANAGER.values]) {
    if (!script.characters.some(e => 'firstNightOrder' in e)) continue;
    SCRIPTS_MANAGER.add({
        ...script,
        characters: script.characters.map(e => {
            const { firstNightOrder, otherNightOrder, ...entry } = e as any;
            return 'firstNightOrder' in e
                ? { ...entry, scriptFirstNightOrder: firstNightOrder, scriptOtherNightOrder: otherNightOrder }
                : e;
        })
    });
}

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
            scriptFirstNightOrder: entry.scriptFirstNightOrder,
            scriptOtherNightOrder: entry.scriptOtherNightOrder
        });
    }
    return characters;
}

type ScriptNightOrderField = 'scriptFirstNightOrder' | 'scriptOtherNightOrder';
type NightOrderField = 'firstNightOrder' | 'otherNightOrder';

function recalculateNightOrderField(
    entries: ScriptCharacterEntry[],
    characters: Map<string, Character | null>,
    field: ScriptNightOrderField,
    characterField: NightOrderField
): void {
    // A character wakes this night when it has an order for it. Characters that don't wake are
    // expected to stay null forever - they don't signal that a recalculation is needed, and
    // shouldn't be included in the ranking.
    const wakes = (e: ScriptCharacterEntry) => characters.get(e.characterId)?.[characterField] != null;
    const wakingEntries = entries.filter(wakes);
    if (wakingEntries.some(e => e[field] === null)) {
        const rankByCharacterId = new Map(
            [...wakingEntries]
                .sort((a, b) => characters.get(a.characterId)![characterField]! - characters.get(b.characterId)![characterField]!)
                .map((e, i) => [e.characterId, i + 1])
        );
        for (const entry of wakingEntries) {
            entry[field] = rankByCharacterId.get(entry.characterId)!;
        }
    }
    for (const entry of entries) {
        if (!wakes(entry)) entry[field] = null;
    }
}

// Whenever a character that wakes this night is missing an order (e.g. a newly-added
// character), the whole night's order for the script is recalculated from each waking
// character's canonical night order, rather than leaving gaps.
export function recalculateNightOrders(entries: ScriptCharacterEntry[]): ScriptCharacterEntry[] {
    const recalculated = entries.map(e => ({ ...e }));
    const characters = new Map(recalculated.map(e => [e.characterId, getCharacterById(e.characterId)]));

    recalculateNightOrderField(recalculated, characters, 'scriptFirstNightOrder', 'firstNightOrder');
    recalculateNightOrderField(recalculated, characters, 'scriptOtherNightOrder', 'otherNightOrder');

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
        characters: recalculateNightOrders([...script.characters, { characterId, scriptFirstNightOrder: null, scriptOtherNightOrder: null }])
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

export type ScriptCharacterInput = ScriptCharacterEntry;

export function setScriptCharacters(scriptId: string, entries: ScriptCharacterInput[]): void {
    const script = getScriptById(scriptId);
    if (!script) throw new Error(`No script found with id "${scriptId}"`);

    SCRIPTS_MANAGER.add({ ...script, characters: recalculateNightOrders(entries) });
}
