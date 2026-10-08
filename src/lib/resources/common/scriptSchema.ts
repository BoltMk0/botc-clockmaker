// The official custom script format, shared by the Pandemonium Institute's apps and the community script tools:
// https://github.com/ThePandemoniumInstitute/botc-release/blob/main/script-schema.json
// A script is a flat list: an optional `_meta` entry, then each character either as just its id (official
// characters) or in full (homebrew).
import { isValidCharacterCategory, type CharacterCategory, type ScriptWithCharacters } from "./gameData";

export type SchemaTeam = 'townsfolk' | 'outsider' | 'minion' | 'demon' | 'traveller' | 'fabled' | 'loric';

export type SchemaCharacter = {
    id: string;
    name: string;
    team: SchemaTeam;
    ability: string;
    // Wake priority on the night; 0 means the character doesn't wake.
    firstNight?: number;
    otherNight?: number;
    reminders?: string[];
};

export type SchemaMeta = {
    id: '_meta';
    name: string;
    author?: string;
    // Ids in the order they wake. May also contain the special entries 'dusk', 'minioninfo', 'demoninfo' and 'dawn'.
    firstNight?: string[];
    otherNight?: string[];
    // Not part of the schema, which allows extra fields on `_meta`: the script's colour here.
    hue?: string;
};

export type SchemaScriptItem = string | SchemaCharacter | SchemaMeta | { id: string };

export function teamFromCategory(category: CharacterCategory): SchemaTeam {
    return category === 'traveler' ? 'traveller' : category;
}

export function categoryFromTeam(team: unknown): CharacterCategory | null {
    if (typeof team !== 'string') return null;
    const category = team === 'traveller' ? 'traveler' : team;
    return isValidCharacterCategory(category) ? category : null;
}

export function isSchemaMeta(item: unknown): item is SchemaMeta {
    return typeof item === 'object' && item !== null && (item as any).id === '_meta';
}

// Every character is written out in full, so the file stands alone, including any homebrew characters.
export function scriptToSchema(script: ScriptWithCharacters): SchemaScriptItem[] {
    const wakeOrder = (field: 'firstNightOrder' | 'otherNightOrder') => script.characters
        .filter(c => c[field] !== null)
        .sort((a, b) => a[field]! - b[field]!)
        .map(c => c.id);

    const meta: SchemaMeta = {
        id: '_meta',
        name: script.name,
        hue: script.hue,
        firstNight: wakeOrder('firstNightOrder'),
        otherNight: wakeOrder('otherNightOrder')
    };
    const characters: SchemaCharacter[] = script.characters.map(c => ({
        id: c.id,
        name: c.name,
        team: teamFromCategory(c.category),
        ability: c.rules,
        firstNight: c.firstNightOrder ?? 0,
        otherNight: c.otherNightOrder ?? 0,
        reminders: c.reminderTokens.map(t => t.text)
    }));
    return [meta, ...characters];
}
