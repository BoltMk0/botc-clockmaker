<script lang="ts">
    import { page } from '$app/state';
    import { tick } from 'svelte';
    import TopNavbar from '$lib/components/TopNavbar.svelte';
    import type { NavNode, WikiPage } from '$lib/help/server/wiki';

    let { data }: { data: { page: WikiPage; nav: NavNode[] } } = $props();

    const currentPath = $derived(page.url.pathname.replace(/\/+$/, '') || '/help');

    /** Mobile only: whether the fullscreen navigation is showing. */
    let menuOpen = $state(false);

    /** Folders the reader has opened or closed by hand; otherwise a folder is open while it holds the current page. */
    let toggled = $state<Record<string, boolean>>({});

    function containsCurrent(node: NavNode): boolean {
        return node.href === currentPath || node.children.some(containsCurrent);
    }

    function isOpen(node: NavNode): boolean {
        return toggled[node.href + '|' + node.title] ?? containsCurrent(node);
    }

    function toggle(node: NavNode) {
        toggled[node.href + '|' + node.title] = !isOpen(node);
    }

    let contentEl: HTMLElement | null = $state(null);

    // New page: close the mobile menu and go to the top, or to the #anchor being linked to.
    $effect(() => {
        void data.page;
        menuOpen = false;
        const hash = page.url.hash;
        tick().then(() => {
            const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
            if (target) target.scrollIntoView();
            else contentEl?.scrollTo({ top: 0 });
        });
    });
</script>

<svelte:head>
    <title>{data.page.title} · Clockmaker Help</title>
</svelte:head>

