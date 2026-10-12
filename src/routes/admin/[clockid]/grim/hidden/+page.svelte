<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
</script>

<!-- Stands in for the grim while the device is left lying around, so nobody can glance at it. -->
<div class="hidden-view">
    <p class="dumbledore-font">Grimoire Hidden</p>
    <button class="button-style unhide-btn" onclick={() => goto(`/admin/${page.params.clockid}/grim`, { replaceState: true })}>Unhide</button>
</div>

<style>
    /* Black, with everything faint: unremarkable to anyone glancing at it. Covers the whole screen (fixed), so the
       layout's own background doesn't show around it. */
    .hidden-view {
        position: fixed;
        inset: 0;
        background: #000;
        box-sizing: border-box;
        padding: 2em 1em;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5em;
        text-align: center;
    }

    /* On the contents rather than the view, which would let the page behind show through the black */
    p, .unhide-btn {
        opacity: 0.35;
    }

    p {
        margin: 0;
        font-size: 3em;
    }

    .unhide-btn {
        font-size: 1.3em;
        padding: 0.5em 1.5em;
    }
</style>
