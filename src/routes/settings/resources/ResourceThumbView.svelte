<script lang="ts">
    import type { Resource } from "$lib/resources/common/types";
    import type { Snippet } from "svelte";

    let {
        title,
        tags,
        style = "",
        onDelete = undefined,
        children
    }: {
        title: string;
        tags: string[];
        style?: string;
        onDelete?: (() => void) | undefined;
        children?: Snippet;
    } = $props();
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
        gap: 1em;
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

<div class="resource-thumb" style={style}>
    <div class="resource-thumb-header">
        <div>
            <span>{title}</span>
            {#each tags as tag}
                <div class="resource-tag">{tag}</div>
            {/each}
        </div>
        {#if onDelete}
            <button onclick={() => onDelete()} class="button-style error">Delete</button>
        {/if}
    </div>
    <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
        {@render children?.()}
    </div>
    <div class="resource-thumb-footer">
    </div>
</div>