{#snippet navTree(nodes: NavNode[], depth: number)}
    <ul class="wiki-nav-list" class:nested={depth > 0}>
        {#each nodes as node (node.href + '|' + node.title)}
            <li>
                <div class="wiki-nav-row" class:active={node.href === currentPath && !(depth === 0 && node.children.length && node.children[0].href === node.href)}>
                    {#if node.children.length}
                        <button class="wiki-nav-toggle" onclick={() => toggle(node)} aria-expanded={isOpen(node)} aria-label={(isOpen(node) ? 'Collapse ' : 'Expand ') + node.title}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" class:open={isOpen(node)}><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                        </button>
                    {:else}
                        <span class="wiki-nav-spacer"></span>
                    {/if}
                    <a href={node.href} aria-current={node.href === currentPath ? 'page' : undefined}>{node.title}</a>
                </div>
                {#if node.children.length && isOpen(node)}
                    {@render navTree(node.children, depth + 1)}
                {/if}
            </li>
        {/each}
    </ul>
{/snippet}

<TopNavbar>
    {#snippet mobileBrand()}
        <button class="wiki-menu-toggle" onclick={() => menuOpen = !menuOpen} aria-label={menuOpen ? 'Close help menu' : 'Open help menu'} aria-expanded={menuOpen}>
            {#if menuOpen}
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            {:else}
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            {/if}
        </button>
    {/snippet}
</TopNavbar>

<div class="wiki-layout">
    <nav class="wiki-nav" class:open={menuOpen} aria-label="Help pages">
        <div class="wiki-nav-heading">Help</div>
        {@render navTree(data.nav, 0)}
    </nav>
    <main class="wiki-content" bind:this={contentEl}>
        <article class="markdown">
            {@html data.page.html}
        </article>
    </main>
</div>

<style>
    .wiki-layout {
        display: grid;
        grid-template-columns: minmax(220px, 280px) 1fr;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding-top: 60px; /* clear the absolutely-positioned TopNavbar */
    }

    .wiki-nav {
        overflow-y: auto;
        border-right: 1px solid var(--border-color, #ffffff22);
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        padding: 1em 0.5em 2em;
        box-sizing: border-box;
    }

    .wiki-nav-heading {
        font-size: x-large;
        opacity: 0.6;
        padding: 0 0.5em 0.5em;
    }

    .wiki-nav-list {
        list-style: none;
        margin: 0;
        padding: 0;
    }

    .wiki-nav-list.nested {
        padding-left: 1em;
    }

    .wiki-nav-row {
        display: flex;
        align-items: center;
        border-radius: 0.4em;
    }

    .wiki-nav-row:hover {
        background-color: var(--theme-bg-tertiary);
    }

    .wiki-nav-row.active {
        background-color: var(--theme-highlight);
    }

    .wiki-nav-row.active a {
        color: var(--theme-on-highlight);
    }

    .wiki-nav-row a {
        flex: 1;
        padding: 0.4em 0.5em 0.4em 0.1em;
        color: var(--theme-on-bg);
        text-decoration: none;
        line-height: 1.3;
    }

    .wiki-nav-toggle, .wiki-nav-spacer {
        flex: none;
        width: 26px;
        height: 26px;
    }

    .wiki-nav-toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        border-radius: 0.3em;
    }

    .wiki-nav-toggle svg {
        transition: transform 0.15s;
    }

    .wiki-nav-toggle svg.open {
        transform: rotate(90deg);
    }

    .wiki-content {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        padding: 1.5em 2em 4em;
        box-sizing: border-box;
        background-color: var(--theme-app-bg);
        color: var(--theme-on-bg);
    }

    /* Rendered inside the TopNavbar (which only shows it on mobile), in place of the app icon */
    .wiki-menu-toggle {
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

    .wiki-menu-toggle:hover {
        background-color: var(--theme-bg-tertiary);
    }

    @media (max-width: 768px) {
        .wiki-layout {
            grid-template-columns: 1fr;
        }

        /* Sits just under the TopNavbar (z-index 1000) so the toggle stays reachable */
        .wiki-nav {
            display: none;
            position: fixed;
            inset: 0;
            z-index: 999;
            border-right: none;
            padding-top: 76px;
        }

        .wiki-nav.open {
            display: block;
        }

        .wiki-nav-row a {
            padding: 0.7em 0.5em 0.7em 0.1em;
            font-size: large;
        }

        .wiki-content {
            padding: 1em 1em 4em;
        }
    }

    /* The rendered Markdown */
    .markdown {
        max-width: 860px;
        margin: 0 auto;
        line-height: 1.6;
        user-select: text;
        -webkit-user-select: text;
        overflow-wrap: break-word;
    }

    .markdown :global(*) {
        user-select: text;
        -webkit-user-select: text;
    }

    .markdown :global(h1) {
        font-size: 2em;
        margin: 0.2em 0 0.6em;
        padding-bottom: 0.3em;
        border-bottom: 1px solid #ffffff22;
    }

    .markdown :global(h2) {
        font-size: 1.5em;
        margin: 1.6em 0 0.6em;
        padding-bottom: 0.25em;
        border-bottom: 1px solid #ffffff1a;
    }

    .markdown :global(h3) {
        font-size: 1.2em;
        margin: 1.4em 0 0.5em;
    }

    .markdown :global(:is(h1, h2, h3, h4, h5, h6)) {
        position: relative;
        scroll-margin-top: 1em;
        line-height: 1.3;
    }

    .markdown :global(.heading-anchor) {
        position: absolute;
        left: -1em;
        width: 1em;
        opacity: 0;
        text-decoration: none;
        color: var(--theme-on-bg-secondary);
    }

    .markdown :global(:is(h1, h2, h3, h4, h5, h6):hover .heading-anchor) {
        opacity: 0.6;
    }

    .markdown :global(a) {
        color: #6cb6ff;
    }

    .markdown :global(code) {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.9em;
        background-color: #ffffff14;
        padding: 0.15em 0.35em;
        border-radius: 0.3em;
    }

    .markdown :global(pre) {
        background-color: var(--theme-bg);
        border: 1px solid #ffffff1a;
        border-radius: 0.5em;
        padding: 0.9em 1em;
        overflow-x: auto;
        line-height: 1.45;
    }

    .markdown :global(pre code) {
        background: none;
        padding: 0;
        font-size: 0.85em;
    }

    .markdown :global(blockquote) {
        margin: 1em 0;
        padding: 0.5em 1em;
        border-left: 4px solid var(--theme-highlight);
        background-color: #ffffff0a;
        border-radius: 0 0.4em 0.4em 0;
    }

    .markdown :global(blockquote p) {
        margin: 0.3em 0;
    }

    .markdown :global(table) {
        display: block;
        max-width: 100%;
        overflow-x: auto;
        border-collapse: collapse;
        margin: 1em 0;
    }

    .markdown :global(th),
    .markdown :global(td) {
        border: 1px solid #ffffff22;
        padding: 0.45em 0.8em;
        text-align: left;
        vertical-align: top;
    }

    .markdown :global(th) {
        background-color: var(--theme-bg-secondary);
    }

    .markdown :global(tr:nth-child(even) td) {
        background-color: #ffffff06;
    }

    .markdown :global(img) {
        max-width: 100%;
        border-radius: 0.5em;
    }

    .markdown :global(hr) {
        border: none;
        border-top: 1px solid #ffffff22;
        margin: 2em 0;
    }

    .markdown :global(:is(ul, ol)) {
        padding-left: 1.6em;
    }

    .markdown :global(li + li) {
        margin-top: 0.2em;
    }
</style>
