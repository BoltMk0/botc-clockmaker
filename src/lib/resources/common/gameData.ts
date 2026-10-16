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
    // How the character changes setup, without the brackets the wiki and scripts print it in, e.g.
    // "+2 Outsiders" for the Baron. Empty when it doesn't change setup.
    setup: string;
    // The character's canonical night order rank, as published by the game (e.g. from the
    // bra1n/townsquare role dataset). Scripts derive their own per-script night order from
    // this; null means the character doesn't wake on that night.
    firstNightOrder: number | null;
    otherNightOrder: number | null;
    // What the storyteller does when the character wakes, as the night order sheet reads it, e.g. "The Poisoner
    // points to a player. That player is poisoned." Empty when there's none; the sheet then shows the ability.
    firstNightReminder: string;
    otherNightReminder: string;
    reminderTokens: ReminderToken[];
};

export type NewCharacter = Omit<Character, 'id' | 'reminderTokens'>;

/** Splits a trailing "[...]" setup note off ability text, as the wiki and scripts print it, e.g. "There are extra Outsiders in play. [+2 Outsiders]". */
export function splitSetupFromRules(text: string): { rules: string; setup: string } {
    const match = text.match(/^([\s\S]*?)\s*\[([^\[\]]*)\]\s*$/);
    return match ? { rules: match[1].trim(), setup: match[2].trim() } : { rules: text.trim(), setup: '' };
}

/** Ability text with the setup note put back on the end in brackets, the way scripts print it. */
export function rulesWithSetup(character: Pick<Character, 'rules' | 'setup'>): string {
    return character.setup ? `${character.rules} [${character.setup}]` : character.rules;
}

export function wakesFirstNight(character: Pick<Character, 'firstNightOrder'>): boolean {
    return character.firstNightOrder !== null;
}

export function wakesOtherNights(character: Pick<Character, 'otherNightOrder'>): boolean {
    return character.otherNightOrder !== null;
}

// The script's own night order: a 1-based rank among the script's characters that wake that night, which the
// script can rearrange freely. Null for a character that doesn't wake that night.
export type ScriptCharacterEntry = {
    characterId: string;
    scriptFirstNightOrder: number | null;
    scriptOtherNightOrder: number | null;
};

export type ScriptCharacter = Character & {
    scriptFirstNightOrder: number | null;
    scriptOtherNightOrder: number | null;
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
    /** Every token in the preset (repeats allowed): the bag plus the grim-only tokens. */
    character_ids: string[];
    /** The subset of character_ids that go straight on the grim rather than in the bag. Absent on older presets. */
    grim_character_ids?: string[];
    /** Groups of bluffs to show the demon; may be empty. */
    bluff_sets: string[][];
    /** Legacy: a single bluff set, from before multiple sets were supported. Use bluffSetsOf. */
    bluff_ids?: string[];
    /** The storyteller's rating out of PRESET_MAX_RATING stars; absent or null when unrated. */
    rating?: number | null;
    /** The storyteller's own notes on running the preset; absent on presets saved before notes were kept. */
    notes?: string;
    evil_victories: number;
    good_victories: number;
};

export const PRESET_MAX_RATING = 5;

/** True for a whole number of stars from 1 to PRESET_MAX_RATING. */
export function isValidPresetRating(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= PRESET_MAX_RATING;
}

/** The bluff sets of a preset (or loaded preset), upgrading the legacy single `bluff_ids` list. */
export function bluffSetsOf(obj: { bluff_sets?: string[][]; bluff_ids?: string[] }): string[][] {
    if (obj.bluff_sets) return obj.bluff_sets;
    return obj.bluff_ids && obj.bluff_ids.length > 0 ? [obj.bluff_ids] : [];
}

const isIdList = (v: any) => Array.isArray(v) && v.every((id: any) => typeof id === "string");

/** True if the object has valid bluff data in either the current or the legacy shape. */
export function hasValidBluffs(obj: any): boolean {
    return (obj.bluff_sets === undefined || (Array.isArray(obj.bluff_sets) && obj.bluff_sets.every(isIdList))) &&
        (obj.bluff_ids === undefined || isIdList(obj.bluff_ids)) &&
        (obj.bluff_sets !== undefined || obj.bluff_ids !== undefined);
}

/** The preset's grim-only tokens. Older presets have none saved, so all their tokens go in the bag. */
export function presetGrimCharacterIds(preset: Pick<Preset, 'grim_character_ids'>): string[] {
    return preset.grim_character_ids ?? [];
}

/** How many players a preset seats: its tokens that go in the bag. */
export function presetPlayerCount(preset: Pick<Preset, 'character_ids' | 'grim_character_ids'>): number {
    return preset.character_ids.length - presetGrimCharacterIds(preset).length;
}

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
        // Absent on characters saved before setup was split out of the rules; characters.ts fills it in.
        (obj.setup === undefined || typeof obj.setup === "string") &&
        // Characters saved before the night order lost its "default" prefix have defaultFirstNightOrder and
        // defaultOtherNightOrder (and wakes_first_night / wakes_other_nights) instead; characters.ts converts them.
        (isNightOrder(obj.firstNightOrder) || isNightOrder(obj.defaultFirstNightOrder)) &&
        (isNightOrder(obj.otherNightOrder) || isNightOrder(obj.defaultOtherNightOrder)) &&
        // Absent on characters saved before night reminders were kept; characters.ts fills them in.
        (obj.firstNightReminder === undefined || typeof obj.firstNightReminder === "string") &&
        (obj.otherNightReminder === undefined || typeof obj.otherNightReminder === "string") &&
        Array.isArray(obj.reminderTokens) && obj.reminderTokens.every(isReminderToken);
    if(!result){
        console.error("Invalid Character object:", obj);
    }
    return result;
}

function isNightOrder(value: unknown): value is number | null {
    return value === null || typeof value === "number";
}

function isScriptCharacterEntry(obj: any): obj is ScriptCharacterEntry {
    return typeof obj === "object" &&
        typeof obj.characterId === "string" &&
        // Scripts saved before the script's own order was told apart from the character's have firstNightOrder
        // and otherNightOrder instead; scripts.ts converts them.
        (isNightOrder(obj.scriptFirstNightOrder) || isNightOrder(obj.firstNightOrder)) &&
        (isNightOrder(obj.scriptOtherNightOrder) || isNightOrder(obj.otherNightOrder));
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
        (obj.grim_character_ids === undefined || (Array.isArray(obj.grim_character_ids) && obj.grim_character_ids.every((id: any) => typeof id === "string"))) &&
        hasValidBluffs(obj) &&
        (obj.rating === undefined || obj.rating === null || isValidPresetRating(obj.rating)) &&
        (obj.notes === undefined || typeof obj.notes === "string") &&
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
