<script lang="ts">
    import { page } from '$app/state';
    import Navbar from '$lib/components/Navbar.svelte';

    const paths = [
        '/settings/resources',
        '/settings/scripts',
        '/settings/characters',
    ]

    const currentPath = $derived(page.url.pathname);
</script>


<Navbar/>

<div class="settings-layout-main">
    <div class="settings-layout-links in-a-column">
        <div style="font-size: x-large; opacity: 0.6;">Settings</div>
        {#each paths as path}
            <a class="button-style" class:highlight={currentPath === path} href={path}>{path.replace('/settings/', '')}</a>
        {/each}
    </div>
    <div class="settings-layout-content">
        <slot/>
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
}
</style>