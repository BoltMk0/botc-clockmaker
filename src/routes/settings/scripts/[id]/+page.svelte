<script lang="ts">
    import CharacterList from "$lib/components/CharacterList.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();
</script>

<style>
    .scripts-overview-main {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: minmax(0, 1fr);
        overflow: hidden;
    }

    .overview-content {
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 1em;
        min-height: 0;
        overflow: hidden;
    }

    .panel {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        padding: 1em 1em 0;
        border-radius: 1em;
        box-sizing: border-box;
        overflow: hidden;
    }

    /* The scroll container has no top padding so sticky category headings sit flush
       with its top edge, with nothing visible above them. */
    .panel-scroll {
        overflow-y: auto;
        min-height: 0;
    }
</style>

<div class="scripts-overview-main">
    <div class="overview-content padded">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.6em;">
            <div style="width: 1.5em; height: 1.5em; border-radius: 50%; background-color: {data.script.hue};"></div>
            <h2 style="margin: 0; font-size: 2.2rem;">{data.script.name}</h2>
        </div>
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin-top: 0;">Characters ({data.script.characters.length})</h3>
                <div style="display: flex; gap: 0.5em;">
                    <a class="button-style" href="/settings/scripts/{data.script.id}/presets">Presets</a>
                    <a class="button-style" href="/settings/scripts/{data.script.id}/characters">Edit Characters</a>
                </div>
            </div>
            <div class="panel-scroll">
                <CharacterList characters={data.script.characters}/>
            </div>
        </div>
    </div>
</div>
