<script lang="ts">
    import { goto } from "$app/navigation";

    // Opens the chalkboard from something being shown to a player; its close button comes back to returnTo.
    let { clockid, returnTo }: { clockid: string; returnTo: string } = $props();

    function open(e: MouseEvent) {
        e.stopPropagation();
        goto(`/admin/${clockid}/grim/chalkboard?${new URLSearchParams({ return: returnTo })}`);
    }
</script>

<button class="chalkboard-btn" onclick={open} title="Chalkboard">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"/></svg>
    Chalkboard
</button>

<style>
    /* Top left, opposite the close button */
    .chalkboard-btn {
        position: absolute;
        top: 12px;
        left: 12px;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 0.4em;
        padding: 0.45em 0.9em 0.45em 0.7em;
        border: none;
        border-radius: 999px;
        /* Dark with a faint ring, to show on the message page's near black and the bluffs page's theme */
        background: rgba(0, 0, 0, 0.6);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25);
        color: white;
        font-size: 1em;
        cursor: pointer;
        touch-action: manipulation;
    }

    .chalkboard-btn svg {
        width: 1.2em;
        height: 1.2em;
        fill: currentColor;
    }
</style>
