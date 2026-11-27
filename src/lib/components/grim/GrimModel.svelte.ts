import { alignmentForCategory, ALL_CHARACTER_CATEGORIES, type Character, type CharacterCategory, type ReminderToken, type ScriptCharacter, type ScriptWithCharacters } from "$lib/resources/common/gameData";
import { isPlayerToken, remindersBySeatedToken, tokensToSeat, type Alignment, type GrimoireStateHistory, type GrimoireStateSnapshot, type PlacedToken } from "$lib/resources/common/grimoireState";
import { v7 } from "uuid";

// What the grim board and the pages around it (the live grim, a saved grim's snapshot) both work out from a grim
// and its characters.

export const GRIM_Z = {
    tokens: 20,
    // Character-only tokens sit above the drawing but behind every player's token.
    unnamedTokens: 15,
    reminders: 30,
    canvas: 10,
    // Above tokens and reminders, below the UI chrome.
    nightOrder: 40,
    ui: 50,
    clock: 10
};

// Tray and picker tokens are shown small, so they load the scaled-down 256px icon (see CharacterToken's imageSize).
export const TRAY_IMAGE_SIZE = 256;

// A script as the token tray lists it: by name, with the characters on it.
export type GrimScriptSummary = { id: string; name: string; characterIds: string[] };

// Categories that get their own tray section rather than being lumped into "Other" / "All Characters".
export const TRAY_SIDE_SECTIONS: { category: CharacterCategory; title: string }[] = [
    { category: 'traveler', title: 'Travellers' },
    { category: 'loric', title: 'Loric' },
    { category: 'fabled', title: 'Fabled' },
];
export const isSideCategory = (c: ScriptCharacter) => TRAY_SIDE_SECTIONS.some(s => s.category === c.category);

// Loric and fabled characters can never be player characters: no name/alignment/alive-dead state, no colour by
// alignment, and they sit apart from the town so they're ignored when spacing or framing it.
export function isSideRoleCategory(category: CharacterCategory | null | undefined): boolean {
    return category === 'loric' || category === 'fabled';
}

export const byCategoryThenName = (a: ScriptCharacter, b: ScriptCharacter) => {
    const ac = ALL_CHARACTER_CATEGORIES.indexOf(a.category as any);
    const bc = ALL_CHARACTER_CATEGORIES.indexOf(b.category as any);
    if (ac !== bc) return ac - bc;
    return a.name.localeCompare(b.name);
};

// Synthetic "blank" reminder token (icon only, no text) available for every character.
// Kept out of the database since it's identical for all characters - just rendered from the character's id.
export function blankReminderTokenId(characterId: string): string {
    return `blank-${characterId}`;
}
export function blankReminderToken(characterId: string): ReminderToken {
    return { id: blankReminderTokenId(characterId), text: '', textSize: 100 };
}

// Library characters with their own night order, as a script without its own order would have them.
export function asScriptCharacters(characters: Character[]): ScriptCharacter[] {
    return characters.map(c => ({ ...c, scriptFirstNightOrder: c.firstNightOrder, scriptOtherNightOrder: c.otherNightOrder }));
}

export function scriptSummaries(scripts: { id: string; name: string; characters: { characterId: string }[] }[]): GrimScriptSummary[] {
    return scripts.map(s => ({ id: s.id, name: s.name, characterIds: s.characters.map(c => c.characterId) }));
}

// Older saves have tokens with no id or alignment; gives them one.
export function normaliseHistory(hist: GrimoireStateHistory, defaultAlignment: (characterId: string | null) => Alignment): GrimoireStateHistory {
    const normaliseSnapshot = (snap: GrimoireStateSnapshot): GrimoireStateSnapshot => ({
        ...snap,
        placedTokens: snap.placedTokens.map(t => ({
            ...t,
            id: t.id ?? v7(),
            alignment: (t as any).alignment ?? defaultAlignment(t.characterId),
        })),
    });
    return {
        id: hist.id,
        scriptId: hist.scriptId ?? null,
        loadedPreset: hist.loadedPreset ?? null,
        saveslots: hist.saveslots.map(s => s ? normaliseSnapshot(s) : null),
        present: normaliseSnapshot(hist.present),
        revision: hist.revision,
    };
}

