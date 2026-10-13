<script lang="ts">
    import type { MusicSource } from "./remoteMusic.svelte";

    /** A track's album art, or a placeholder note when it has none. */
    let { imageUrl, source, size }: { imageUrl: string | null; source: MusicSource | null; size: number } = $props();
</script>

<span class="art" style:width="{size}px" style:height="{size}px" style:border-radius="{Math.max(4, size / 10)}px">
    {#if imageUrl}
    <img src={imageUrl} alt=""/>
    {:else}
    <svg viewBox="0 0 24 24" fill="currentColor" style:width="{size / 2}px" style:height="{size / 2}px">
        <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/>
    </svg>
    {/if}
    {#if source === 'spotify'}
    <span class="badge" title="Spotify"></span>
    {/if}
</span>

<style>
    .art {
        position: relative;
        flex: none;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: hidden;
        background: linear-gradient(135deg, #3a3a44, #26262c);
        color: rgba(255, 255, 255, 0.4);
    }

    img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    /* Spotify's green, so it's clear which player is playing */
    .badge {
        position: absolute;
        right: 3px;
        bottom: 3px;
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #1db954;
        box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.6);
    }
</style>
