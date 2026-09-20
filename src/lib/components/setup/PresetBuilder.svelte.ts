import { getPlayerCount } from "$lib/common/util.js";
import type { ScriptCharacter, ScriptWithCharacters } from "$lib/resources/common/gameData.js";

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
    bluffIds = $state<string[]>([]);

    charById = $derived(new Map((this.script?.characters ?? []).map(c => [c.id, c])));

    chosenCharacters = $derived(this.chosenCharacterIds.map(id => this.charById.get(id)).filter((c): c is ScriptCharacter => !!c));
    expectedCounts = $derived(getPlayerCount(this.playerCount ?? 5));
    currentCounts = $derived({
        townsfolk: this.chosenCharacters.filter(c => c.category === 'townsfolk').length,
        outsiders: this.chosenCharacters.filter(c => c.category === 'outsider').length,
        minions: this.chosenCharacters.filter(c => c.category === 'minion').length,
        demons: this.chosenCharacters.filter(c => c.category === 'demon').length
    });

    bagCharacterIds = $derived(subtractIds(this.chosenCharacterIds, this.grimCharacterIds));
    /** Tokens beyond one per player, which have to be sorted into the bag and the grim. */
    surplusCount = $derived(Math.max(0, this.chosenCharacterIds.length - (this.playerCount ?? 0)));
    hasEnoughTokens = $derived(this.chosenCharacterIds.length >= (this.playerCount ?? 0));
    /** True once the bag holds exactly one token per player. */
    isSorted = $derived(this.hasEnoughTokens && this.bagCharacterIds.length === this.playerCount);

    setScript(script: ScriptWithCharacters | null) {
        this.script = script;
        this.playerCount = null;
        this.reset();
    }

    reset() {
        this.chosenCharacterIds = [];
        this.grimCharacterIds = [];
        this.bluffIds = [];
    }

    choosePlayerCount(n: number) {
        if (n !== this.playerCount) this.reset();
        this.playerCount = n;
    }

    /**
     * Loads a saved character list. Presets saved before the bag/grim split have no grim tokens
     * saved, so their zero-seat characters are the grim tokens.
     */
    loadCharacters(characterIds: string[], bluffIds: string[], grimIds?: string[]) {
        this.chosenCharacterIds = [...characterIds];
        this.grimCharacterIds = grimIds
            ? [...grimIds]
            : characterIds.filter(id => this.charById.get(id)?.player_count === 0);
        this.bluffIds = [...bluffIds];
    }

    countOf(characterId: string): number {
        return this.chosenCharacterIds.filter(id => id === characterId).length;
    }

    addCharacter(characterId: string) {
        this.chosenCharacterIds = [...this.chosenCharacterIds, characterId];
        this.grimCharacterIds = [];
    }

    /** Removes one copy of the character. */
    removeCharacter(characterId: string) {
        this.chosenCharacterIds = subtractIds(this.chosenCharacterIds, [characterId]);
        this.grimCharacterIds = [];
    }

    moveToGrim(characterId: string) {
        if (this.bagCharacterIds.includes(characterId)) this.grimCharacterIds = [...this.grimCharacterIds, characterId];
    }

    moveToBag(characterId: string) {
        this.grimCharacterIds = subtractIds(this.grimCharacterIds, [characterId]);
    }

    toggleBluff(characterId: string) {
        if (this.bluffIds.includes(characterId)) {
            this.bluffIds = this.bluffIds.filter(id => id !== characterId);
        } else if (this.bluffIds.length < 3) {
            this.bluffIds = [...this.bluffIds, characterId];
        }
    }
}
