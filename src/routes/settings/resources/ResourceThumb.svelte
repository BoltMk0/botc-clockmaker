<script lang="ts">
    import type { Resource } from "$lib/resources/common/types";
    import CustomOverlay from "$lib/components/CustomOverlay.svelte";
    import TokenBackground from "$lib/components/TokenBackground.svelte";
    import type { GrimoireStateHistory } from "../games/[id]/grimoire/types";
    import { prettifyResourceName } from "$lib/resources/common/util";

    export let data: Resource;
    export let onDelete: (id: string) => void;
</script>

<style>
    .resource-thumb {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .resource-thumb-header {
        font-weight: bold;
        font-size: 1.2em;
        display: grid;
        grid-template-columns: 1fr auto;
    }

    .resource-thumb-footer {
        display: flex;
        justify-content: space-between;
        font-size: 0.9em;
        color: var(--theme-on-bg-secondary);
    }
</style>

<div class="resource-thumb">
    <div class="resource-thumb-header in-a-row">
        <div>
            <span>{prettifyResourceName(data.name)}</span>
            <!-- <div class="resource-tag">{data.type}</div> -->
        </div>
        <button on:click={() => onDelete(data.id)} class="button-style error">Delete</button>
    </div>
    <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">

    {#if data.type === 'sfx' || data.type === 'music'}
        <audio controls src={`/api/resources/${data.id}`}></audio>
    {:else if data.type === 'charactertokenimage'}
        <TokenBackground>
            <img src={`/api/resources/${data.id}`} alt="Character" style="max-width: 100%; max-height: 100%; border-radius: 4px;"/>
        </TokenBackground>
    {:else if data.type === 'clockconfig'}
        <a href="/admin/{data.name}/config">Edit</a>
    {:else if data.type === 'grimoirestate'}
            {#await fetch(`/api/resources/${data.id}`).then(res => res.json()) as Promise<GrimoireStateHistory>}
                <div>Loading...</div>
            {:then result}
                <div class="in-a-column">
                    <div>Updated {new Date(result.present.timestamp).toLocaleString()}</div>
                    <div>
                        <CustomOverlay title="View JSON">
                            <div>
                                <pre style="white-space: pre-wrap; word-break: break-word;">{JSON.stringify(result, null, 2)}</pre>
                            </div>
                        </CustomOverlay>
                    </div>
                </div>
            {:catch error}
                <div>Error loading resource data</div>
            {/await}
    {/if}
    </div>
    <div class="resource-thumb-footer">
    </div>
</div>