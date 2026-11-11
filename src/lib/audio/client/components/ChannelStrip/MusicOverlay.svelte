<script lang="ts">
    import { onMount } from "svelte";
    import { AudioDim } from "$lib/audio/client/AudioDim.svelte";
    import MusicView from "$lib/components/remote/MusicView.svelte";
    import type { RemoteMusic } from "$lib/components/remote/remoteMusic.svelte";

    /**
     * The remote's music view over the mixer, opened from a music strip's now playing panel: the same view as on the
     * clock remote, set the way it is there, with its back button closing it instead.
     */
    let { music, onclose }: { music: RemoteMusic; onclose: () => void } = $props();

    // The shared dim, for the view's DIM button (the engine's own is internal, and absent on a silent mixer)
    let audioDim = $state<AudioDim | null>(null);
    onMount(() => {
        const dim = audioDim = new AudioDim();
        return () => dim.close();
    });

    /** Moves the element to the end of <body>, so the mixer's scrolling and stacking can't clip or cover it. */
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy() { node.remove(); } };
    }

    function onkeydown(ev: KeyboardEvent) {
        // The view's own sheets (presets, up next) close first: they sit over this, on the backdrop's click
        if (ev.key === 'Escape' && !document.querySelector('.sheet-backdrop')) onclose();
    }
</script>

<svelte:window {onkeydown}/>

<!-- Tapping the dimmed backdrop around the panel closes it -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="music-overlay" use:portal onclick={onclose} role="presentation">
    <!-- Clicks inside (the view's own sheets too, which sit in it) stay in it -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="music-overlay-panel" onclick={(ev) => ev.stopPropagation()} role="dialog" aria-modal="true" aria-label="Music" tabindex="-1">
        <MusicView {music} {audioDim} onback={onclose} backLabel="Close"/>
    </div>
</div>

<style>
    /* Translucent black over the mixer, with the panel in the middle */
    .music-overlay {
        position: fixed;
        inset: 0;
        z-index: 900; /* Under the view's own sheets (1000) */
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 16px;
        box-sizing: border-box;
        background: rgba(0, 0, 0, 0.6);
        animation: fade-in 0.15s ease-out;
    }

    /* Just big enough for the controls, with the remote page's background, padding and larger type. (No transform
       on it: the view's sheets are position: fixed inside, and would be laid out against it instead of the screen.) */
    .music-overlay-panel {
        max-height: 100%;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 12px 16px 20px;
        box-sizing: border-box;
        border-radius: 16px;
        background: var(--theme-bg);
        color: var(--theme-on-bg);
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        font-size: large;
    }

    /* The view's own width allows for the page's padding alone; here the backdrop's and the panel's take more on a phone */
    .music-overlay-panel :global(.music-view) {
        width: min(360px, calc(100vw - 64px));
    }

    @keyframes fade-in {
        from { opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
        .music-overlay { animation: none; }
    }
</style>
