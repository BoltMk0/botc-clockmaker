export type CharacterCategory = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveler' | 'loric' | 'fabled';

export const CHARACTER_CATEGORY_COLORS: Record<CharacterCategory, string> = {
    townsfolk: '#2563eb',
    outsider: '#16a34a',
    minion: '#dc2626',
    demon: '#7c3aed',
    traveler: '#ca8a04',
    loric: '#0d9488',
    fabled: '#db2777',
};

export const CHARACTER_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon'];

// Every category a character can have. CHARACTER_CATEGORIES is just the four that make up a
// player's team in setup (and count towards the player-count breakdown); the rest are extras.
export const ALL_CHARACTER_CATEGORIES: CharacterCategory[] = [...CHARACTER_CATEGORIES, 'traveler', 'loric', 'fabled'];

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
    // The character's canonical night order rank, as published by the game (e.g. from the
    // bra1n/townsquare role dataset). Scripts derive their own per-script night order from
    // this default; null means the character doesn't wake on that night.
    defaultFirstNightOrder: number | null;
    defaultOtherNightOrder: number | null;
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

export type Preset = {
    id: string;
    name: string | null;
    script_id: string;
    character_ids: string[];
    bluff_ids: string[];
    evil_victories: number;
    good_victories: number;
};

export type NewPreset = Omit<Preset, 'id' | 'evil_victories' | 'good_victories'>;

export type PresetFull = Preset & {
    script: ScriptWithCharacters;
};

export function presetDisplayName(preset: Preset, index: number): string {
    return preset.name ?? `Preset ${index + 1}`;
}

export function isValidCharacterCategory(category: string): category is CharacterCategory {
    return ALL_CHARACTER_CATEGORIES.includes(category as CharacterCategory);
}

export function alignmentForCategory(category: CharacterCategory): 'good' | 'evil' {
    return (category === 'demon' || category === 'minion') ? 'evil' : 'good';
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
        typeof obj.player_count === "number" && isFinite(obj.player_count) && obj.player_count >= 0 &&
        typeof obj.wakes_first_night === "boolean" &&
        typeof obj.wakes_other_nights === "boolean" &&
        (obj.defaultFirstNightOrder === null || typeof obj.defaultFirstNightOrder === "number") &&
        (obj.defaultOtherNightOrder === null || typeof obj.defaultOtherNightOrder === "number") &&
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

export function isPreset(obj: any): obj is Preset {
    const result = typeof obj === "object" &&
        typeof obj.id === "string" &&
        (obj.name === null || typeof obj.name === "string") &&
        typeof obj.script_id === "string" &&
        Array.isArray(obj.character_ids) && obj.character_ids.every((id: any) => typeof id === "string") &&
        Array.isArray(obj.bluff_ids) && obj.bluff_ids.every((id: any) => typeof id === "string") &&
        // Absent on presets saved before victories were tracked; presets.ts fills in 0.
        (obj.evil_victories === undefined || (typeof obj.evil_victories === "number" && isFinite(obj.evil_victories) && obj.evil_victories >= 0)) &&
        (obj.good_victories === undefined || (typeof obj.good_victories === "number" && isFinite(obj.good_victories) && obj.good_victories >= 0));
    if(!result){
        console.error("Invalid Preset object:", obj);
    }
    return result;
}

export function isPresetFull(obj: any): obj is PresetFull {
    const result = isPreset(obj) &&
        isScriptWithCharacters((obj as any).script);
    if(!result){
        console.error("Invalid PresetFull object:", obj);
    }
    return result;
}
