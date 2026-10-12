<script lang="ts">
    import { CHARACTER_CATEGORIES, presetDisplayName, presetGrimCharacterIds, type Preset, type ScriptCharacter } from "$lib/resources/common/gameData.js";
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";
    import PresetStats from "./PresetStats.svelte";
    import { onMount } from "svelte";
    import { fetchAllCharacters, withSideCharacters } from "$lib/resources/client/scriptWithSideCharacters.js";

    interface Props {
        preset: Preset;
        /** The script's characters, used to look up the preset's character ids. */
        characters: ScriptCharacter[];
        /** Position in the script's preset list, used to name unnamed presets. */
        index: number;
    }

    let { preset, characters, index }: Props = $props();

    // Travellers, loric and fabled aren't in a script's own list, so look them up separately.
    let sideCharacters = $state<ScriptCharacter[]>([]);
    onMount(async () => {
        sideCharacters = withSideCharacters({ id: '', name: '', hue: '', characters: [] }, await fetchAllCharacters()).characters;
    });
    const allCharacters = $derived([...characters, ...sideCharacters]);

    // Demons first, townsfolk last.
    const toSortedCharacters = (ids: string[]) => ids
        .map(id => allCharacters.find(c => c.id === id))
        .filter(c => !!c)
        .sort((a, b) => CHARACTER_CATEGORIES.indexOf(b.category) - CHARACTER_CATEGORIES.indexOf(a.category));

    const grimIds = $derived(presetGrimCharacterIds(preset, characters));
    const grimCharacters = $derived(toSortedCharacters(grimIds));
    const bagCharacters = $derived.by(() => {
        const remaining = [...grimIds];
        return toSortedCharacters(preset.character_ids.filter(id => {
            const i = remaining.indexOf(id);
            if (i < 0) return true;
            remaining.splice(i, 1);
            return false;
        }));
    });
</script>

<style>
    .preset-summary {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        min-width: 0;
        flex: 1 1 auto;
    }

    .preset-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1em;
    }

    .preset-tokens {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 2px;
    }

    .bag-grim-divider {
        align-self: stretch;
        width: 0;
        border-left: 2px solid currentColor;
        opacity: 0.4;
        margin: 0 0.4em;
    }
</style>

<div class="preset-summary">
    <div class="preset-heading">
        <span>{presetDisplayName(preset, index)}</span>
        <PresetStats {preset} />
    </div>
    <div class="preset-tokens">
        {#each bagCharacters as character, i (character.id + i)}
            <CharacterThumb {character} size="1.8em" />
        {/each}
        {#if grimCharacters.length > 0}
            <span class="bag-grim-divider"></span>
            {#each grimCharacters as character, i (character.id + i)}
                <CharacterThumb {character} size="1.8em" />
            {/each}
        {/if}
    </div>
</div>
