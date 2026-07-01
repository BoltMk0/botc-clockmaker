<script module lang="ts">
    import type { Snippet } from "svelte";

    export type SideTabItem<T = undefined> = {
        label: string;
        disabled?: boolean;
        arg?: T;
        snippet: Snippet<[T]>;
    };
</script>

<script lang="ts" generics="T = undefined">
    import PlusIcon from "./PlusIcon.svelte";

    let {
        items,
        selectedIndex = $bindable(0),
        title,
        onAddItem
    }: {
        items: SideTabItem<T>[];
        selectedIndex?: number;
        title?: string;
        onAddItem?: ()=>void
    } = $props();
</script>

<div class="side-tab-layout" class:with-title={!!title}>
    {#if title}
        <div class="side-tab-title">
            <span>{title}</span>
            {#if onAddItem}
                <button class="side-tab-add-button" onclick={onAddItem} aria-label="Add">
                    <PlusIcon size={24} />
                </button>
            {/if}
        </div>
    {/if}
    <div class="side-tab-list">
        {#each items as item, i}
            <button
                class="side-tab-item"
                class:active={selectedIndex === i}
                disabled={item.disabled}
                onclick={() => (selectedIndex = i)}
            >
                {item.label}
            </button>
        {/each}
    </div>
    <div class="side-tab-content">
        {#if items[selectedIndex]}
            {@render items[selectedIndex].snippet(items[selectedIndex].arg as T)}
        {/if}
    </div>
</div>

<style>
    .side-tab-layout {
        display: grid;
        grid-template-columns: auto 1fr;
        grid-template-rows: 1fr;
        gap: 4px;
        color: var(--theme-on-bg);
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }

    .side-tab-layout.with-title {
        grid-template-rows: auto 1fr;
    }

    .side-tab-title {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-start;
        gap: 0.3em;
        align-items: center;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        padding: 10px;
        box-sizing: border-box;
        font-size: x-large;
    }

    .side-tab-add-button {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        display: flex;
        align-items: center;
        padding: 4px;
        border-radius: 5px;
        opacity: 0.6;
    }

    .side-tab-add-button:hover {
        background-color: var(--theme-bg-tertiary);
        opacity: 1;
    }

    .side-tab-list {
        background-color: var(--theme-bg);
        display: flex;
        flex-direction: column;
        padding: 10px;
        gap: 2px;
    }

    .side-tab-item {
        background-color: var(--theme-bg);
        color: var(--theme-on-bg-secondary);
        border: none;
        padding: 10px;
        text-align: left;
        cursor: pointer;
        box-sizing: border-box;
        min-width: 10em;
    }

    .side-tab-item:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .side-tab-item.active {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .side-tab-content {
        background-color: var(--theme-bg);
        height: 100%;
        overflow: auto;
        box-sizing: border-box;
        padding: 10px;
    }
</style>
