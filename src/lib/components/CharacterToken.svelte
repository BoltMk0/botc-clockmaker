<script lang="ts">
    import type { Character } from "$lib/database/common/types";
    import TokenBackground from "./TokenBackground.svelte";

    export let character: Character;
    export let nightOrder: number|undefined = undefined;

    export let style: string = '';
    export let size: string = '200px';

    export let norules: boolean = false;

    let imageFailed = false;

    const curvedPathId = `curved-name-${Math.random().toString(36).slice(2, 10)}`;

    const categoryColors: Record<string, string> = {
        townsfolk: '#2563eb',
        outsider: '#16a34a',
        minion: '#dc2626',
        demon: '#7c3aed',
        traveler: '#ca8a04',
    };

    $: color = categoryColors[character.category] ?? '#666';
</script>


<div style="position: absolute; {style}">
    <div style="position:relative">
        
        <TokenBackground {size} style="border: calc({size} / 40) solid {color};">
        

        {#if norules}
            <div style="position: relative; width: 100%; height: 100%;">
                <div style="position: absolute; width: 70%; height: 70%; top: 45%; left: 50%; transform: translate(-50%, -50%);">
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

        {#if nightOrder !== undefined && nightOrder >= 0}
            <div class="night-order" style="font-size: calc({size} / 8); border-width: calc({size} / 80); position: absolute; top: 40%; left: 80%; transform: translate(-50%, -100%);">
                {nightOrder+1}
            </div>
        {/if}
        
        </TokenBackground>
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
</style>