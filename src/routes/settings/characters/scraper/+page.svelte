<script lang="ts">
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";
    import type { Character, CharacterCategory } from "$lib/resources/common/gameData";
    import { ALL_CHARACTER_CATEGORIES } from "$lib/resources/common/gameData";
    import { slugify } from "$lib/resources/common/util";
    import type { CharacterScrapeResult, WikiCharacterListing } from "$lib/scraper/common/types";
    import { writable } from "svelte/store";

    let { data }: {
        data: {
            listingsByCategory: Record<CharacterCategory, WikiCharacterListing[]>
        }
    } = $props();

    type JobStatus = {
        status: 'pending' | 'created' | 'updated' | 'error';
        error?: string;
        iconStatus?: 'exists' | 'scraped' | 'not_found' | 'error';
        iconError?: string;
    };

    const allListings = ALL_CHARACTER_CATEGORIES.flatMap(
        category => data.listingsByCategory[category].map(listing => ({ category, listing }))
    );

    function thumbCharacter(category: CharacterCategory, name: string): Character {
        return { id: slugify(name), name, category, rules: '', player_count: 1, wakes_first_night: false, wakes_other_nights: false, defaultFirstNightOrder: null, defaultOtherNightOrder: null, reminderTokens: [] };
    }

    let progress = writable(0);
    let jobsByName = writable(new Map<string, JobStatus>());
    let running = writable(false);
    let currentName = writable<string | null>(null);
    let openCategories = writable(new Set<CharacterCategory>(ALL_CHARACTER_CATEGORIES));

    function toggleCategory(category: CharacterCategory) {
        openCategories.update(set => {
            const next = new Set(set);
            next.has(category) ? next.delete(category) : next.add(category);
            return next;
        });
    }

    const dataLabel: Record<JobStatus['status'], string> = {
        pending: 'Pending',
        created: 'Created',
        updated: 'Updated',
        error: 'Error'
    };

    const iconLabel: Record<NonNullable<JobStatus['iconStatus']>, string> = {
        exists: 'Exists',
        scraped: 'Scraped',
        not_found: 'Not found',
        error: 'Error'
    };

    async function scrapeAll() {
        running.set(true);
        progress.set(0);
        jobsByName.set(new Map());

        for (const { category, listing } of allListings) {
            if (!$running) break;
            currentName.set(listing.name);
            await fetch('/api/characters/scrape-wiki', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, name: listing.name, wikiPath: listing.wikiPath })
            }).then(async response => {
                const result = await response.json() as CharacterScrapeResult;
                jobsByName.update(m => new Map(m).set(listing.name, result));
            }).catch(er => {
                jobsByName.update(m => new Map(m).set(listing.name, { status: 'error', error: er.message }));
            });
            progress.update(p => p + 1);
        }

        running.set(false);
        currentName.set(null);
    }

    const successCount = $derived([...$jobsByName.values()].filter(j => j.status !== 'error').length);
    const errorCount = $derived([...$jobsByName.values()].filter(j => j.status === 'error').length);
</script>

