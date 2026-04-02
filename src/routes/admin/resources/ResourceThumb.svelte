<script lang="ts">
    import type { Resource } from "$lib/common/resources";

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

    .resource-tag {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.8em;
        display: inline-block;
    }
</style>

<div class="resource-thumb">
    <div class="resource-thumb-header">
        <div>
            <span>{data.name}</span>
            <div class="resource-tag">{data.type}</div>
        </div>
        <button on:click={() => onDelete(data.id)} class="button-style error">Delete</button>
    </div>
    <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">

    {#if data.type === 'sfx' || data.type === 'music'}
        <audio controls src={`/admin/api/resources/${data.id}`}></audio>
    {/if}
    </div>
    <div class="resource-thumb-footer">
    </div>
</div>