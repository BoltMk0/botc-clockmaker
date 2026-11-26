<script lang="ts">
    import PresetsTab from "./PresetsTab.svelte";
    import TextsTab from "./TextsTab.svelte";

    type Tab = 'presets' | 'texts';
    const TABS: { tab: Tab, label: string }[] = [
        { tab: 'presets', label: 'Presets' },
        { tab: 'texts', label: 'Texts' }
    ];

    let tab: Tab = $state('presets');
</script>

<div class="communications-page">
<div class="communications-column">

<div class="tab-bar" role="tablist" aria-label="Communications">
    {#each TABS as t}
        <button role="tab" id="communications-tab-button-{t.tab}" aria-controls="communications-tab-{t.tab}" aria-selected={tab === t.tab} class:selected={tab === t.tab} onclick={() => tab = t.tab}>
            {t.label}
        </button>
    {/each}
</div>

<!-- Both stay mounted, so switching tabs keeps unsaved changes -->
<div class="tab-content" id="communications-tab-presets" hidden={tab !== 'presets'} role="tabpanel" aria-labelledby="communications-tab-button-presets">
    <PresetsTab/>
</div>
<div class="tab-content" id="communications-tab-texts" hidden={tab !== 'texts'} role="tabpanel" aria-labelledby="communications-tab-button-texts">
    <TextsTab/>
</div>

</div>
</div>

<style>
    /* Scrolls as a whole, with the tabs sitting on top of the tab's panel like folder tabs. */
    .communications-page {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
    }

    .communications-column {
        width: 100%;
        max-width: 44rem;
        display: flex;
        flex-direction: column;
    }

    .tab-bar {
        display: flex;
        gap: 0.25rem;
        /* Clear of the panel's rounded corner */
        padding: 0 1rem;
    }

    .tab-bar button {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.6em 1.4em;
        font: inherit;
        background: none;
        color: var(--theme-on-bg);
        border: 1px solid transparent;
        border-bottom: none;
        border-radius: 10px 10px 0 0;
        opacity: 0.7;
        white-space: nowrap;
        cursor: pointer;
    }

    .tab-bar button:hover {
        opacity: 1;
        background-color: color-mix(in srgb, var(--theme-bg-secondary) 50%, transparent);
    }

    /* The open tab takes the panel's colour and border, and covers the panel's top edge beneath it, so they join. */
    .tab-bar button.selected {
        z-index: 1;
        margin-bottom: -1px;
        padding-bottom: calc(0.6em + 1px);
        opacity: 1;
        font-weight: bold;
        background-color: var(--theme-bg-secondary);
        border-color: var(--theme-bg-tertiary);
    }

    .tab-content[hidden] {
        display: none;
    }

    @media (max-width: 560px) {
        .communications-page {
            padding: 0.75rem;
        }

        .tab-bar {
            padding: 0 0.5rem;
        }

        .tab-bar button {
            flex: 1;
            justify-content: center;
        }
    }
</style>
