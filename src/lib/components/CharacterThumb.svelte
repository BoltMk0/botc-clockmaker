<script lang="ts">
    import type { Character } from "$lib/database/common/types";

    export let character: Character;
    export let size: string = '2.5em';

    let imageFailed = false;

    const categoryColors: Record<string, string> = {
        townsfolk: '#2563eb',
        outsider: '#16a34a',
        minion: '#dc2626',
        demon: '#7c3aed',
        traveler: '#ca8a04',
    };

    $: color = categoryColors[character.category] ?? '#666';
    $: initials = character.name.split(' ').map(w => w[0]?.toUpperCase() ?? '').join('');
</script>

<div class="thumb" style="--thumb-size: {size}; --thumb-color: {color};">
    {#if !imageFailed}
        <img src={`/api/characters/${character.id}/img`} alt={character.name} on:error={() => imageFailed = true}/>
    {:else}
        <div class="fallback">{initials}</div>
    {/if}
</div>

<style>
    .thumb {
        width: var(--thumb-size);
        height: var(--thumb-size);
        flex-shrink: 0;
        border-radius: 50%;
        overflow: hidden;
        position: relative;
        border: 2px solid var(--thumb-color);
        background: #f3e9d2;
    }
    .thumb img {
        position: absolute;
        width: 150%;
        height: 150%;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        object-fit: cover;
    }
    .fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--thumb-color);
        font-weight: bold;
        font-size: calc(var(--thumb-size) * 0.4);
    }
</style>
