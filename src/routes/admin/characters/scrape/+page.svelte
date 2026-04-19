<script lang="ts">
    import type { Character } from "$lib/common/database/types";
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
    let statusMap = writable(new Map<number, JobStatus>(data.characters.map(c => [c.id, { character: c, status: 'pending' }])));

    const statusToColor: Record<string, string> = {
        'pending': 'gray',
        'exists': 'blue',
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

<div style="width: 600px;">
    <div>
        <progress value={$progress} max={data.characters.length} style="width: 100%;">Test</progress>
    </div>
    <button on:click={()=>{$running ? running.set(false) : scrapeAll()}} style="margin-top: 10px; width: 100%;">{$running ? 'Stop' : 'Scrape All'}</button>
    {#if $processing}
        {#if $progress === data.characters.length}
            <div>All characters processed ({$successCount} success, {$errorCount} error)</div>
        {:else}
        <div>Processing: {$processing.name} ({$progress}/{data.characters.length})</div>
        {/if}
    {/if}
</div>
