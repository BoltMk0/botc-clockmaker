<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import PlayerToken from "$lib/components/PlayerToken.svelte";
    import { isGrimoireStateHistory, type GrimoireStateHistory, type PlacedToken } from "$lib/resources/common/grimoireState";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // svelte-ignore state_referenced_locally
    let grimoireState = $state<GrimoireStateHistory | null>(data.grimoireState);

    const charById = $derived<Record<string, { player_count: number }>>(
        Object.fromEntries((data.script?.characters ?? []).map(c => [c.id, c]))
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

    // Poll the grim state endpoint so this page reflects edits made on the grim board
    // without needing a manual refresh - there's no shared reactive store for grimoire state.
    onMount(() => {
        if (!browser) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/admin/${data.clockid}/grim/state`);
                if (!res.ok) return;
                const body = await res.json();
                if (isGrimoireStateHistory(body)) {
                    grimoireState = body;
                }
            } catch {
                // Ignore transient fetch failures; we'll just try again next tick.
            }
        }, 2000);
        return () => clearInterval(interval);
    });
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
        background: #111;
        overflow: hidden;
    }

    .empty-message {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #999;
        font-size: 1.2em;
    }
</style>
