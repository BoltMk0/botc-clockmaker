<script lang="ts">
    import type { Character } from "$lib/database/common/types";
    import type { ScrapeResult } from "$lib/scraper/common/types";
    import { writable } from "svelte/store";

    let {data}: {
        data: {
            characters: Character[]
        }
    } = $props();



    type JobStatus = {
        character: Character;
        status: 'pending' | 'exists' | 'not_found' | 'scraped' | 'error';
        error?: string;
    }

    let progress = writable(0);
    let statusMap = writable(new Map<number, JobStatus>());

    const statusToColor: Record<string, string> = {
        'pending': 'gray',
        'exists': 'green',
        'not_found': 'orange',
        'scraped': 'green',
        'error': 'red'
    };

    let running = writable(false);
    let processing = writable<Character|null>(null);

    let successCount = writable(0);
    let errorCount = writable(0);

    async function scrapeAll(){
        running.set(true);
        progress.set(0);
        successCount.set(0);
        errorCount.set(0);
        for(const character of data.characters){
            if(!$running) break;
            processing.set(character);
            await fetch(`/api/characters/${character.id}/img/scrape`, { method: 'POST' }).then(async response => {
                try {
                    const status = await response.json() as ScrapeResult;
                    statusMap.update(m => {
                        m.set(character.id, { character, status: status.status, error: status.error } as JobStatus);
                        return m;
                    });
                    if (status.status === 'scraped' || status.status === 'exists') {
                        successCount.update(c => c + 1);
                    } else {
                        console.log(`Failed to scrape character ${character.name}: ${status}`, status);
                        errorCount.update(c => c + 1);
                    }
                } catch (er) { 
                    throw new Error(`Failed to parse response for character ${character.name}: ${er}`);
                }
            }).catch(er => {
                errorCount.update(c => c + 1);
                statusMap.update(m => {
                    m.set(character.id, { character, status: 'error', error: er.message } as JobStatus);
                    return m;
                });
            });
            progress.update(p => p + 1);
        }
        running.set(false);
    }

</script>


<div style="width: 100%; height: 100%; padding: 2em; box-sizing: border-box;">
    
<div class="scraper-main">
    <div>
        <div>
            <progress value={$progress} max={data.characters.length} style="width: 100%;">Test</progress>
        </div>
        <button onclick={()=>{$running ? running.set(false) : scrapeAll()}} style="margin-top: 10px; width: 100%;">{$running ? 'Stop' : 'Scrape All'}</button>
        {#if $processing}
        {#if $progress === data.characters.length}
        <div>All characters processed ({$successCount} success, {$errorCount} error)</div>
        {:else}
        <div>Processing: {$processing.name} ({$progress}/{data.characters.length})</div>
        {/if}
        {/if}
    </div>
   
    <div class="completed-jobs-display">
        <table style="width: fit-content; margin: auto;">
            <tbody>
                {#each Array.from($statusMap.values()) as jobStatus}
                    <tr>
                        <td>{jobStatus.character.name}</td>
                        <td style="color: {statusToColor[jobStatus.status]}">{jobStatus.status}</td>
                        <td>{jobStatus.error}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>

</div>


<style>
    .completed-jobs-display {
        height: 100%;
        overflow-y: auto;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        box-sizing: border-box;
        padding: 1em;
    }

    .scraper-main {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 1em;
        height: 100%;
        width: 100%;
        overflow: hidden;
        background-color: var(--theme-bg);
        /* box-sizing: border-box; */
    }
</style>