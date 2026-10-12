<script lang="ts">
    import { T } from "@threlte/core";
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
    // bigger) seats area rather than clustering conservatively inward, but
    // enough that a token's edge doesn't land flush on the area boundary.
    const EDGE_PADDING_FRACTION = 0.02;

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

    // Travellers are public roles, so their seats show the character; every other role stays hidden.
    function publicCharacter(characterId: string | null) {
        const character = characterId ? script?.characters.find(c => c.id === characterId) : null;
        return character?.category === 'traveler' ? character : null;
    }

    const seatTokens = $derived(filterSeatTokens(grimoireState, script));

    const layout = $derived(
        computeSeatsLayout(seatTokens, area.width, area.height, {
            minTokenSize: visibleHeight * MIN_TOKEN_SIZE_FRACTION,
            maxTokenSize: visibleHeight * MAX_TOKEN_SIZE_FRACTION,
            edgePadding: visibleHeight * EDGE_PADDING_FRACTION
        })
    );

    // DEBUG: visualise the `area` rect tokens are laid out within.
    const DEBUG_SHOW_AREA = false;
</script>

{#if DEBUG_SHOW_AREA}
    <T.Mesh position={[area.x, area.y, z - 0.01]}>
        <T.PlaneGeometry args={[area.width, area.height]} />
        <T.MeshBasicMaterial color="magenta" transparent opacity={0.25} depthWrite={false} />
    </T.Mesh>
{/if}

{#each layout.tokens as { token, x, y } (token.id)}
    <PlayerSeatToken
        playerName={token.playerName ?? ''}
        character={publicCharacter(token.characterId)}
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
