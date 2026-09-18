import { v7 } from "uuid";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { slugify } from "../common/util";
import {
    isCharacter,
    type Character,
    type CharacterCategory,
    type NewCharacter,
    type NewReminderToken,
    type ReminderToken
} from "../common/gameData";

export const CHARACTERS_MANAGER = new JSONMultiResourceManager<Character>('characters', isCharacter);

export function listCharacters(): Character[] {
    return [...CHARACTERS_MANAGER.values].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCharacterByName(name: string): Character | null {
    return CHARACTERS_MANAGER.values.find(c => c.name === name) ?? null;
}

export function getCharacterById(id: string): Character | null {
    return CHARACTERS_MANAGER.get(id) ?? null;
}

export function listCharactersByCategory(category: CharacterCategory): Character[] {
    return listCharacters().filter(c => c.category === category);
}

export function addCharacter(character: NewCharacter): Character {
    const id = slugify(character.name);
    if (CHARACTERS_MANAGER.get(id)) {
        throw new Error(`A character with the name "${character.name}" already exists`);
    }
    return CHARACTERS_MANAGER.add({ id, ...character, reminderTokens: [] });
}

export function updateCharacter(id: string, fields: Partial<NewCharacter>): Character | null {
    const existing = getCharacterById(id);
    if (!existing) return null;

    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return existing;

    console.debug("Updating character", { id, fields });

    return CHARACTERS_MANAGER.add({ ...existing, ...Object.fromEntries(entries) });
}

export function deleteCharacter(id: string): boolean {
    if (!CHARACTERS_MANAGER.get(id)) return false;
    CHARACTERS_MANAGER.delete(id);
    return true;
}

export function getReminderTokensForCharacter(characterId: string): ReminderToken[] {
    return getCharacterById(characterId)?.reminderTokens ?? [];
}

export function addReminderToken(characterId: string, data: NewReminderToken): ReminderToken {
    const character = getCharacterById(characterId);
    if (!character) throw new Error(`No character found with id "${characterId}"`);

    const token: ReminderToken = { id: v7(), text: data.text, textSize: data.textSize ?? 100 };
    CHARACTERS_MANAGER.add({ ...character, reminderTokens: [...character.reminderTokens, token] });
    return token;
}

export function updateReminderToken(
    characterId: string,
    tokenId: string,
    data: Partial<NewReminderToken>
): ReminderToken | null {
    const character = getCharacterById(characterId);
    if (!character) return null;

    const index = character.reminderTokens.findIndex(t => t.id === tokenId);
    if (index < 0) return null;

    const updatedToken: ReminderToken = { ...character.reminderTokens[index], ...data };
    const reminderTokens = [...character.reminderTokens];
    reminderTokens[index] = updatedToken;
    CHARACTERS_MANAGER.add({ ...character, reminderTokens });
    return updatedToken;
}

export function deleteReminderToken(characterId: string, tokenId: string): boolean {
    const character = getCharacterById(characterId);
    if (!character) return false;

    const reminderTokens = character.reminderTokens.filter(t => t.id !== tokenId);
    if (reminderTokens.length === character.reminderTokens.length) return false;

    CHARACTERS_MANAGER.add({ ...character, reminderTokens });
    return true;
}
