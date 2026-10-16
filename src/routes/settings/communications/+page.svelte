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

<style>
    .communications-page {
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    /* The tab bar from the music settings */
    .tab-bar {
        flex-shrink: 0;
        display: flex;
        gap: 0.25rem;
        padding: 0.75rem 1.5rem 0;
        border-bottom: 1px solid var(--theme-bg-tertiary);
        overflow-x: auto;
    }

    .tab-bar button {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.6em 1.2em;
        font-size: 1rem;
        background: none;
        color: var(--theme-on-bg);
        border: none;
        border-bottom: 3px solid transparent;
        border-radius: 6px 6px 0 0;
        opacity: 0.7;
        white-space: nowrap;
        cursor: pointer;
    }

    .tab-bar button:hover {
        opacity: 1;
        background-color: var(--theme-bg-secondary);
    }

    .tab-bar button.selected {
        opacity: 1;
        border-bottom-color: var(--theme-highlight);
        font-weight: bold;
    }

    .tab-content {
        flex: 1;
        min-height: 0;
    }

    .tab-content[hidden] {
        display: none;
    }

    @media (max-width: 560px) {
        .tab-bar {
            padding: 0.5rem 0.75rem 0;
            gap: 0;
        }

        .tab-bar button {
            flex: 1;
            justify-content: center;
        }
    }
</style>
