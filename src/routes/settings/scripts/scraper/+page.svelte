<script lang="ts">
    import type { ScriptScrapeResult } from "$lib/scraper/common/types";
    import { writable } from "svelte/store";

    let { data }: {
        data: {
            scripts: {
                entry: { name: string; wikiPath: string; hue: string };
                alreadySaved: boolean;
                roster: { name: string; exists: boolean }[];
            }[]
        }
    } = $props();

    let jobsByName = writable(new Map<string, ScriptScrapeResult>());
    let running = writable(false);
    let currentName = writable<string | null>(null);

    async function scrapeOne(name: string) {
        currentName.set(name);
        await fetch('/api/scripts/scrape-wiki', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        }).then(async response => {
            const result = await response.json() as ScriptScrapeResult;
            jobsByName.update(m => new Map(m).set(name, result));
        }).catch(er => {
            jobsByName.update(m => new Map(m).set(name, { status: 'error', error: er.message }));
        });
        currentName.set(null);
    }

    async function scrapeAll() {
        running.set(true);
        jobsByName.set(new Map());
        for (const { entry } of data.scripts) {
            if (!$running) break;
            await scrapeOne(entry.name);
        }
        running.set(false);
    }
</script>

<div class="scraper-page">
    <div class="scraper-toolbar">
        <div class="toolbar-heading">
            <h2>Script Wiki Scraper</h2>
            <p>Creates the three base scripts - Trouble Brewing, Bad Moon Rising, and Sects &amp; Violets - and fills in their character rosters from the <a href="https://wiki.bloodontheclocktower.com/Main_Page" target="_blank" rel="noreferrer">wiki</a>.</p>
        </div>
        <button class="button-style primary" onclick={() => ($running ? running.set(false) : scrapeAll())}>
            {$running ? 'Stop' : 'Scrape All'}
        </button>
    </div>

    <div class="scraper-body">
        {#each data.scripts as { entry, alreadySaved, roster } (entry.name)}
            {@const job = $jobsByName.get(entry.name)}
            {@const missing = job?.missingCharacters ?? roster.filter(r => !r.exists).map(r => r.name)}
            {@const found = roster.length - missing.length}
            <div class="script-card" style="--script-hue: {entry.hue};" class:active={$currentName === entry.name}>
                <div class="script-card-header">
                    <div class="script-swatch"></div>
                    <div class="script-title">
                        <div class="script-name">{entry.name}</div>
                        <div class="script-subtitle">{found}/{roster.length} characters available</div>
                    </div>
                    <span class="pill" data-state={job ? job.status : (alreadySaved ? 'created' : 'pending')}>
                        {job ? (job.status === 'created' ? 'Created' : job.status === 'updated' ? 'Updated' : 'Error') : (alreadySaved ? 'Saved' : 'Not scraped')}
                    </span>
                    <button class="button-style" disabled={$running} onclick={() => scrapeOne(entry.name)}>
                        {alreadySaved || job ? 'Re-scrape' : 'Scrape'}
                    </button>
                </div>

                {#if job?.error}
                    <div class="error-banner">{job.error}</div>
                {:else if missing.length > 0}
                    <div class="warning-banner">
                        <div>
                            Missing {missing.length} character{missing.length === 1 ? '' : 's'}: {missing.join(', ')}.
                        </div>
                        <div>
                            Go to the <a href="/settings/characters/scraper">character scraper</a> to fetch them from the wiki,
                            or add them manually on the <a href="/settings/characters">characters page</a>, then re-scrape this script.
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<style>
    .scraper-page {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100%;
        width: 100%;
        overflow: hidden;
        background-color: var(--theme-bg);
    }

    .scraper-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 1.5em;
        padding: 1.5em 2em;
        border-bottom: 1px solid var(--border-color);
    }
    .toolbar-heading h2 {
        margin: 0 0 0.25em 0;
    }
    .toolbar-heading p {
        margin: 0;
        max-width: 46em;
        opacity: 0.75;
        font-size: 0.9em;
    }
    .toolbar-heading a {
        color: inherit;
    }
    .button-style.primary {
        min-width: 140px;
    }

    .scraper-body {
        overflow-y: auto;
        padding: 1.5em 2em 2em 2em;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .script-card {
        border-radius: 10px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid transparent;
        border-left: 4px solid var(--script-hue);
        overflow: hidden;
        transition: border-color 0.15s ease;
    }
    .script-card.active {
        border-color: var(--script-hue);
    }

    .script-card-header {
        display: flex;
        align-items: center;
        gap: 1em;
        padding: 1em 1.2em;
    }
    .script-swatch {
        width: 1.2em;
        height: 1.2em;
        border-radius: 50%;
        background: var(--script-hue);
        flex-shrink: 0;
    }
    .script-title {
        flex: 1;
        min-width: 0;
    }
    .script-name {
        font-weight: 600;
        font-size: 1.05em;
    }
    .script-subtitle {
        font-size: 0.8em;
        opacity: 0.7;
    }

    .pill {
        font-size: 0.75em;
        padding: 0.2em 0.7em;
        border-radius: 999px;
        background: #8884;
        white-space: nowrap;
    }
    .pill[data-state="created"], .pill[data-state="updated"] {
        background: #16a34a33;
        color: #16a34a;
    }
    .pill[data-state="error"] {
        background: #dc262633;
        color: #dc2626;
    }
    .pill[data-state="pending"] {
        background: #8884;
        opacity: 0.7;
    }

    .warning-banner, .error-banner {
        padding: 0.8em 1.2em;
        font-size: 0.85em;
        border-top: 1px solid var(--border-color);
    }
    .warning-banner {
        background: #ca8a0422;
        color: #a86a00;
    }
    .warning-banner a {
        color: inherit;
        font-weight: 600;
    }
    .error-banner {
        background: #dc262622;
        color: #dc2626;
    }
</style>
