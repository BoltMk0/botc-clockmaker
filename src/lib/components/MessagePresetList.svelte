<script lang="ts" module>
    import { ALL_CHARACTER_CATEGORIES, type Character, type CharacterCategory } from "$lib/resources/common/gameData";
    import type { CharacterSection } from "$lib/components/MessageBuilder.svelte";

    const CATEGORY_TITLES: Record<CharacterCategory, string> = {
        townsfolk: 'Townsfolk',
        outsider: 'Outsiders',
        minion: 'Minions',
        demon: 'Demons',
        traveler: 'Travellers',
        loric: 'Loric',
        fabled: 'Fabled',
    };

    // With no script to go by, the builder's character picker offers every character, by category.
    export function sectionsByCategory(characters: Character[]): CharacterSection[] {
        return ALL_CHARACTER_CATEGORIES
            .map(category => ({ key: category, title: CATEGORY_TITLES[category], characters: characters.filter(c => c.category === category) }))
            .filter(section => section.characters.length > 0);
    }
</script>

<script lang="ts" generics="T extends MessagePreset">
    import type { MessagePreset, TextOption } from "$lib/common/message";
    import { characterImageUrl } from "$lib/resources/common/characterImages";
    import MessageBuilder, { type MessageBuilderView } from "$lib/components/MessageBuilder.svelte";
    import MessageText from "$lib/components/MessageText.svelte";

    // A list of message presets, each shown as it'll look, to name, reorder, delete and edit in the message builder
    // (where they can have blanks) - the communications presets in settings, and a character's own for each night.
    let {
        presets = $bindable(),
        newPreset,
        textOptions = $bindable(),
        sections,
        characters,
    }: {
        presets: T[];
        // A new, empty preset to add.
        newPreset: () => T;
        textOptions: TextOption[];
        sections: CharacterSection[];
        // Every character a preset might show, by id.
        characters: Record<string, Character>;
    } = $props();

    // In the character editor the list is inside the character's form, which Enter in a name would otherwise submit.
    const keepEnterFromForm = (e: KeyboardEvent) => { if (e.key === 'Enter') e.preventDefault(); };

    function move(index: number, by: number) {
        const [preset] = presets.splice(index, 1);
        presets.splice(index + by, 0, preset);
    }

    // The preset open in the builder, and which of the builder's screens is showing.
    let editing = $state<number | null>(null);
    let builderView = $state<MessageBuilderView>('builder');
    let builder = $state<MessageBuilder>();

    function edit(index: number) {
        builderView = 'builder';
        editing = index;
    }

    function addPreset() {
        presets.push(newPreset());
        edit(presets.length - 1);
    }

    function back() {
        if (!builder?.back()) editing = null;
    }
</script>

