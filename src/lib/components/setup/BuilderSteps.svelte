<script lang="ts">
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import TokenGrid from "./TokenGrid.svelte";
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
    }

    let { builder, step, navigate, afterPlayers = 'tokens', beforeTokens = 'players', afterBluffs = 'summary', onBackFromPlayers }: Props = $props();

    const COUNT_KEYS = { townsfolk: 'townsfolk', outsider: 'outsiders', minion: 'minions', demon: 'demons' } as const;

    function backToTokens() {
        builder.extraSeatFor = {};
        navigate('tokens');
    }

    function finishCharacters() {
        builder.extraSeatFor = {};
        navigate(builder.zeroCountChars.length === 0 ? 'bluffs' : 'extras');
    }

    function chooseExtra(characterId: string) {
        if (builder.chooseExtra(characterId)) navigate('bluffs');
    }
</script>

<style>
    .section {
        background: var(--theme-bg-secondary);
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
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

    .character-counts-table td, .character-counts-table th {
        padding: 0.1em 0.4em;
        text-align: center;
    }

    .over {
        color: #f59e0b;
        font-weight: bold;
    }

    .warning {
        margin-top: 0.5em;
        color: #f59e0b;
    }

    .zero-count-row {
        display: flex;
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
            {#if onBackFromPlayers}
                <button class="button-style" onclick={onBackFromPlayers}>← Back</button>
            {/if}
        </div>
        <div style="font-style: italic; opacity: 0.6; margin-top: -0.5em;">Excluding travellers, these should be added after the grim setup</div>
        <div class="player-count-grid">
            {#each { length: 11 } as _, i}
                <button class="button-style" class:highlight={builder.playerCount === i + 5} onclick={() => { builder.choosePlayerCount(i + 5); navigate(afterPlayers); }}>{i + 5}</button>
            {/each}
        </div>
    </div>
{:else if step === 'tokens' && builder.script}
    <div class="section">
        <table class="character-counts-table">
            <thead>
                <tr><th></th><th>Chosen</th><th>T</th><th>O</th><th>M</th><th>D</th></tr>
            </thead>
            <tbody>
                <tr>
                    <td style="opacity: 0.5;">Target</td>
                    <td>{builder.playerCount}</td>
                    <td>{builder.expectedCounts.townsfolk}</td>
                    <td>{builder.expectedCounts.outsiders}</td>
                    <td>{builder.expectedCounts.minions}</td>
                    <td>{builder.expectedCounts.demons}</td>
                </tr>
                <tr>
                    <td style="opacity: 0.5;">Current</td>
                    <td>{builder.chosenCharacterIds.length}</td>
                    <td class:over={builder.currentCounts.townsfolk > builder.expectedCounts.townsfolk}>{builder.currentCounts.townsfolk}</td>
                    <td class:over={builder.currentCounts.outsiders > builder.expectedCounts.outsiders}>{builder.currentCounts.outsiders}</td>
                    <td class:over={builder.currentCounts.minions > builder.expectedCounts.minions}>{builder.currentCounts.minions}</td>
                    <td class:over={builder.currentCounts.demons > builder.expectedCounts.demons}>{builder.currentCounts.demons}</td>
                </tr>
            </tbody>
        </table>
        {#each builder.categoryWarnings as warning}
            <div class="warning">⚠ {warning}</div>
        {/each}
    </div>
    <div class="section">
        <TokenGrid
            chars={builder.script.characters}
            headingSuffix={category => !(category in COUNT_KEYS) ? '' : `(${builder.currentCounts[COUNT_KEYS[category as keyof typeof COUNT_KEYS]]}/${builder.expectedCounts[COUNT_KEYS[category as keyof typeof COUNT_KEYS]]})`}
            isSelected={c => builder.chosenCharacterIds.includes(c.id)}
            onpick={c => builder.toggleCharacter(c.id)}
            isDisabled={() => builder.chosenCharacterIds.length >= (builder.playerCount ?? 0)}
        />
    </div>
    <div class="footer-actions">
        <button class="button-style" onclick={() => navigate(beforeTokens)}>← Back</button>
        <button class="button-style highlight" disabled={builder.chosenCharacterIds.length !== builder.playerCount} onclick={finishCharacters}>Next →</button>
    </div>
{:else if step === 'extras' && builder.script}
    {#if builder.pendingZeroChar}
        <div class="section">
            <div class="zero-count-row">
                <div style="width: 80px; height: 80px; position: relative;">
                    <CharacterToken character={builder.pendingZeroChar} size="80px" norules />
                </div>
                <div>
                    <strong>{builder.pendingZeroChar.name}</strong> doesn't take a seat. Choose an extra character to fill it
                    ({builder.extraSeatCharacterIds.length + 1} of {builder.zeroCountChars.length}).
                </div>
            </div>
        </div>
        <div class="section">
            <TokenGrid
                chars={builder.script.characters.filter(c => c.player_count !== 0 && !builder.chosenCharacterIds.includes(c.id) && !builder.extraSeatCharacterIds.includes(c.id))}
                onpick={c => chooseExtra(c.id)}
            />
        </div>
    {/if}
    <div class="footer-actions">
        <button class="button-style" onclick={backToTokens}>← Back</button>
    </div>
{:else if step === 'bluffs' && builder.script}
    <div class="section">
        <h2 style="margin-top: 0;">Choose 3 bluffs ({builder.bluffIds.length}/3)</h2>
        <TokenGrid
            chars={builder.script.characters.filter(c => !builder.allCharacterIds.includes(c.id))}
            isSelected={c => builder.bluffIds.includes(c.id)}
            onpick={c => builder.toggleBluff(c.id)}
            isDisabled={() => builder.bluffIds.length >= 3}
        />
    </div>
    <div class="footer-actions">
        <button class="button-style" onclick={backToTokens}>← Back</button>
        <button class="button-style highlight" disabled={builder.bluffIds.length !== 3} onclick={() => navigate(afterBluffs)}>Next →</button>
    </div>
{/if}
