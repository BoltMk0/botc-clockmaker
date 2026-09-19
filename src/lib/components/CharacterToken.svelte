<script lang="ts">
    import type { Character } from "$lib/resources/common/gameData";
    import TokenBackground from "./TokenBackground.svelte";
    import DeadVoteIcon from "./DeadVoteIcon.svelte";

    let {
        character,
        nightOrder = undefined,
        style = '',
        size = '200px',
        norules = false,
        playerName = undefined,
        dead = false,
        hasDeadVote = false,
    }: {
        // Shows the dead-vote marker on a dead player's token.
        hasDeadVote?: boolean;
        character: Character;
        nightOrder?: number | undefined;
        style?: string;
        size?: string;
        norules?: boolean;
        // Name of the player holding this token, curved along the top inside edge (norules mode only).
        playerName?: string | undefined;
        // Draws the darkening shroud over a dead player's token (norules mode only).
        dead?: boolean;
    } = $props();

    let imageFailed = $state(false);

    const curvedPathId = `curved-name-${Math.random().toString(36).slice(2, 10)}`;
    const playerNamePathId = `player-name-${Math.random().toString(36).slice(2, 10)}`;

    const categoryColors: Record<string, string> = {
        townsfolk: '#2563eb',
        outsider: '#16a34a',
        minion: '#dc2626',
        demon: '#7c3aed',
        traveler: '#ca8a04',
    };

    const color = $derived(categoryColors[character.category] ?? '#666');
</script>


<div style="position: absolute; {style}">
    <div style="position:relative; width: {size}; height: {size};">
        
        <TokenBackground {size} style="border: calc({size} / 40) solid {color};">
        

        {#if norules}
            <div style="position: relative; width: 100%; height: 100%;">
                <div style="position: absolute; width: 62%; height: 62%; top: {playerName ? '50%' : '45%'}; left: 50%; transform: translate(-50%, -50%);">
                    {#if !imageFailed}
                        <img src={`/api/characters/${character.id}/img`} alt={character.name} class="category-icon-img" onerror={() => imageFailed = true} />
                    {:else}
                        <div class="category-icon-default dumbledore-font">{character.name.split(' ').map(word => word[0].toUpperCase()).join('')}</div>
                    {/if}
                </div>
                <svg class="curved-name" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                    <path id={curvedPathId} d="M 10 50 A 40 40 0 0 0 90 50" fill="none" stroke="none"/>
                    <text class="curved-name-text dumbledore-font" text-anchor="middle" font-size="12">
                        <textPath href="#{curvedPathId}" startOffset="50%">{character.name.toUpperCase()}</textPath>
                    </text>
                </svg>
                {#if playerName}
                    <!-- Mirror image of the character name: the letters' outer edge is at radius 40 (as the character name's baseline is),
                         so with ~8 units of capital height the baseline goes at 32. Layered above the shroud so it stays readable. -->
                    <svg class="curved-name player-name-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                        <path id={playerNamePathId} d="M 18 50 A 32 32 0 0 1 82 50" fill="none" stroke="none"/>
                        <text class="player-name-text dumbledore-font" text-anchor="middle" font-size="12">
                            <textPath href="#{playerNamePathId}" startOffset="50%">{playerName.toUpperCase()}</textPath>
                        </text>
                    </svg>
                {/if}
            </div>
        {:else}
        <div class="token-content" style="--token-size: {size}; --token-color: {color}; grid-template-rows: {norules ? '4fr 2fr' : '3fr 4fr'};">
            <div class="category-icon-container">
                {#if !imageFailed}
                    <img src={`/api/characters/${character.id}/img`} alt={character.name} class="category-icon-img" onerror={() => imageFailed = true} />
                {:else}
                    <div class="category-icon-default dumbledore-font">{character.name.split(' ').map(word => word[0].toUpperCase()).join('')}</div>
                {/if}
            </div>
            <div class="rules-text">
                <div class="token-name dumbledore-font">{character.name}</div>
                {#if !norules}    
                <div class="token-rules">{character.rules}</div>
                {/if}
            </div>
        </div>
        {/if}

        </TokenBackground>

        {#if dead && norules}
            <!-- Outside TokenBackground (which clips to its padding box) so the shroud covers the border too. -->
            <div class="dead-shroud"></div>
        {/if}

        {#if hasDeadVote}
            <DeadVoteIcon size="calc({size} / 2)" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2;" />
        {/if}

        {#if nightOrder !== undefined && nightOrder >= 0}
            <div class="night-order" style="font-size: calc({size} / 8); border-width: calc({size} / 80); position: absolute; top: 0; left: 85%; transform: translate(-50%, -30%);">
                {nightOrder+1}
            </div>
        {/if}

    </div>

</div>

<style>

    .night-order {
        border-radius: 50%;
        background-color: rgb(194, 120, 15);
        border: 1px solid white;
        box-shadow: 0 3px 4px #0008;
        color: white;
        text-shadow: 0 0 5px #0004;
        height: 1.5em;
        width: 1.5em;
        z-index: 1;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .token-content {
        display: grid;
        color: black;
        text-align: center;
        height: var(--token-size);
    }

    .category-icon-container {
        height: 100%;
        width: auto;
        margin: auto;
        aspect-ratio: 1/1;
        border-radius: 50%;
        box-sizing: border-box;
        overflow: hidden;
        position: relative;
    }

    .category-icon-img {
        position: absolute;
        width: 150%;
        height: 150%;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        object-fit: cover;
        border-radius: 50%;
    }

    .category-icon-default {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        /* background-color: var(--token-color); */
        display: flex;
        align-items: center;
        justify-content: center;
        /* color: white; */
        color: var(--token-color);
        font-size: x-large;
    }

    .token-name {
        font-size: calc(var(--token-size) / 8);
        font-weight: bold;
        line-height: 1.2;
        margin-bottom: calc(var(--token-size) * 0.02);
    }

    .token-rules {
        font-size: calc(var(--token-size) / 14);
        line-height: 1.2;
        opacity: 0.65;
    }

    .curved-name {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        overflow: visible;
    }
    .curved-name-text {
        fill: black;
        font-weight: bold;
        letter-spacing: 0.5px;
    }
    /* Same as .curved-name-text, except the letter spacing: this text's letters point outward from a radius-32
       baseline, so the same baseline spacing would fan out ~25% wider than the character name's. -1px gives
       the same angle between letters (measured against the real font). */
    .player-name-text {
        fill: black;
        font-weight: bold;
        letter-spacing: -1px;
    }

    /* Above the shroud (a later sibling) so the player's name stays readable. */
    .player-name-svg {
        z-index: 1;
    }

    .dead-shroud {
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 50%;
        background:
            radial-gradient(ellipse at 50% 30%, rgba(10, 10, 15, 0.75) 35%, rgba(10, 10, 15, 0.25) 70%, rgba(10, 10, 15, 0) 100%);
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.85);
    }
</style>