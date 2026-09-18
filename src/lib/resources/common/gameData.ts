export type CharacterCategory = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveler';

export const CHARACTER_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon'];

export type ReminderToken = {
    id: string;
    text: string;
    textSize: number;
};

export type NewReminderToken = Omit<ReminderToken, 'id'>;

export type Character = {
    id: string;
    name: string;
    category: CharacterCategory;
    rules: string;
    player_count: number;
    wakes_first_night: boolean;
    wakes_other_nights: boolean;
    reminderTokens: ReminderToken[];
};

export type NewCharacter = Omit<Character, 'id' | 'reminderTokens'>;

export type ScriptCharacterEntry = {
    characterId: string;
    firstNightOrder: number | null;
    otherNightOrder: number | null;
};

export type ScriptCharacter = Character & {
    firstNightOrder: number | null;
    otherNightOrder: number | null;
};

export type Script = {
    id: string;
    name: string;
    hue: string;
    characters: ScriptCharacterEntry[];
};

export type NewScript = Omit<Script, 'id' | 'characters'>;

export type ScriptWithCharacters = Omit<Script, 'characters'> & {
    characters: ScriptCharacter[];
};

export type Game = {
    id: string;
    created: number;
    last_played: number | null;
    script_id: string;
    character_ids: string[];
    bluff_ids: string[];
};

export type NewGame = {
    script_id: string;
};

export type GameFull = Game & {
    script: ScriptWithCharacters;
    character_ids: string[];
    bluff_ids: string[];
};

export function isValidCharacterCategory(category: string): category is CharacterCategory {
    return CHARACTER_CATEGORIES.includes(category as CharacterCategory);
}

export function isReminderToken(obj: any): obj is ReminderToken {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.text === "string" &&
        typeof obj.textSize === "number" && isFinite(obj.textSize) && obj.textSize > 0;
    if(!result){
        console.error("Invalid ReminderToken object:", obj);
    }
    return result;
}

export function isCharacter(obj: any): obj is Character {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.category === "string" && isValidCharacterCategory(obj.category) &&
        typeof obj.rules === "string" &&
        typeof obj.player_count === "number" && isFinite(obj.player_count) && obj.player_count > 0 &&
        typeof obj.wakes_first_night === "boolean" &&
        typeof obj.wakes_other_nights === "boolean" &&
        Array.isArray(obj.reminderTokens) && obj.reminderTokens.every(isReminderToken);
    if(!result){
        console.error("Invalid Character object:", obj);
    }
    return result;
}

function isScriptCharacterEntry(obj: any): obj is ScriptCharacterEntry {
    return typeof obj === "object" &&
        typeof obj.characterId === "string" &&
        (obj.firstNightOrder === null || typeof obj.firstNightOrder === "number") &&
        (obj.otherNightOrder === null || typeof obj.otherNightOrder === "number");
}

export function isScript(obj: any): obj is Script {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.hue === "string" &&
        Array.isArray(obj.characters) && obj.characters.every(isScriptCharacterEntry);
    if(!result){
        console.error("Invalid Script object:", obj);
    }
    return result;
}

export function isScriptWithCharacters(obj: any): obj is ScriptWithCharacters {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.hue === "string" &&
        Array.isArray((obj as any).characters) && (obj as any).characters.every(isCharacter);
    if(!result){
        console.error("Invalid ScriptWithCharacters object:", obj);
    }
    return result;
}

export function isGame(obj: any): obj is Game {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.created === "number" &&
        (obj.last_played === null || typeof obj.last_played === "number") &&
        typeof obj.script_id === "string" &&
        Array.isArray(obj.character_ids) && obj.character_ids.every((id: any) => typeof id === "string") &&
        Array.isArray(obj.bluff_ids) && obj.bluff_ids.every((id: any) => typeof id === "string");
    if(!result){
        console.error("Invalid Game object:", obj);
    }
    return result;
}

export function isGameFull(obj: any): obj is GameFull {
    const result = isGame(obj) &&
        isScriptWithCharacters((obj as any).script) &&
        Array.isArray((obj as any).character_ids) && (obj as any).character_ids.every((id: any) => typeof id === "string") &&
        Array.isArray((obj as any).bluff_ids) && (obj as any).bluff_ids.every((id: any) => typeof id === "string");
    if(!result){
        console.error("Invalid GameFull object:", obj);
    }
    return result;
}
