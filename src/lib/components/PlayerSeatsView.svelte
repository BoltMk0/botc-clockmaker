<script lang="ts">
    import PlayerToken from "./PlayerToken.svelte";
    import { playerDisplayName, seatNumbers, type GrimoireStateHistory } from "$lib/resources/common/grimoireState";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData";
    import { computeSeatsLayout, filterSeatTokens } from "./playerSeatsLayout";

    let {
        grimoireState,
        script
    }: {
        grimoireState: GrimoireStateHistory | null;
        script: ScriptWithCharacters | null;
    } = $props();

    const seatTokens = $derived(filterSeatTokens(grimoireState, script));
    const numbers = $derived(seatNumbers(seatTokens));

    const MIN_TOKEN_SIZE = 40;
    const MAX_TOKEN_SIZE = 320;
    const EDGE_PADDING = 16;

    let containerWidth = $state(0);
    let containerHeight = $state(0);
    const layout = $derived(
        computeSeatsLayout(seatTokens, containerWidth, containerHeight, {
            minTokenSize: MIN_TOKEN_SIZE,
            maxTokenSize: MAX_TOKEN_SIZE,
            edgePadding: EDGE_PADDING
        })
    );
</script>

<div class="players-view" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
    {#each layout.tokens as { token, x, y } (token.id)}
        <PlayerToken
            playerName={playerDisplayName(token, numbers)}
            isDead={token.isDead}
            size="{layout.tokenSize}px"
            style="left: calc(50% + {x}px); top: calc(50% + {y}px); transform: translate(-50%, -50%);"
        />
    {/each}

    {#if seatTokens.length === 0}
        <div class="empty-message">No players seated yet.</div>
    {/if}
</div>

<style>
    .players-view {
        position: absolute;
        inset: 0;
        overflow: hidden;
    }

    .empty-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #999;
        font-size: 1.2em;
        text-align: center;
    }
</style>
