

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
};

export type Script = {
    id: number;
    name: string;
    hue: string;
};

export type ScriptWithCharacters = Script & {
    characters: ScriptCharacter[];
    bluffs: Character[];
};

export type Game = {
    id: number;
    created: Date;
    last_played: Date | null;
    script_id: number;
};

export type GameWithCharacters = Game & {
    script: ScriptWithCharacters;
    character_ids: number[];
};
export type NewCharacter = Omit<Character, 'id'>;
export type NewScript = Omit<Script, 'id'>;
export type NewGame = Omit<Game, 'id' | 'created' | 'last_played'>;


export type ReminderToken = {
    id: number;
    character_id: number | null;
    text: string | null;
};

export type NewReminderToken = Omit<ReminderToken, 'id'>;


export function isValidCharacterCategory(category: string): category is CharacterCategory {
    return CHARACTER_CATEGORIES.includes(category as CharacterCategory);
}