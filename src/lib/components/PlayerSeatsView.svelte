<script lang="ts">
    import PlayerToken from "./PlayerToken.svelte";
    import type { GrimoireStateHistory, PlacedToken } from "$lib/resources/common/grimoireState";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData";

    let {
        grimoireState,
        script
    }: {
        grimoireState: GrimoireStateHistory | null;
        script: ScriptWithCharacters | null;
    } = $props();

    const charById = $derived<Record<string, { player_count: number }>>(
        Object.fromEntries((script?.characters ?? []).map(c => [c.id, c]))
    );

    const seatTokens = $derived(
        (grimoireState?.present.placedTokens ?? []).filter(t => (charById[t.characterId]?.player_count ?? 0) > 0)
    );

    // Layout: pull tokens in toward the center (CONDENSE), then scale them out again as far as
    // the container allows, picking the largest token size that keeps tokens on-screen and
    // non-overlapping.
    const CONDENSE = 0.6;
    const GAP_FACTOR = 1.08;
    const MIN_TOKEN_SIZE = 40;
    const MAX_TOKEN_SIZE = 320;
    const EDGE_PADDING = 16;

    type LayoutToken = { token: PlacedToken; x: number; y: number };

    function computeLayout(tokens: PlacedToken[], width: number, height: number): { tokens: LayoutToken[]; tokenSize: number } {
        if (tokens.length === 0 || width <= 0 || height <= 0) {
            return { tokens: [], tokenSize: 0 };
        }

        const boardRadius = Math.max(0, Math.min(width, height) / 2 - EDGE_PADDING);

        if (tokens.length === 1) {
            return { tokens: [{ token: tokens[0], x: 0, y: 0 }], tokenSize: Math.min(boardRadius * 1.6, MAX_TOKEN_SIZE) };
        }

        const condensed = tokens.map(t => ({ token: t, x: t.x * CONDENSE, y: t.y * CONDENSE }));

        let maxR = 0;
        let minDist = Infinity;
        for (let i = 0; i < condensed.length; i++) {
            maxR = Math.max(maxR, Math.hypot(condensed[i].x, condensed[i].y));
            for (let j = i + 1; j < condensed.length; j++) {
                minDist = Math.min(minDist, Math.hypot(condensed[i].x - condensed[j].x, condensed[i].y - condensed[j].y));
            }
        }
        if (maxR === 0) maxR = 1;
        if (!isFinite(minDist) || minDist === 0) minDist = boardRadius * 0.5 || 1;

        const scale = boardRadius / (maxR + minDist / (2 * GAP_FACTOR));
        const tokenSize = Math.max(MIN_TOKEN_SIZE, Math.min(MAX_TOKEN_SIZE, scale * minDist / GAP_FACTOR));

        return {
            tokens: condensed.map(c => ({ token: c.token, x: c.x * scale, y: c.y * scale })),
            tokenSize,
        };
    }

    let containerWidth = $state(0);
    let containerHeight = $state(0);
    const layout = $derived(computeLayout(seatTokens, containerWidth, containerHeight));
</script>

<div class="players-view" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
    {#each layout.tokens as { token, x, y } (token.characterId)}
        <PlayerToken
            playerName={token.playerName ?? ''}
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
