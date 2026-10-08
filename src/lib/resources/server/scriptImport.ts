import { characterIdFromName, slugify } from "../common/util";
import { categoryFromTeam, isSchemaMeta } from "../common/scriptSchema";
import type { Character, NewCharacter, Script } from "../common/gameData";
import { addCharacter, addReminderToken, findCharacterByLooseName, getCharacterById } from "./characters";
import { createScript, getScriptById, setScriptCharacters, type ScriptCharacterInput } from "./scripts";

const DEFAULT_HUE = '#c45d5d';
const REMINDER_TEXT_SIZE = 46;

export class ScriptImportError extends Error {
    constructor(readonly problems: string[]) {
        super(problems.join('\n'));
        this.name = "ScriptImportError";
    }
}

type PlannedCharacter = {
    // The id the file refers to the character by, which for homebrew characters may not be ours.
    fileId: string | null;
    characterId: string;
    // Set when the character isn't here yet and will be created.
    newCharacter?: NewCharacter;
    reminders?: string[];
};

// Ability texts from different sources vary in punctuation and in writing "&" or "and", so only the words count.
function sameAbility(a: string, b: string): boolean {
    const words = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '');
    return words(a) === words(b);
}

function wakePriority(value: unknown): number | null {
    return typeof value === 'number' && isFinite(value) && value > 0 ? value : null;
}

/**
 * Turns a script in the official format into a new script here. Characters are matched to existing ones by name
 * (by id for entries that are only an id); characters given in full that don't exist yet are created. Nothing is
 * saved unless the whole script can be imported; otherwise this throws a ScriptImportError listing the problems.
 */
export function importScriptFromSchema(data: unknown, fallbackName: string): Script {
    if (!Array.isArray(data)) {
        throw new ScriptImportError(['The file is not a script: it should contain a JSON list of characters.']);
    }

    const problems: string[] = [];
    const meta = data.find(isSchemaMeta);
    const name = (typeof meta?.name === 'string' && meta.name.trim()) || fallbackName.trim();
    if (!slugify(name)) {
        problems.push('The script has no name.');
    } else if (getScriptById(slugify(name))) {
        problems.push(`A script named "${name}" already exists.`);
    }
    const hue = typeof meta?.hue === 'string' && /^#[0-9a-f]{6}$/i.test(meta.hue) ? meta.hue : DEFAULT_HUE;

    const unknownIds: string[] = [];
    const planned: PlannedCharacter[] = [];
    for (const item of data) {
        if (isSchemaMeta(item)) continue;
        const plan = planCharacter(item, problems, unknownIds);
        if (plan) planned.push(plan);
    }
    if (unknownIds.length > 0) {
        problems.push(`Unknown character${unknownIds.length === 1 ? '' : 's'}: ${unknownIds.join(', ')}. ` +
            `Scrape ${unknownIds.length === 1 ? 'it' : 'them'} from the wiki first, or import a script file that includes their full details.`);
    }
    if (planned.length === 0 && problems.length === 0) {
        problems.push('The script has no characters.');
    }
    if (problems.length > 0) throw new ScriptImportError(problems);

    const created = new Set<string>();
    for (const plan of planned) {
        if (!plan.newCharacter || created.has(plan.characterId)) continue;
        const character = addCharacter(plan.newCharacter);
        for (const text of plan.reminders ?? []) {
            addReminderToken(character.id, { text, textSize: REMINDER_TEXT_SIZE });
        }
        created.add(character.id);
    }

    const characterIds = [...new Set(planned.map(p => p.characterId))];
    const idByFileId = new Map(planned.filter(p => p.fileId !== null).map(p => [p.fileId!, p.characterId]));
    const firstNight = nightOrderRanks(meta?.firstNight, idByFileId);
    const otherNight = nightOrderRanks(meta?.otherNight, idByFileId);
    const entries: ScriptCharacterInput[] = characterIds.map(characterId => {
        const character = getCharacterById(characterId)!;
        return {
            characterId,
            firstNightOrder: character.wakes_first_night ? firstNight.get(characterId) ?? null : null,
            otherNightOrder: character.wakes_other_nights ? otherNight.get(characterId) ?? null : null
        };
    });

    const script = createScript({ name, hue });
    // Any waking character the file's night order leaves out has no order yet, which makes the whole night be
    // reordered from each character's default.
    setScriptCharacters(script.id, entries);
    return getScriptById(script.id)!;
}

function planCharacter(item: unknown, problems: string[], unknownIds: string[]): PlannedCharacter | null {
    // Official characters are given by id alone: as a string, or (deprecated) as an object with only an id.
    const bareId = typeof item === 'string' ? item
        : typeof item === 'object' && item !== null && typeof (item as any).id === 'string' && (item as any).name === undefined ? (item as any).id as string
        : null;
    if (bareId !== null) {
        const character = getCharacterById(bareId) ?? getCharacterById(characterIdFromName(bareId));
        if (!character) {
            unknownIds.push(bareId);
            return null;
        }
        return { fileId: bareId, characterId: character.id };
    }

    if (typeof item !== 'object' || item === null || typeof (item as any).name !== 'string') {
        problems.push(`Unrecognised entry: ${JSON.stringify(item)}`);
        return null;
    }

    const entry = item as Record<string, unknown>;
    const name = (entry.name as string).trim();
    const fileId = typeof entry.id === 'string' ? entry.id : null;
    const ability = typeof entry.ability === 'string' ? entry.ability.trim() : null;
    if (ability === null) {
        problems.push(`"${name}" has no ability text.`);
        return null;
    }

    const existing: Character | null = findCharacterByLooseName(name);
    if (existing) {
        if (!sameAbility(existing.rules, ability)) {
            problems.push(`"${name}" clashes with the existing character "${existing.name}": its ability is "${ability}", but the existing character's is "${existing.rules}".`);
            return null;
        }
        return { fileId, characterId: existing.id };
    }

    const characterId = characterIdFromName(name);
    const category = categoryFromTeam(entry.team);
    if (!characterId) {
        problems.push(`"${name}" needs at least one letter or number in its name.`);
        return null;
    }
    if (!category) {
        problems.push(`"${name}" has an unknown team: ${JSON.stringify(entry.team)}.`);
        return null;
    }

    const firstNight = wakePriority(entry.firstNight);
    const otherNight = wakePriority(entry.otherNight);
    const reminders = Array.isArray(entry.reminders) ? entry.reminders.filter((r): r is string => typeof r === 'string') : [];
    return {
        fileId,
        characterId,
        newCharacter: {
            name,
            category,
            rules: ability,
            player_count: 1,
            wakes_first_night: firstNight !== null,
            wakes_other_nights: otherNight !== null,
            defaultFirstNightOrder: firstNight,
            defaultOtherNightOrder: otherNight
        },
        reminders
    };
}

// The file's night order as a 1-based rank per character id here, skipping entries for anything not on the
// script (including the special 'dusk', 'minioninfo', 'demoninfo' and 'dawn' entries).
function nightOrderRanks(order: unknown, idByFileId: Map<string, string>): Map<string, number> {
    const ranks = new Map<string, number>();
    if (!Array.isArray(order)) return ranks;
    for (const fileId of order) {
        const characterId = typeof fileId === 'string' ? idByFileId.get(fileId) : undefined;
        if (characterId && !ranks.has(characterId)) ranks.set(characterId, ranks.size + 1);
    }
    return ranks;
}
