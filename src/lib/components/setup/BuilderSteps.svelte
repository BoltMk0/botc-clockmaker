<script lang="ts">
    import { untrack } from "svelte";
    import TokenPicker from "./TokenPicker.svelte";
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    interface Props {
        builder: PresetBuilder;
        step: string;
        navigate: (step: string) => void;
        /** Where to go after choosing the player count / when going back from the characters step. */
        afterPlayers?: string;
        beforeTokens?: string;
        afterBluffs?: string;
        /** When provided, the players step shows a back button that calls this. */
        onBackFromPlayers?: () => void;
        /** Hides the back buttons, for pages that provide their own. */
        hideBack?: boolean;
        /** Hides the back and next buttons under each step, for pages that provide their own. */
        hideFooter?: boolean;
    }

    let { builder, step, navigate, afterPlayers = 'tokens', beforeTokens = 'players', afterBluffs = 'summary', onBackFromPlayers, hideBack = false, hideFooter = false }: Props = $props();

    // The bluffs step always opens with a set to fill in; any set left empty is dropped on leaving it.
    $effect(() => {
        if (step !== 'bluffs') return;
        untrack(() => { if (builder.bluffSets.length === 0) builder.addBluffSet(); });
        return () => untrack(() => builder.pruneEmptyBluffSets());
    });
</script>

<style>
    .section {
        background: var(--theme-bg-secondary);
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
    }

    .section.plain {
        background: none;
        padding: 0;
    }

    .picker {
        width: 100%;
        max-width: 40em;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    .picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1em;
    }

    .player-count-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(4em, 1fr));
        gap: 0.5em;
    }
    .player-count-grid button {
        padding: 0.8em 0;
        font-size: 1.1em;
    }

    .bluff-set-tabs {
        display: flex;
        gap: 0.25rem;
        margin-bottom: 1em;
        border-bottom: 1px solid var(--theme-bg-tertiary);
        overflow-x: auto;
    }
    .bluff-tab {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        border-bottom: 3px solid transparent;
        border-radius: 6px 6px 0 0;
        opacity: 0.7;
    }
    .bluff-tab:hover {
        opacity: 1;
        background-color: var(--theme-bg-secondary);
    }
    .bluff-tab.selected {
        opacity: 1;
        border-bottom-color: var(--theme-highlight);
    }
    .bluff-tab-select,
    .bluff-tab-remove,
    .bluff-tab-add {
        background: none;
        border: none;
        color: var(--theme-on-bg);
        font: inherit;
        cursor: pointer;
        touch-action: manipulation;
        white-space: nowrap;
    }
    .bluff-tab-select {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.6em 0.4em 0.6em 1em;
    }
    .bluff-tab.selected .bluff-tab-select {
        font-weight: bold;
    }
    .bluff-tab-count {
        font-size: 0.75em;
        font-weight: normal;
        padding: 0.1em 0.55em;
        border-radius: 999px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }
    .bluff-tab-remove {
        padding: 0.4em 0.7em;
        margin-right: 0.2em;
        border-radius: 50%;
        opacity: 0.6;
    }
    .bluff-tab-remove:hover {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
    }
    .bluff-tab-add {
        flex-shrink: 0;
        padding: 0.6em 1em;
        border-bottom: 3px solid transparent;
        border-radius: 6px 6px 0 0;
        opacity: 0.7;
    }
    .bluff-tab-add:hover {
        opacity: 1;
        background-color: var(--theme-bg-secondary);
    }

    /* Fills the page's body; only the list scrolls, so the buttons below it are always in view. */
    .step-layout {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    .step-scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
    }

    .footer-actions {
        display: flex;
        justify-content: space-between;
        gap: 1em;
        flex-shrink: 0;
    }
</style>

{#if step === 'players'}
    <div class="picker">
        <div class="picker-header">
            <h2 style="margin: 0;">How Many Players?</h2>
            {#if onBackFromPlayers && !hideBack}
                <button class="button-style" onclick={onBackFromPlayers}>← Back</button>
            {/if}
        </div>
        <div style="font-style: italic; opacity: 0.6; margin-top: -0.5em;">Include travellers who'll draw from the bag; others can be added after the grim setup</div>
        <div class="player-count-grid">
            {#each { length: 12 } as _, i}
                <button class="button-style" class:highlight={builder.playerCount === i + 4} onclick={() => { builder.choosePlayerCount(i + 4); navigate(afterPlayers); }}>{i + 4}</button>
            {/each}
        </div>
    </div>
{:else if step === 'tokens' && builder.script}
<div class="step-layout">
    <div class="section plain step-scroll">
        <TokenPicker {builder} />
    </div>
    {#if !hideFooter}
    <div class="footer-actions">
        {#if !hideBack}<button class="button-style" onclick={() => navigate(beforeTokens)}>← Back</button>{:else}<span></span>{/if}
        <button class="button-style highlight" disabled={!builder.hasEnoughTokens} onclick={() => navigate('bluffs')}>Next →</button>
    </div>
    {/if}
</div>
{:else if step === 'bluffs' && builder.script}
<div class="step-layout">
    <div class="section plain step-scroll">
        <h2 style="margin-top: 0;">Bluffs <span style="opacity: 0.6; font-weight: normal; font-size: 0.7em;">(optional)</span></h2>
        <div class="bluff-set-tabs" role="tablist" aria-label="Bluff sets">
            {#each builder.bluffSets as set, i}
                {@const active = builder.activeBluffSet === i}
                <div class="bluff-tab" class:selected={active}>
                    <button class="bluff-tab-select" role="tab" aria-selected={active} onclick={() => builder.activeBluffSet = i}>
                        Set {i + 1}<span class="bluff-tab-count">{set.length}</span>
                    </button>
                    <button class="bluff-tab-remove" aria-label="Remove set {i + 1}" title="Remove set {i + 1}" onclick={() => builder.removeBluffSet(i)}>✕</button>
                </div>
            {/each}
            <button class="bluff-tab-add" onclick={() => builder.addBluffSet()} title="Add a bluff set">+ Add set</button>
        </div>
        {#if builder.bluffSets.length === 0}
            <div style="opacity: 0.6; font-style: italic;">No bluff sets. Add one, or continue without bluffs.</div>
        {:else}
            <h3 style="margin: 0;">Choose at least 3 bluffs for set {builder.activeBluffSet + 1}</h3>
            <div style="opacity: 0.6; font-style: italic; margin-bottom: 0.5em;">Faded characters are already in play.</div>
            <TokenPicker {builder} mode="bluffs" />
        {/if}
    </div>
    {#if !hideFooter}
    <div class="footer-actions">
        {#if !hideBack}<button class="button-style" onclick={() => navigate('tokens')}>← Back</button>{:else}<span></span>{/if}
        <button class="button-style highlight" disabled={!builder.bluffsValid} onclick={() => navigate(afterBluffs)}>Next →</button>
    </div>
    {/if}
</div>
{/if}
