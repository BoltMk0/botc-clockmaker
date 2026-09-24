<script lang="ts">
    import SkyBackdrop from '$lib/components/ClocktowerScene/SkyBackdrop.svelte';

    let { data }: { data: { hasRulesSlides: boolean } } = $props();

    const menuItems = $derived([
        { label: 'Play', href: '/play' },
        ...(data.hasRulesSlides ? [{ label: 'Rules', href: '/rules' }] : []),
        { label: 'Settings', href: '/settings' }
    ]);
</script>

<SkyBackdrop />

<div class="home-menu">
    <img class="home-icon" src="/icons/appicon_256x256.png" alt="" />
    <div class="home-title dumbledore-font">Clockmaker</div>
    <div class="home-version">v{__APP_VERSION__}</div>
    <div class="home-menu-buttons">
        {#each menuItems as item}
            <a class="button-style home-menu-button" href={item.href}>{item.label}</a>
        {/each}
    </div>
</div>

<style>
    .home-menu {
        position: relative; /* above the absolutely-positioned SkyBackdrop */
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2em;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }

    .home-icon {
        width: 128px;
        height: 128px;
        border-radius: 22%;
        box-shadow: 0 4px 12px #0008;
        margin-bottom: -1em;
    }

    .home-title {
        font-size: 2em;
        text-align: center;
        opacity: 0.9;
        text-shadow: 0 2px 4px #0008;
    }

    .home-version {
        font-size: small;
        opacity: 0.7;
        margin-top: -1.8em;
        text-shadow: 0 1px 3px #000a;
    }

    .home-menu-buttons {
        display: flex;
        flex-direction: column;
        gap: 1em;
        width: 100%;
        max-width: 320px;
    }

    .home-menu-button {
        font-size: x-large;
        padding: 0.7em 1em;
        /* Translucent over the SkyBackdrop */
        background-color: color-mix(in srgb, var(--theme-bg-tertiary) 55%, transparent);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        border: 1px solid #ffffff33;
    }

    .home-menu-button:hover {
        background-color: color-mix(in srgb, #666 70%, transparent);
    }
</style>