<div class="scraper-page">
    <div class="scraper-toolbar">
        <div class="toolbar-heading">
            <h2>Character Wiki Scraper</h2>
            <p>Pulls townsfolk, outsiders, minions, demons, travellers, loric and fabled - name, ability text and token icon - from the <a href="https://wiki.bloodontheclocktower.com/Main_Page" target="_blank" rel="noreferrer">Blood on the Clocktower wiki</a>.</p>
        </div>
        <div class="toolbar-actions">
            <button class="button-style primary" onclick={() => ($running ? running.set(false) : scrapeAll())}>
                {$running ? 'Stop' : 'Scrape All'}
            </button>
            <progress value={$progress} max={allListings.length}></progress>
            <div class="toolbar-status">
                {#if $running}
                    Scraping {$currentName}&hellip; ({$progress}/{allListings.length})
                {:else if $progress > 0}
                    Done - {successCount} succeeded, {errorCount} failed
                {:else}
                    {allListings.length} characters found across {ALL_CHARACTER_CATEGORIES.length} categories
                {/if}
            </div>
        </div>
    </div>

    <div class="scraper-body">
        {#each ALL_CHARACTER_CATEGORIES as category}
            {@const listings = data.listingsByCategory[category]}
            <div class="category-group">
                <button class="category-header no-button-style" onclick={() => toggleCategory(category)}>
                    <span class="chevron" class:open={$openCategories.has(category)}>&rsaquo;</span>
                    <span class="category-name">{category}</span>
                    <span class="category-count">{listings.length}</span>
                </button>
                {#if $openCategories.has(category)}
                    <div class="character-grid">
                        {#each listings as listing (listing.name)}
                            {@const job = $jobsByName.get(listing.name)}
                            <div class="character-card" class:active={$currentName === listing.name}>
                                <CharacterThumb character={thumbCharacter(category, listing.name)} size="2.8em"/>
                                <div class="character-info">
                                    <div class="character-name">{listing.name}</div>
                                    <div class="status-pills">
                                        <span class="pill" data-state={job ? job.status : (listing.exists ? 'created' : 'pending')}>
                                            {job ? dataLabel[job.status] : (listing.exists ? 'Saved' : 'Not scraped')}
                                        </span>
                                        <span class="pill" data-state={job?.iconStatus ?? (listing.iconExists ? 'exists' : 'pending')}>
                                            {job?.iconStatus ? iconLabel[job.iconStatus] : (listing.iconExists ? 'Icon saved' : 'No icon')}
                                        </span>
                                    </div>
                                    {#if job?.error || job?.iconError}
                                        <div class="error-text">{job.error ?? job.iconError}</div>
                                    {/if}
                                </div>
                            </div>
                        {/each}
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

    .toolbar-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5em;
        min-width: 260px;
    }
    .toolbar-actions progress {
        width: 100%;
    }
    .toolbar-status {
        font-size: 0.85em;
        opacity: 0.8;
        text-align: right;
    }
    .button-style.primary {
        min-width: 140px;
    }

    .scraper-body {
        overflow-y: auto;
        padding: 1em 2em 2em 2em;
    }

    .category-group {
        margin-bottom: 0.5em;
    }
    .category-header {
        display: flex;
        align-items: center;
        gap: 0.6em;
        width: 100%;
        padding: 0.6em 0;
        text-align: left;
        font-size: 1.1em;
        text-transform: capitalize;
        cursor: pointer;
    }
    .chevron {
        display: inline-block;
        transition: transform 0.15s ease;
        font-size: 1.3em;
        line-height: 1;
    }
    .chevron.open {
        transform: rotate(90deg);
    }
    .category-count {
        opacity: 0.6;
        font-size: 0.8em;
        font-weight: normal;
    }

    .character-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.6em;
        padding-bottom: 1em;
    }

    .character-card {
        display: flex;
        align-items: center;
        gap: 0.8em;
        padding: 0.6em 0.8em;
        border-radius: 8px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid transparent;
        transition: border-color 0.15s ease;
    }
    .character-card.active {
        border-color: currentColor;
        opacity: 0.9;
    }

    .character-info {
        min-width: 0;
        flex: 1;
    }
    .character-name {
        font-weight: 600;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .status-pills {
        display: flex;
        gap: 0.4em;
        margin-top: 0.3em;
        flex-wrap: wrap;
    }
    .pill {
        font-size: 0.7em;
        padding: 0.15em 0.55em;
        border-radius: 999px;
        background: #8884;
        white-space: nowrap;
    }
    .pill[data-state="created"], .pill[data-state="updated"], .pill[data-state="exists"], .pill[data-state="scraped"] {
        background: #16a34a33;
        color: #16a34a;
    }
    .pill[data-state="error"] {
        background: #dc262633;
        color: #dc2626;
    }
    .pill[data-state="not_found"] {
        background: #ca8a0433;
        color: #ca8a04;
    }
    .pill[data-state="pending"] {
        background: #8884;
        opacity: 0.7;
    }
    .error-text {
        font-size: 0.75em;
        color: #dc2626;
        margin-top: 0.2em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
