<script lang="ts">
    import { page } from '$app/state';
    import TopNavbar from '$lib/components/TopNavbar.svelte';

    const paths = [
        '/settings/resources',
        '/settings/scripts',
        '/settings/characters',
        '/settings/clocks',
        '/settings/timerOptions',
        '/settings/customMessages',
        '/settings/qrCodes',
        '/settings/audio',
        '/settings/feedback',
        '/settings/password'
    ]

    const currentPath = $derived(page.url.pathname);

    let {
        children
    } = $props();

    /** Mobile only: whether the fullscreen settings menu is showing. */
    let menuOpen = $state(false);

    // Close the menu after navigating, but open it on the (empty) settings root so there's something to pick from.
    $effect(() => {
        menuOpen = currentPath === '/settings';
    });

</script>


<TopNavbar>
    {#snippet mobileBrand()}
        <button class="settings-menu-toggle" onclick={() => menuOpen = !menuOpen} aria-label={menuOpen ? 'Close settings menu' : 'Open settings menu'} aria-expanded={menuOpen}>
            {#if menuOpen}
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            {:else}
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            {/if}
        </button>
    {/snippet}
</TopNavbar>

<div class="settings-layout-main">
    <div class="settings-layout-links in-a-column" class:open={menuOpen}>
        <div style="font-size: x-large; opacity: 0.6;">Settings</div>
        {#each paths as path}
            {@const label = path === '/settings/clocks' ? 'games' : path === '/settings/customMessages' ? 'Grim Messages' : path.replace('/settings/', '')}
            <a class="button-style" class:highlight={currentPath === path} href={path} onclick={() => menuOpen = false}>{label.charAt(0).toUpperCase() + label.slice(1)}</a>
        {/each}
    </div>
    <div class="settings-layout-content">
        {@render children()}
    </div>
</div>


<style>
.settings-layout-main {
    display: grid;
    grid-template-columns: auto 1fr;
    height: 100%;
    width: 100%;
}
.settings-layout-links {
    border-right: 1px solid var(--border-color);
    background-color: var(--theme-bg-secondary);
    color: var(--theme-on-bg-secondary);
    padding: 1em;
    padding-top: 90px;
    gap: 2px;
    min-width: 150px;
}

.settings-layout-links a {
    width: 100%;
    border-radius: 0;
    text-align: left;
    padding-right: 2em;
}
.settings-layout-content {
    height: 100%;
    overflow: hidden;
    box-sizing: border-box;
    padding-top: 60px; /* clear the absolutely-positioned TopNavbar */
}

/* Rendered inside the TopNavbar (which only shows it on mobile), in place of the app icon */
.settings-menu-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: 0.4em;
    background: transparent;
    color: var(--theme-on-bg);
    cursor: pointer;
}

.settings-menu-toggle:hover {
    background-color: var(--theme-bg-tertiary);
}

@media (max-width: 768px) {
    .settings-layout-main {
        grid-template-columns: 1fr;
    }

    /* Sits just under the TopNavbar (z-index 1000) so the toggle stays reachable */
    .settings-layout-links {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 999;
        border-right: none;
        box-sizing: border-box;
        overflow-y: auto;
        padding-top: 76px;
    }

    .settings-layout-links.open {
        display: flex;
    }

    .settings-layout-links a {
        padding: 0.8em 1em;
        font-size: large;
    }
}
</style>
