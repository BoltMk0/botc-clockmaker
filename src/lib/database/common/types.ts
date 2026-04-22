

export type CharacterCategory = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveler';

export const CHARACTER_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon'];

export type Character = {
    id: number;
    name: string;
    category: CharacterCategory;
    rules: string;
    player_count: number;
    wakes_first_night: boolean;
    wakes_other_nights: boolean;
};

export type ScriptCharacter = Character & {
    firstNightOrder: number | null;
    otherNightOrder: number | null;
    reminderTokens: ReminderToken[];
};

export type Script = {
    id: number;
    name: string;
    hue: string;
};

export type ScriptWithCharacters = Script & {
    characters: ScriptCharacter[];
};

export type Game = {
    id: number;
    created: Date;
    last_played: Date | null;
    script_id: number;
};

export type GameFull = Game & {
    script: ScriptWithCharacters;
    character_ids: number[];
    bluff_ids: number[];
};

export type NewCharacter = Omit<Character, 'id'>;
export type NewScript = Omit<Script, 'id'>;
export type NewGame = Omit<Game, 'id' | 'created' | 'last_played'>;


export type ReminderToken = {
    id: number;
    character_id: number | null;
    text: string;
    textSize: number;
};

export type NewReminderToken = Omit<ReminderToken, 'id'>;


export function isValidCharacterCategory(category: string): category is CharacterCategory {
    return CHARACTER_CATEGORIES.includes(category as CharacterCategory);
}

export function isReminderToken(obj: any): obj is ReminderToken {
    const result = typeof obj === "object" &&
        typeof obj.id === "number" &&
        (typeof obj.character_id === "number" || obj.character_id === null) &&
        typeof obj.text === "string" &&
        typeof obj.textSize === "number" && isFinite(obj.textSize) && obj.textSize > 0;
    if(!result){
        console.error("Invalid ReminderToken object:", obj);
    }
    return result;
}

export function isCharacter(obj: any): obj is Character {
    const result = typeof obj === "object" &&
        typeof obj.id === "number" &&
        typeof obj.name === "string" &&
        typeof obj.category === "string" && isValidCharacterCategory(obj.category) &&
        typeof obj.rules === "string" &&
        typeof obj.player_count === "number" && isFinite(obj.player_count) && obj.player_count > 0 &&
        typeof obj.wakes_first_night === "boolean" &&
        typeof obj.wakes_other_nights === "boolean";
    if(!result){
        console.error("Invalid Character object:", obj);
    }
    return result;
}

export function isScript(obj: any): obj is Script {
    const result = typeof obj === "object" &&
        typeof obj.id === "number" &&
        typeof obj.name === "string" &&
        typeof obj.hue === "string";
    if(!result){
        console.error("Invalid Script object:", obj);
    }
    return result;
}   


export function isScriptWithCharacters(obj: any): obj is ScriptWithCharacters {
    const result = typeof obj === "object" &&
        isScript(obj) &&
        Array.isArray((obj as any).characters) && (obj as any).characters.every(isCharacter);
    if(!result){
        console.error("Invalid ScriptWithCharacters object:", obj);
    }
    return result;
}

export function isGame(obj: any): obj is Game {
    const result = typeof obj === "object" &&
        typeof obj.id === "number" &&
        typeof obj.created === "object" && obj.created instanceof Date &&
        (typeof obj.last_played === "object" && obj.last_played instanceof Date) || obj.last_played === null &&
        typeof obj.script_id === "number";
    if(!result){
        console.error("Invalid Game object:", obj);
    }
    return result;
}

export function isGameFull(obj: any): obj is GameFull {
    const result = isGame(obj) &&
        isScriptWithCharacters((obj as any).script) &&
        Array.isArray((obj as any).character_ids) && (obj as any).character_ids.every((id: any) => typeof id === "number") &&
        Array.isArray((obj as any).bluff_ids) && (obj as any).bluff_ids.every((id: any) => typeof id === "number");
    if(!result){
        console.error("Invalid GameFull object:", obj);
    }
    return result;
}