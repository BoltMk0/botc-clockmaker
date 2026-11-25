<script lang="ts">
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import InPlayWarning from "$lib/components/InPlayWarning.svelte";
    import { ALL_CHARACTER_CATEGORIES, CHARACTER_CATEGORY_COLORS, type CharacterCategory, type ScriptCharacter } from "$lib/resources/common/gameData.js";
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    // The setup's character step laid out like the grim's token tray: a grid of tokens for each character type.
    // Tapping a token picks it (or, once picked, takes every copy back out); a picked token's + adds another copy,
    // for setups that use the same character more than once (e.g. Legion).
    // In bluffs mode it picks the builder's active bluff set instead: only the player types, one copy each, with the
    // characters already in play faded. Each token's ? opens an overlay with the character's token and ability.

    let { builder, tokenSize = 92, mode = 'characters' }: { builder: PresetBuilder; tokenSize?: number; mode?: 'characters' | 'bluffs' } = $props();

    const BLUFF_CATEGORIES: CharacterCategory[] = ['townsfolk', 'outsider', 'minion', 'demon'];
    const activeBluffs = $derived(builder.bluffSets[builder.activeBluffSet] ?? []);

    let infoCharacter = $state<ScriptCharacter | null>(null);

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

    // Travellers, loric and fabled come from the whole character library, so they get a header that folds them away.
    // They start folded unless the preset already uses one of them.
    const COLLAPSIBLE: CharacterCategory[] = ['traveler', 'loric', 'fabled'];
    // svelte-ignore state_referenced_locally
    let collapsed = $state(new Set<CharacterCategory>(
        COLLAPSIBLE.filter(category => !builder.chosenCharacters.some(c => c.category === category))
    ));

    function toggleSection(category: CharacterCategory) {
        const next = new Set(collapsed);
        next.has(category) ? next.delete(category) : next.add(category);
        collapsed = next;
    }

    const sections = $derived((mode === 'bluffs' ? BLUFF_CATEGORIES : ALL_CHARACTER_CATEGORIES).map(category => ({
        category,
        characters: (builder.script?.characters ?? [])
            .filter(c => c.category === category)
            .sort((a, b) => a.name.localeCompare(b.name))
    })).filter(s => s.characters.length > 0));

    function countText(category: CharacterCategory): string {
        if (mode === 'bluffs') return `${activeBluffs.filter(id => builder.charById.get(id)?.category === category).length}`;
        const selected = builder.chosenCharacters.filter(c => c.category === category).length;
        const key = COUNT_KEYS[category];
        return key ? `${selected}/${builder.expectedCounts[key]}` : `${selected}`;
    }

    function countFor(characterId: string): number {
        return mode === 'bluffs' ? (activeBluffs.includes(characterId) ? 1 : 0) : builder.countOf(characterId);
    }

    function tap(characterId: string) {
        if (mode === 'bluffs') return builder.toggleBluff(characterId);
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

    .category-section {
        display: flex;
        flex-direction: column;
        gap: 0.4em;
    }

    /* The character type runs up the left of its tokens, beside a divider in the type's colour. */
    .category-row {
        display: flex;
        align-items: stretch;
        gap: 0.6em;
    }

    .category-side {
        flex-shrink: 0;
        width: 1.6em;
        border-right: 3px solid var(--category-color);
    }

    .category-label {
        position: sticky;
        top: 0;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.5em 0;
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        white-space: nowrap;
    }

    .category-name {
        font-weight: 600;
    }

    .category-count {
        opacity: 0.7;
    }

    .token-grid {
        flex: 1;
        min-width: 0;
        /* Wrapping rows, each centred, so a short last row sits in the middle too. */
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-content: center;
        gap: 0.3em calc(0.3em + 8px);
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

    .picker-token.in-play {
        opacity: 0.35;
    }

    .info-btn {
        position: absolute;
        top: -6px;
        left: -6px;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font-size: 18px;
        font-weight: 700;
        line-height: 32px;
        cursor: pointer;
        touch-action: manipulation;
    }

    .info-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.6);
    }

    .info-panel {
        position: relative;
        width: min(26em, 100%);
        max-height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5em 1.2em;
        border-radius: 1em;
        background: var(--theme-bg);
        color: var(--theme-on-bg);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.6em;
        text-align: center;
    }

    .info-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 50%;
        background: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font-size: 1em;
        cursor: pointer;
        touch-action: manipulation;
    }

    .info-name {
        font-size: 1.6em;
    }

    .info-category {
        text-transform: capitalize;
        opacity: 0.7;
        margin-top: -0.4em;
    }

    .info-setup {
        font-style: italic;
        opacity: 0.8;
    }

    .add-copy {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font-size: 22px;
        line-height: 32px;
        cursor: pointer;
        touch-action: manipulation;
    }
