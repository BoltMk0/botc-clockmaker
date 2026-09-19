import { getPlayerCount } from "$lib/common/util.js";
import type { ScriptCharacter, ScriptWithCharacters } from "$lib/resources/common/gameData.js";

/**
 * State and rules shared by the game setup flow and the preset editor:
 * player count > characters > extra characters (for zero-seat characters) > bluffs.
 */
export class PresetBuilder {
    script = $state.raw<ScriptWithCharacters | null>(null);
    playerCount = $state<number | null>(null);
    chosenCharacterIds = $state<string[]>([]);
    bluffIds = $state<string[]>([]);
    extraSeatFor = $state<Record<string, string>>({});

    charById = $derived(new Map((this.script?.characters ?? []).map(c => [c.id, c])));

    chosenCharacters = $derived(this.chosenCharacterIds.map(id => this.charById.get(id)).filter((c): c is ScriptCharacter => !!c));
    expectedCounts = $derived(getPlayerCount(this.playerCount ?? 5));
    currentCounts = $derived({
        townsfolk: this.chosenCharacters.filter(c => c.category === 'townsfolk').length,
        outsiders: this.chosenCharacters.filter(c => c.category === 'outsider').length,
        minions: this.chosenCharacters.filter(c => c.category === 'minion').length,
        demons: this.chosenCharacters.filter(c => c.category === 'demon').length
    });

    categoryWarnings = $derived(
        (['townsfolk', 'outsiders', 'minions', 'demons'] as const)
            .filter(key => this.currentCounts[key] > this.expectedCounts[key])
            .map(key => `Too many ${key}: ${this.currentCounts[key]} selected, ${this.expectedCounts[key]} expected.`)
    );

    zeroCountChars = $derived(this.chosenCharacters.filter(c => c.player_count === 0));
    pendingZeroChar = $derived(this.zeroCountChars.find(c => !this.extraSeatFor[c.id]));
    extraSeatCharacterIds = $derived(this.zeroCountChars.map(c => this.extraSeatFor[c.id]).filter((id): id is string => !!id));

    seatCharacterIds = $derived([
        ...this.chosenCharacterIds.filter(id => (this.charById.get(id)?.player_count ?? 1) > 0),
        ...this.extraSeatCharacterIds
    ]);
    allCharacterIds = $derived([...this.chosenCharacterIds, ...this.extraSeatCharacterIds]);

    setScript(script: ScriptWithCharacters | null) {
        this.script = script;
        this.playerCount = null;
        this.reset();
    }

    reset() {
        this.chosenCharacterIds = [];
        this.bluffIds = [];
        this.extraSeatFor = {};
    }

    choosePlayerCount(n: number) {
        if (n !== this.playerCount) this.reset();
        this.playerCount = n;
    }

    /**
     * Loads a saved character list, which is the chosen characters followed by one extra
     * per zero-seat character (see allCharacterIds). Falls back to treating every id as chosen.
     */
    loadCharacters(characterIds: string[], bluffIds: string[]) {
        const isZero = (id: string) => this.charById.get(id)?.player_count === 0;
        const zeroCount = characterIds.filter(isZero).length;
        const split = characterIds.length - zeroCount;
        const extras = characterIds.slice(split);
        const chosen = characterIds.slice(0, split);
        this.bluffIds = [...bluffIds];
        if (zeroCount > 0 && !extras.some(isZero) && chosen.filter(isZero).length === zeroCount) {
            this.chosenCharacterIds = chosen;
            this.extraSeatFor = Object.fromEntries(chosen.filter(isZero).map((id, i) => [id, extras[i]]));
        } else {
            this.chosenCharacterIds = [...characterIds];
            this.extraSeatFor = {};
        }
    }

    toggleCharacter(characterId: string) {
        if (this.chosenCharacterIds.includes(characterId)) {
            this.chosenCharacterIds = this.chosenCharacterIds.filter(id => id !== characterId);
        } else if (this.chosenCharacterIds.length < (this.playerCount ?? 0)) {
            this.chosenCharacterIds = [...this.chosenCharacterIds, characterId];
        }
    }

    /** Returns true once no further extra characters are needed. */
    chooseExtra(characterId: string): boolean {
        if (!this.pendingZeroChar) return true;
        this.extraSeatFor[this.pendingZeroChar.id] = characterId;
        return !this.pendingZeroChar;
    }

    toggleBluff(characterId: string) {
        if (this.bluffIds.includes(characterId)) {
            this.bluffIds = this.bluffIds.filter(id => id !== characterId);
        } else if (this.bluffIds.length < 3) {
            this.bluffIds = [...this.bluffIds, characterId];
        }
    }
}
