import { browser } from "$app/environment";
import { getPlayerCount } from "$lib/common/util.js";
import { fetchAllCharacters, withSideCharacters } from "$lib/resources/client/scriptWithSideCharacters.js";
import type { CharacterCategory, ScriptCharacter, ScriptWithCharacters } from "$lib/resources/common/gameData.js";

/** Loric and fabled aren't player characters, so they never go in the bag. */
const GRIM_ONLY_CATEGORIES: CharacterCategory[] = ['loric', 'fabled'];

/** Removes one occurrence of each of `remove` from `ids`, keeping the order of the rest. */
function subtractIds(ids: string[], remove: string[]): string[] {
    const remaining = [...ids];
    for (const id of remove) {
        const index = remaining.indexOf(id);
        if (index >= 0) remaining.splice(index, 1);
    }
    return remaining;
}

/**
 * State and rules shared by the game setup flow and the preset editor:
 * player count > characters (repeats allowed) > bluffs, then sorting the tokens into the bag and the grim.
 */
export class PresetBuilder {
    script = $state.raw<ScriptWithCharacters | null>(null);
    playerCount = $state<number | null>(null);
    chosenCharacterIds = $state<string[]>([]);
    /** The chosen tokens that go straight on the grim instead of in the bag. */
    grimCharacterIds = $state<string[]>([]);
    /** Optional groups of at least 3 bluffs. */
    bluffSets = $state<string[][]>([]);
    /** Index of the bluff set being edited. */
    activeBluffSet = $state(0);
    /** Every character used as a bluff in any set. */
    allBluffIds = $derived([...new Set(this.bluffSets.flat())]);
    /** True when every bluff set is complete (no sets is fine). */
    bluffsValid = $derived(this.bluffSets.every(s => s.length >= 3));

    charById = $derived(new Map((this.script?.characters ?? []).map(c => [c.id, c])));

    chosenCharacters = $derived(this.chosenCharacterIds.map(id => this.charById.get(id)).filter((c): c is ScriptCharacter => !!c));
    currentCounts = $derived({
        townsfolk: this.chosenCharacters.filter(c => c.category === 'townsfolk').length,
        outsiders: this.chosenCharacters.filter(c => c.category === 'outsider').length,
        minions: this.chosenCharacters.filter(c => c.category === 'minion').length,
        demons: this.chosenCharacters.filter(c => c.category === 'demon').length
    });

    /** Loric and fabled always go straight on the grim. (Travellers start in the bag, and count as players there.) */
    grimOnlyCharacterIds = $derived(this.chosenCharacterIds.filter(id => {
        const category = this.charById.get(id)?.category;
        return !!category && GRIM_ONLY_CATEGORIES.includes(category);
    }));

    bagCharacterIds = $derived(subtractIds(this.chosenCharacterIds, this.grimCharacterIds));
    /** Travellers in the bag take a seat, but don't change how many of each type the rest of the players get. */
    expectedCounts = $derived(getPlayerCount((this.playerCount ?? 5) - this.bagCharacterIds.filter(id => this.charById.get(id)?.category === 'traveler').length));
    /** Tokens beyond one per player, which have to be sorted into the bag and the grim. */
    surplusCount = $derived(Math.max(0, this.chosenCharacterIds.length - this.grimOnlyCharacterIds.length - (this.playerCount ?? 0)));
    hasEnoughTokens = $derived(this.chosenCharacterIds.length - this.grimOnlyCharacterIds.length >= (this.playerCount ?? 0));
    /** True once the bag holds exactly one token per player. */
    isSorted = $derived(this.hasEnoughTokens && this.bagCharacterIds.length === this.playerCount);

    setScript(script: ScriptWithCharacters | null) {
        this.script = script;
        this.playerCount = null;
        this.reset();
        if (script && browser) this.addSideCharacters(script);
    }

    /** Travellers, loric and fabled aren't in a script's own list, but can be chosen in any game. */
    private async addSideCharacters(script: ScriptWithCharacters) {
        const all = await fetchAllCharacters();
        if (this.script === script) this.script = withSideCharacters(script, all);
    }

    reset() {
        this.chosenCharacterIds = [];
        this.grimCharacterIds = [];
        this.bluffSets = [];
        this.activeBluffSet = 0;
    }

    choosePlayerCount(n: number) {
        if (n !== this.playerCount) this.reset();
        this.playerCount = n;
    }

    /** Loads a saved character list. */
    loadCharacters(characterIds: string[], bluffSets: string[][], grimIds: string[] = []) {
        this.chosenCharacterIds = [...characterIds];
        this.grimCharacterIds = [...grimIds];
        this.bluffSets = bluffSets.map(s => [...s]);
        this.activeBluffSet = 0;
    }

    countOf(characterId: string): number {
        return this.chosenCharacterIds.filter(id => id === characterId).length;
    }

    addCharacter(characterId: string) {
        this.chosenCharacterIds = [...this.chosenCharacterIds, characterId];
        this.grimCharacterIds = [...this.grimOnlyCharacterIds];
    }

    /** Removes one copy of the character. */
    removeCharacter(characterId: string) {
        this.chosenCharacterIds = subtractIds(this.chosenCharacterIds, [characterId]);
        this.grimCharacterIds = [...this.grimOnlyCharacterIds];
    }

    moveToGrim(characterId: string) {
        if (this.bagCharacterIds.includes(characterId)) this.grimCharacterIds = [...this.grimCharacterIds, characterId];
    }

    moveToBag(characterId: string) {
        if (this.grimOnlyCharacterIds.includes(characterId)) return;
        this.grimCharacterIds = subtractIds(this.grimCharacterIds, [characterId]);
    }

    /** Adds an empty bluff set and makes it the one being edited. */
    addBluffSet() {
        this.bluffSets = [...this.bluffSets, []];
        this.activeBluffSet = this.bluffSets.length - 1;
    }

    removeBluffSet(index: number) {
        this.bluffSets = this.bluffSets.filter((_, i) => i !== index);
        this.activeBluffSet = Math.min(this.activeBluffSet, Math.max(0, this.bluffSets.length - 1));
    }

    /** Toggles a character in the bluff set being edited. */
    toggleBluff(characterId: string) {
        const set = this.bluffSets[this.activeBluffSet];
        if (!set) return;
        const updated = set.includes(characterId)
            ? set.filter(id => id !== characterId)
            : [...set, characterId];
        this.bluffSets = this.bluffSets.map((s, i) => i === this.activeBluffSet ? updated : s);
    }
}
