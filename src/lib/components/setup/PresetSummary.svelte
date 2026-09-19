<script lang="ts">
    import { CHARACTER_CATEGORIES, presetDisplayName, type Preset, type ScriptCharacter } from "$lib/resources/common/gameData.js";
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";

    interface Props {
        preset: Preset;
        /** The script's characters, used to look up the preset's character ids. */
        characters: ScriptCharacter[];
        /** Position in the script's preset list, used to name unnamed presets. */
        index: number;
    }

    let { preset, characters, index }: Props = $props();

    // Demons first, townsfolk last.
    const presetCharacters = $derived(
        preset.character_ids
            .map(id => characters.find(c => c.id === id))
            .filter(c => !!c)
            .sort((a, b) => CHARACTER_CATEGORIES.indexOf(b.category) - CHARACTER_CATEGORIES.indexOf(a.category))
    );
</script>

<style>
    .preset-summary {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        min-width: 0;
    }

    .preset-tokens {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
    }
</style>

<div class="preset-summary">
    <span>{presetDisplayName(preset, index)}</span>
    <div class="preset-tokens">
        {#each presetCharacters as character (character.id)}
            <CharacterThumb {character} size="1.8em" />
        {/each}
    </div>
</div>
