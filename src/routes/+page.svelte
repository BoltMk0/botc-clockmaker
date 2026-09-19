<script lang="ts">
    import Navbar from '$lib/components/Navbar.svelte';

    const menuItems = [
        { label: 'Town Square', href: '/townsquare' },
        { label: 'Storytelling', href: '/admin/storytelling' },
        { label: 'Rules', href: '/rules' },
        { label: 'Settings', href: '/settings' }
    ];
</script>

<Navbar/>

<div class="home-menu">
    <img class="home-icon" src="/icons/appicon_256x256.png" alt="" />
    <div class="home-title dumbledore-font">Clockmaker</div>
    <div class="home-menu-buttons">
        {#each menuItems as item}
            <a class="button-style home-menu-button" href={item.href}>{item.label}</a>
        {/each}
    </div>
</div>

<style>
    .home-menu {
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
    }
</style>
