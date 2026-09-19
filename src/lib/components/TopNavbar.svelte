<script lang="ts">
    import { page } from "$app/state";

    const path = $derived(page.url.pathname);
    const links = [
        { label: "Home", href: "/" },
        { label: "Play", href: "/play" }
    ];

    function isActive(href: string) {
        return href === "/" ? path === "/" : path === href || path.startsWith(href + "/");
    }
</script>

<nav class="top-navbar">
    <a class="brand" href="/" aria-label="Home">
        <img src="/icons/appicon_128x128.png" alt="" />
    </a>
    {#each links as link}
        <a class="nav-link" class:active={isActive(link.href)} href={link.href}>{link.label}</a>
    {/each}
</nav>

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
