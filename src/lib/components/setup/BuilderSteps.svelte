<script lang="ts">
    import CharacterList from "$lib/components/CharacterList.svelte";
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
    }

    let { builder, step, navigate, afterPlayers = 'tokens', beforeTokens = 'players', afterBluffs = 'summary', onBackFromPlayers, hideBack = false }: Props = $props();

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
        flex-wrap: wrap;
        gap: 0.5em;
        margin-bottom: 1em;
    }
    .bluff-set-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1em;
    }

    .footer-actions {
        display: flex;
        justify-content: space-between;
        gap: 1em;
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
        <div style="font-style: italic; opacity: 0.6; margin-top: -0.5em;">Excluding travellers, these should be added after the grim setup</div>
        <div class="player-count-grid">
            {#each { length: 12 } as _, i}
                <button class="button-style" class:highlight={builder.playerCount === i + 4} onclick={() => { builder.choosePlayerCount(i + 4); navigate(afterPlayers); }}>{i + 4}</button>
            {/each}
        </div>
    </div>
{:else if step === 'tokens' && builder.script}
    <div class="section plain">
        <CharacterList
            characters={builder.script.characters}
            headingSuffix={category => `${builder.chosenCharacters.filter(c => c.category === category).length} selected`}
            countOf={c => builder.countOf(c.id)}
            onadd={c => builder.addCharacter(c.id)}
            onremove={c => builder.removeCharacter(c.id)}
        />
    </div>
    <div class="footer-actions">
        {#if !hideBack}<button class="button-style" onclick={() => navigate(beforeTokens)}>← Back</button>{:else}<span></span>{/if}
        <button class="button-style highlight" disabled={!builder.hasEnoughTokens} onclick={() => navigate('bluffs')}>Next →</button>
    </div>
{:else if step === 'bluffs' && builder.script}
    <div class="section plain">
        <h2 style="margin-top: 0;">Bluffs <span style="opacity: 0.6; font-weight: normal; font-size: 0.7em;">(optional)</span></h2>
        <div class="bluff-set-tabs">
            {#each builder.bluffSets as set, i}
                <button class="button-style" class:highlight={builder.activeBluffSet === i} onclick={() => builder.activeBluffSet = i}>Set {i + 1} ({set.length}/3)</button>
            {/each}
            <button class="button-style" onclick={() => builder.addBluffSet()}>+ Add bluff set</button>
        </div>
        {#if builder.bluffSets.length === 0}
            <div style="opacity: 0.6; font-style: italic;">No bluff sets. Add one, or continue without bluffs.</div>
        {:else}
            <div class="bluff-set-header">
                <h3 style="margin: 0;">Choose 3 bluffs for set {builder.activeBluffSet + 1}</h3>
                <button class="button-style" onclick={() => builder.removeBluffSet(builder.activeBluffSet)}>Remove set</button>
            </div>
            <CharacterList
                characters={builder.script.characters.filter(c => !builder.chosenCharacterIds.includes(c.id))}
                categoryOrder={['townsfolk', 'outsider', 'minion', 'demon']}
                isSelected={c => builder.bluffSets[builder.activeBluffSet]?.includes(c.id) ?? false}
                onpick={c => builder.toggleBluff(c.id)}
                isDisabled={() => (builder.bluffSets[builder.activeBluffSet]?.length ?? 0) >= 3}
            />
        {/if}
    </div>
    <div class="footer-actions">
        {#if !hideBack}<button class="button-style" onclick={() => navigate('tokens')}>← Back</button>{:else}<span></span>{/if}
        <button class="button-style highlight" disabled={!builder.bluffsValid} onclick={() => navigate(afterBluffs)}>Next →</button>
    </div>
{/if}