export type TraySection = { key: string; title: string; characters: ScriptCharacter[]; collapsible?: boolean };

export type GrimModelSource = {
    grim: () => GrimoireStateHistory;
    // The game's script (with every traveller, loric and fabled); null without one.
    script: () => ScriptWithCharacters | null;
    // Every character in the library, with their own night order: any of them can be put on the grim from the tray.
    library: () => ScriptCharacter[];
    // Every script, for the token tray's sections.
    scripts: () => GrimScriptSummary[];
};

export class GrimModel {
    constructor(private readonly src: GrimModelSource) {}

    readonly grim = $derived.by(() => this.src.grim());
    readonly script = $derived.by(() => this.src.script());

    // Every character the grim knows: the script's (with its night order), then the rest of the library.
    readonly allCharacters = $derived.by(() => {
        const script = this.script;
        const onScript = new Set(script?.characters.map(c => c.id) ?? []);
        return [...(script?.characters ?? []), ...this.src.library().filter(c => !onScript.has(c.id))];
    });
    readonly characterById = $derived(new Map(this.allCharacters.map(c => [c.id, c])));

    readonly sortedAllCharacters = $derived([...this.allCharacters].sort(byCategoryThenName));
    // The script's characters, or every character without a script.
    readonly sortedScriptCharacters = $derived(this.script ? [...this.script.characters].sort(byCategoryThenName) : this.sortedAllCharacters);

    // Every reminder token by id, with its character, including each character's blank one.
    readonly reminderById = $derived<Record<string, ReminderToken & { characterId: string }>>(
        Object.fromEntries([
            ...this.allCharacters.flatMap(c => c.reminderTokens.map(t => [t.id, { ...t, characterId: c.id }] as const)),
            ...this.allCharacters.map(c => [blankReminderTokenId(c.id), { ...blankReminderToken(c.id), characterId: c.id }] as const)
        ])
    );

    readonly placedTokens = $derived(this.grim.present.placedTokens);
    readonly placedReminders = $derived(this.grim.present.placedReminders);
    readonly loadedPreset = $derived(this.grim.loadedPreset);

    defaultAlignmentFor = (characterId: string | null): Alignment => {
        const char = this.characterById.get(characterId ?? '');
        return char ? alignmentForCategory(char.category) : 'good';
    };

    isSideRoleToken = (t: PlacedToken): boolean => isSideRoleCategory(this.characterById.get(t.characterId ?? '')?.category);

    // The players are the named tokens, or every token while none are named (as on a grim set up without a script).
    readonly seatedTokens = $derived(tokensToSeat(this.placedTokens, this.isSideRoleToken));
    readonly seatedTokenIds = $derived(new Set(this.seatedTokens.map(t => t.id)));

    readonly placedCharacterIds = $derived(new Set(this.placedTokens.map(t => t.characterId).filter(id => id !== null)));
    isInPlay = (characterId: string): boolean => this.placedCharacterIds.has(characterId);

    // Characters on named tokens, including travellers
    readonly seatedCharacterIds = $derived([...new Set(
        this.placedTokens.filter(t => isPlayerToken(t) && t.characterId !== null).map(t => t.characterId as string)
    )]);
    readonly seatedCharacterIdSet = $derived(new Set(this.seatedCharacterIds));