<div class="preset-list">
    {#each presets as preset, i}
        <div class="preset-card">
            <div class="preset-header">
                <input class="preset-name" type="text" bind:value={preset.name} placeholder="Name" aria-label="Name" onkeydown={keepEnterFromForm} />
                <button type="button" onclick={() => edit(i)}>Edit</button>
                <button type="button" title="Move up" aria-label="Move up" disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
                <button type="button" title="Move down" aria-label="Move down" disabled={i === presets.length - 1} onclick={() => move(i, 1)}>↓</button>
                <button type="button" title="Delete" aria-label="Delete" onclick={() => presets.splice(i, 1)}>✕</button>
            </div>
            <div class="preset-preview">
                {#each preset.elements as element}
                    {#if element.type === 'text'}
                        <div class="preview-text" class:dumbledore-font={element.style === 'Header'} class:header={element.style === 'Header'}><MessageText text={element.value}/></div>
                    {:else if element.type === 'character'}
                        <div class="preview-tokens">
                            {#each element.value as characterId}
                                <img src={characterImageUrl(characterId, 128)} alt={characters[characterId]?.name ?? ''} title={characters[characterId]?.name ?? ''} />
                            {/each}
                        </div>
                    {:else if element.type === 'alignment'}
                        <div class="preview-alignment dumbledore-font {element.value}">{element.value === 'good' ? 'GOOD' : 'EVIL'}</div>
                    {:else}
                        <div class="preview-blank">Blank</div>
                    {/if}
                {:else}
                    <div class="empty">Empty - press Edit to build it.</div>
                {/each}
            </div>
        </div>
    {:else}
        <div class="empty">No presets yet.</div>
    {/each}
    <button type="button" class="add-preset" onclick={addPreset}>+ Add preset</button>
</div>

{#if editing !== null && presets[editing]}
    {@const preset = presets[editing]}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="builder-overlay" role="dialog" tabindex="-1" onclick={() => editing = null}>
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div class="builder-frame" onclick={(e) => e.stopPropagation()}>
            <!-- Outside the panel, so it stays put while the panel scrolls -->
            <button type="button" class="builder-back" onclick={back}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z"/></svg>
                Back
            </button>
            <div class="builder-panel">
                {#if builderView === 'builder'}
                    <input class="builder-name" type="text" bind:value={preset.name} placeholder="Name" aria-label="Name" onkeydown={keepEnterFromForm} />
                {/if}
                <MessageBuilder
                    bind:this={builder}
                    bind:elements={preset.elements}
                    bind:view={builderView}
                    bind:textOptions
                    {sections}
                    {characters}
                    tokenSize={56}
                    imageSize={128}
                    blanks="add"
                />
                {#if builderView === 'builder'}
                    <button type="button" class="done" onclick={() => editing = null}>Done</button>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .preset-list {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .empty {
        opacity: 0.6;
        font-style: italic;
        padding: 0.5rem 0;
    }

    .preset-card {
        padding: 1rem;
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 10px;
        background-color: var(--theme-bg);
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .preset-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .preset-name {
        flex: 1;
        min-width: 0;
        font-weight: 600;
    }

    .preset-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.4rem;
        text-align: center;
    }

    .preview-text {
        white-space: pre-line;
    }

    .preview-text.header {
        font-size: 1.4rem;
    }

    .preview-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4rem;
    }

    .preview-tokens img {
        width: 3em;
        height: 3em;
        border-radius: 50%;
        object-fit: cover;
    }

    /* Filled in each time the preset is shown */
    .preview-blank {
        padding: 0.4em 1.2em;
        border: 2px dashed currentColor;
        border-radius: 0.5em;
        opacity: 0.6;
        font-style: italic;
    }

    .preview-alignment {
        font-size: 1.4rem;
        font-weight: bold;
        letter-spacing: 0.08em;
    }

    .preview-alignment.good {
        color: #558bdf;
    }

    .preview-alignment.evil {
        color: #ca4444;
    }

    button.add-preset {
        padding: 0.6em;
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add-preset:hover {
        border-color: var(--theme-highlight);
    }

    input, button {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input:focus {
        outline: 2px solid var(--theme-highlight);
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .builder-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .builder-frame {
        position: relative;
        width: min(100%, 36rem);
        height: min(100%, 92vh);
    }

    .builder-back {
        position: absolute;
        top: 10px;
        left: 10px;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.1em;
        padding: 0.45em 0.9em 0.45em 0.5em;
        border: none;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        font-size: 1em;
    }

    .builder-back svg {
        width: 1.3em;
        height: 1.3em;
        fill: currentColor;
    }

    .builder-panel {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        padding: 3.5em 1.2em 1.2em;
        border-radius: 12px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.7em;
    }

    .builder-name {
        width: 100%;
        box-sizing: border-box;
        padding: 0.6em;
        font-size: 1.1em;
        text-align: center;
    }

    button.done {
        width: 100%;
        flex-shrink: 0;
        margin-top: 1.2em;
        padding: 16px;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }
</style>
