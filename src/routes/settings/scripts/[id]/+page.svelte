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
        /* Keeps wide content (e.g. the buttons) from stretching the page past the screen's width. */
        grid-template-columns: minmax(0, 1fr);
        gap: 1em;
        min-height: 0;
        overflow: hidden;
    }

    .title-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 0.6em;
    }
    .title-row .back {
        justify-self: start;
        white-space: nowrap;
    }
    .title {
        display: flex;
        align-items: center;
        gap: 0.6em;
        min-width: 0;
    }
    .title-swatch {
        width: 1.5em;
        height: 1.5em;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .title h2 {
        margin: 0;
        font-size: 2.2rem;
    }

    .panel {
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        grid-template-columns: minmax(0, 1fr);
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

    .panel-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.5em 1em;
        margin-bottom: 1em;
    }
    .panel-header h3 {
        margin: 0;
    }
    .panel-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    @media (max-width: 560px) {
        .title-row {
            grid-template-columns: auto minmax(0, 1fr);
        }
        .title h2 {
            font-size: 1.6rem;
        }
        .panel {
            padding: 0.75em 0.5em 0;
        }
    }
</style>

<div class="scripts-overview-main">
    <div class="overview-content padded">
        <div class="title-row">
            <a class="button-style back" href="/settings/scripts">← Back</a>
            <div class="title">
                <div class="title-swatch" style="background-color: {data.script.hue};"></div>
                <h2>{data.script.name}</h2>
            </div>
        </div>
        <div class="panel">
            <div class="panel-header">
                <h3>Characters ({data.script.characters.length})</h3>
                <div class="panel-actions">
                    <a class="button-style" href="/script/{data.script.id}?backUrl=/settings/scripts/{data.script.id}">View Script</a>
                    <a class="button-style" href="/settings/scripts/{data.script.id}/presets">Presets</a>
                    <a class="button-style" href="/settings/scripts/{data.script.id}/characters">Edit Characters</a>
                    <a class="button-style" href="/api/scripts/{data.script.id}/export" download>Export</a>
                </div>
            </div>
            <div class="panel-scroll">
                <CharacterList characters={data.script.characters}/>
            </div>
        </div>
    </div>
</div>