    // Players with their own character's "No ability" reminder beside them (any case; matched to them by angle, as
    // the reminders are everywhere else), by token id: they no longer wake.
    // And players with any "Has ability" reminder beside them (any case, from any character), by token id: they keep
    // waking even while dead.
    readonly #abilityReminderTokenIds = $derived.by(() => {
        const noAbility = new Set<string>();
        const hasAbility = new Set<string>();
        for (const [tokenId, reminders] of remindersBySeatedToken(this.placedTokens, this.placedReminders, this.isSideRoleToken)) {
            const token = this.placedTokens.find(t => t.id === tokenId);
            if (!token?.characterId) continue;
            for (const r of reminders) {
                const reminder = this.reminderById[r.tokenId];
                const text = reminder?.text.trim().toLowerCase();
                if (text === 'no ability' && reminder?.characterId === token.characterId) noAbility.add(tokenId);
                if (text === 'has ability') hasAbility.add(tokenId);
            }
        }
        return { noAbility, hasAbility };
    });

    // Whether a player still wakes in the night order: alive (or dead with a "Has ability" reminder), and with an
    // ability.
    wakesInNightOrder = (token: PlacedToken): boolean =>
        (!token.isDead || this.#abilityReminderTokenIds.hasAbility.has(token.id)) && !this.#abilityReminderTokenIds.noAbility.has(token.id);

    // The reminders on the grim by the character of the player they're beside (the nearest seated token by angle
    // about the centre, as auto-arrange moves them with), for character communications' pickers.
    readonly remindersByCharacterId = $derived.by(() => {
        const byToken = remindersBySeatedToken(this.placedTokens, this.placedReminders, this.isSideRoleToken);
        const byCharacter: Record<string, (ReminderToken & { characterId: string })[]> = {};
        for (const token of this.placedTokens) {
            const reminders = byToken.get(token.id);
            if (!token.characterId || !reminders) continue;
            const shown = reminders.map(r => this.reminderById[r.tokenId]).filter(r => !!r);
            if (shown.length > 0) byCharacter[token.characterId] = [...(byCharacter[token.characterId] ?? []), ...shown];
        }
        return byCharacter;
    });

    // The token tray's sections, in order: the in-play characters (with a preset loaded), then the bluffs (shown
    // before the script's section, see the tray) and the script's own characters, always open; then every character,
    // under each script they're on (and the rest under "Other"), and the travellers, loric and fabled, in sections that
    // can be collapsed. Without a script there's just the collapsible ones.
    readonly traySections = $derived.by((): TraySection[] => {
        if (this.allCharacters.length === 0) return [];
        const script = this.script;
        const sections: TraySection[] = [];
        if (this.loadedPreset && this.seatedCharacterIds.length > 0) {
            const inPlay = this.seatedCharacterIds.map(id => this.characterById.get(id)).filter((c): c is ScriptCharacter => !!c);
            sections.push({ key: 'in-play', title: 'In-play', characters: inPlay });
        }
        if (script) {
            sections.push({ key: 'script', title: script.name, characters: this.sortedScriptCharacters.filter(c => !isSideCategory(c)) });
        }
        const townCharacters = this.sortedAllCharacters.filter(c => !isSideCategory(c));
        const onAScript = new Set<string>();
        for (const s of this.src.scripts()) {
            const ids = new Set(s.characterIds);
            const scriptCharacters = townCharacters.filter(c => ids.has(c.id));
            scriptCharacters.forEach(c => onAScript.add(c.id));
            // The game's own script is already open at the top.
            if (scriptCharacters.length > 0 && s.id !== script?.id) sections.push({ key: `script-${s.id}`, title: s.name, characters: scriptCharacters, collapsible: true });
        }
        const others = townCharacters.filter(c => !onAScript.has(c.id));
        if (others.length > 0) sections.push({ key: 'other', title: 'Other', characters: others, collapsible: true });
        for (const side of TRAY_SIDE_SECTIONS) {
            const sideCharacters = this.sortedAllCharacters.filter(c => c.category === side.category);
            if (sideCharacters.length > 0) sections.push({ key: side.category, title: side.title, characters: sideCharacters, collapsible: true });
        }
        return sections;
    });
}
