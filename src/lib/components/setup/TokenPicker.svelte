<script lang="ts">
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import { ALL_CHARACTER_CATEGORIES, type CharacterCategory } from "$lib/resources/common/gameData.js";
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    // The setup's character step laid out like the grim's token tray: a grid of tokens for each character type.
    // Tapping a token picks it (or, once picked, takes every copy back out); a picked token's + adds another copy,
    // for setups that use the same character more than once (e.g. Legion).

    let { builder, tokenSize = 80 }: { builder: PresetBuilder; tokenSize?: number } = $props();

    const TITLES: Record<CharacterCategory, string> = {
        townsfolk: 'Townsfolk',
        outsider: 'Outsiders',
        minion: 'Minions',
        demon: 'Demons',
        traveler: 'Travellers',
        loric: 'Loric',
        fabled: 'Fabled'
    };

    // The player categories show how many of the expected number are chosen; travellers, loric and fabled have no expected number.
    const COUNT_KEYS: Partial<Record<CharacterCategory, keyof PresetBuilder['expectedCounts']>> = {
        townsfolk: 'townsfolk',
        outsider: 'outsiders',
        minion: 'minions',
        demon: 'demons'
    };

    // Travellers, loric and fabled come from the whole character library, so they start folded away.
    let collapsed = $state(new Set<CharacterCategory>(['traveler', 'loric', 'fabled']));

    function toggleSection(category: CharacterCategory) {
        const next = new Set(collapsed);
        next.has(category) ? next.delete(category) : next.add(category);
        collapsed = next;
    }

    const sections = $derived(ALL_CHARACTER_CATEGORIES.map(category => ({
        category,
        characters: (builder.script?.characters ?? [])
            .filter(c => c.category === category)
            .sort((a, b) => a.name.localeCompare(b.name))
    })).filter(s => s.characters.length > 0));

    function countText(category: CharacterCategory): string {
        const selected = builder.chosenCharacters.filter(c => c.category === category).length;
        const key = COUNT_KEYS[category];
        return key ? `${selected}/${builder.expectedCounts[key]}` : `${selected}`;
    }

    function tap(characterId: string) {
        const count = builder.countOf(characterId);
        if (count === 0) builder.addCharacter(characterId);
        else for (let i = 0; i < count; i++) builder.removeCharacter(characterId);
    }
</script>

<style>
    .token-picker {
        display: flex;
        flex-direction: column;
        gap: 0.8em;
    }

    .section-toggle {
        display: flex;
        align-items: center;
        gap: 0.3em;
        width: 100%;
        padding: 0.4em 0.6em;
        border: none;
        border-radius: 0.6em;
        background: var(--theme-bg-secondary);
        color: inherit;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        touch-action: manipulation;
    }

    .section-toggle svg {
        width: 1.3em;
        height: 1.3em;
        fill: currentColor;
        transition: transform 0.15s;
    }

    .section-toggle svg.collapsed {
        transform: rotate(-90deg);
    }

    .section-count {
        margin-left: auto;
        font-weight: normal;
        opacity: 0.7;
    }

    .token-grid {
        display: grid;
        /* Fixed-width columns (not 1fr), as in the grim's tray, so spare width doesn't stretch the gaps. */
        grid-template-columns: repeat(auto-fill, calc(var(--token) + 8px));
        justify-content: center;
        justify-items: center;
        gap: 0.3em;
        padding: 0.5em 0;
    }

    .picker-token {
        position: relative;
        width: var(--token);
        height: var(--token);
        padding: 0;
        border: none;
        border-radius: 50%;
        background: none;
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
    }

    .picker-token.picked {
        outline: 3px solid gold;
        outline-offset: 2px;
    }

    .count-badge {
        position: absolute;
        bottom: -2px;
        left: -2px;
        min-width: 1.6em;
        padding: 0.1em 0.35em;
        border-radius: 999px;
        background: gold;
        color: #000;
        font-size: 0.8em;
        font-weight: 700;
        box-sizing: border-box;
        pointer-events: none;
    }

    .add-copy {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 26px;
        height: 26px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font-size: 18px;
        line-height: 26px;
        cursor: pointer;
        touch-action: manipulation;
    }
</style>

<div class="token-picker" style="--token: {tokenSize}px;">
    {#each sections as section (section.category)}
        {@const isCollapsed = collapsed.has(section.category)}
        <div>
            <button class="section-toggle" aria-expanded={!isCollapsed} onclick={() => toggleSection(section.category)}>
                <svg viewBox="0 0 24 24" class:collapsed={isCollapsed}><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                {TITLES[section.category]}
                <span class="section-count">{countText(section.category)} selected</span>
            </button>
            {#if !isCollapsed}
                <div class="token-grid">
                    {#each section.characters as character (character.id)}
                        {@const count = builder.countOf(character.id)}
                        <div style="position: relative;">
                            <button class="picker-token" class:picked={count > 0} aria-label={character.name} aria-pressed={count > 0}
                                title={character.setup ? `${character.rules} [${character.setup}]` : character.rules}
                                onclick={() => tap(character.id)}>
                                <CharacterToken {character} style="position: relative;" size="{tokenSize}px" imageSize={256} norules/>
                            </button>
                            {#if count > 1}<span class="count-badge">×{count}</span>{/if}
                            {#if count > 0}
                                <button class="add-copy" aria-label="Add another {character.name}" title="Add another" onclick={() => builder.addCharacter(character.id)}>+</button>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</div>
