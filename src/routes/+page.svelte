<script lang="ts">
    import { onMount } from 'svelte';
    import SkyBackdrop from '$lib/components/ClocktowerScene/SkyBackdrop.svelte';
    import ClockIcon from '$lib/components/ClocktowerScene/ClockIcon.svelte';
    import { realTimeDayProgress } from '$lib/components/ClocktowerScene/realTime';

    let { data }: { data: { hasRulesSlides: boolean } } = $props();

    // The real time of day drives both the sky and the clock icon's hands.
    let now = $state(new Date());
    onMount(() => {
        const interval = setInterval(() => now = new Date(), 1000);
        return () => clearInterval(interval);
    });

    const menuItems = $derived([
        { label: 'Play', href: '/play' },
        ...(data.hasRulesSlides ? [{ label: 'Rules', href: '/rules' }] : []),
        { label: 'Settings', href: '/settings' }
    ]);
</script>

<SkyBackdrop progress={realTimeDayProgress(now)} />

<div class="home-menu">
    <div class="home-icon">
        <ClockIcon {now} size={128} />
    </div>
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
        /* The dial's round and its canvas is transparent round it, so the shadow follows its outline. */
        filter: drop-shadow(0 2px 8px #0006);
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
