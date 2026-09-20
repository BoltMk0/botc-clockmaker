<script lang="ts">
    import { page } from "$app/state";

    const path = $derived(page.url.pathname);
    const links = [
        { label: "Home", href: "/" },
        { label: "Play", href: "/play" },
        { label: "Settings", href: "/settings" }
    ];

    /** Optional ?back_uri=/some/path: shows a back button instead of the navbar. Same-site paths only. */
    const backUri = $derived.by(() => {
        const uri = page.url.searchParams.get("back_uri");
        return uri && uri.startsWith("/") && !uri.startsWith("//") && !uri.startsWith("/\\") ? uri : null;
    });

    function isActive(href: string) {
        return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
    }
</script>

{#if backUri}
<a class="back-button" href={backUri} title="Back">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
    Back
</a>
{:else}
<nav class="top-navbar">
    <a class="brand" href="/" aria-label="Home">
        <img src="/icons/appicon_128x128.png" alt="" />
    </a>
    {#each links as link}
        <a class="nav-link" class:active={isActive(link.href)} href={link.href}>{link.label}</a>
    {/each}
</nav>
{/if}

<style>
    .top-navbar {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 60px;
        box-sizing: border-box;
        padding: 0 16px;
        display: flex;
        align-items: center;
        gap: 8px;
        background-color: var(--theme-bg-secondary);
        box-shadow: 0 2px 6px #0006;
        z-index: 1000;
    }

    .back-button {
        position: absolute;
        top: 10px;
        left: 10px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0.4em 0.9em 0.4em 0.7em;
        color: var(--theme-on-bg);
        background-color: var(--theme-bg-secondary);
        border-radius: 0.4em;
        box-shadow: 0 2px 6px #0006;
        text-decoration: none;
        font-size: large;
        z-index: 1000;
    }

    .back-button:hover {
        background-color: var(--theme-bg-tertiary);
    }

    .brand {
        display: flex;
        margin-right: 8px;
    }

    .brand img {
        width: 40px;
        height: 40px;
        border-radius: 22%;
    }

    .nav-link {
        color: var(--theme-on-bg);
        text-decoration: none;
        opacity: 0.75;
        font-size: large;
        padding: 0.4em 0.9em;
        border-radius: 0.4em;
    }

    .nav-link:hover {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
    }

    .nav-link.active {
        opacity: 1;
        background-color: var(--theme-bg-tertiary);
    }
</style>
