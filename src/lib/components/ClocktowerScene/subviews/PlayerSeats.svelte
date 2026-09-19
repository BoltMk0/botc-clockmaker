<script lang="ts">
    import PlayerSeatToken from "./PlayerSeatToken.svelte";
    import { computeSeatsLayout, filterSeatTokens } from "$lib/components/playerSeatsLayout";
    import { hasDeadVote, type GrimoireStateHistory } from "$lib/resources/common/grimoireState";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData";

    // Lays out the game's seated players' tokens within `area` (a world-unit
    // rect - see GameStatsPanel.svelte's `seatsArea`), reusing the same
    // condense-then-scale-out layout the storyteller's DOM players view
    // (PlayerSeatsView.svelte) uses, just parameterised in world units
    // instead of CSS pixels.
    const MIN_TOKEN_SIZE_FRACTION = 0.12; // fraction of visibleHeight
    const MAX_TOKEN_SIZE_FRACTION = 0.19;
    // Small, so tokens spread out closer to the edges of the (now much
    // bigger) seats area rather than clustering conservatively inward.
    const EDGE_PADDING_FRACTION = 0;

    let {
        area,
        grimoireState,
        script,
        visibleHeight,
        z = 0.2
    }: {
        area: { x: number; y: number; width: number; height: number };
        grimoireState: GrimoireStateHistory | null;
        script: ScriptWithCharacters | null;
        visibleHeight: number;
        z?: number;
    } = $props();

    const seatTokens = $derived(filterSeatTokens(grimoireState, script));

    const layout = $derived(
        computeSeatsLayout(seatTokens, area.width, area.height, {
            minTokenSize: visibleHeight * MIN_TOKEN_SIZE_FRACTION,
            maxTokenSize: visibleHeight * MAX_TOKEN_SIZE_FRACTION,
            edgePadding: visibleHeight * EDGE_PADDING_FRACTION
        })
    );
</script>

{#each layout.tokens as { token, x, y } (token.id)}
    <PlayerSeatToken
        playerName={token.playerName ?? ''}
        isDead={token.isDead}
        hasDeadVote={hasDeadVote(token)}
        placement={{
            // The layout's x/y are CSS-style offsets from centre (+y = down);
            // this scene's world Y grows up, so the vertical offset flips.
            x: area.x + x,
            y: area.y - y,
            width: layout.tokenSize
        }}
        {z}
    />
{/each}
