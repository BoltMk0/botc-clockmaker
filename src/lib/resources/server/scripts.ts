import { JSONMultiResourceManager } from "./jsonResourceManager";
import { slugify } from "../common/util";
import { getCharacterById } from "./characters";
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
        characters: [...script.characters, { characterId, firstNightOrder: null, otherNightOrder: null }]
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

    SCRIPTS_MANAGER.add({ ...script, characters: entries });
}