</style>

<div class="token-picker" style="--token: {tokenSize}px;">
    {#each sections as section (section.category)}
        {@const collapsible = COLLAPSIBLE.includes(section.category)}
        {@const isCollapsed = collapsible && collapsed.has(section.category)}
        <div class="category-section" style="--category-color: {CHARACTER_CATEGORY_COLORS[section.category]};">
            {#if collapsible}
                <button class="section-toggle" aria-expanded={!isCollapsed} onclick={() => toggleSection(section.category)}>
                    <svg viewBox="0 0 24 24" class:collapsed={isCollapsed}><path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
                    {TITLES[section.category]}
                    <span class="section-count">{countText(section.category)} selected</span>
                </button>
            {/if}
            {#if !isCollapsed}
                <div class="category-row">
                <div class="category-side">
                    {#if !collapsible}
                        <div class="category-label">
                            <span class="category-name">{TITLES[section.category]}</span>
                            <span class="category-count">{countText(section.category)}</span>
                        </div>
                    {/if}
                </div>
                <div class="token-grid">
                    {#each section.characters as character (character.id)}
                        {@const count = countFor(character.id)}
                        {@const bluffInPlay = mode === 'bluffs' && builder.countOf(character.id) > 0}
                        <div style="position: relative;">
                            <button class="picker-token" class:picked={count > 0} class:in-play={bluffInPlay} aria-label={character.name} aria-pressed={count > 0}
                                title={character.setup ? `${character.rules} [${character.setup}]` : character.rules}
                                onclick={() => tap(character.id)}>
                                <CharacterToken {character} style="position: relative;" size="{tokenSize}px" imageSize={256} norules/>
                            </button>
                            {#if bluffInPlay && count > 0}<InPlayWarning size="26px" style="position: absolute; bottom: -4px; right: -4px; pointer-events: none;"/>{/if}
                            {#if count > 1}<span class="count-badge">×{count}</span>{/if}
                            <button class="info-btn" aria-label="About {character.name}" title="About {character.name}" onclick={() => infoCharacter = character}>?</button>
                            {#if count > 0 && mode === 'characters'}
                                <button class="add-copy" aria-label="Add another {character.name}" title="Add another" onclick={() => builder.addCharacter(character.id)}>+</button>
                            {/if}
                        </div>
                    {/each}
                </div>
                </div>
            {/if}
        </div>
    {/each}
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') infoCharacter = null; }} />

{#if infoCharacter}
    {@const c = infoCharacter}
    <div class="info-overlay" role="dialog" aria-modal="true" aria-label={c.name} tabindex="-1" onclick={() => infoCharacter = null} onkeydown={() => {}}>
        <div class="info-panel" role="presentation" onclick={(e) => e.stopPropagation()}>
            <button class="info-close" onclick={() => infoCharacter = null} aria-label="Close">✕</button>
            <CharacterToken character={c} style="position: relative;" size="min(50vw, 180px)" imageSize={256} norules/>
            <div class="info-name dumbledore-font">{c.name}</div>
            <div class="info-category">{c.category}</div>
            <div>{c.rules}</div>
            {#if c.setup}<div class="info-setup">[{c.setup}]</div>{/if}
        </div>
    </div>
{/if}
