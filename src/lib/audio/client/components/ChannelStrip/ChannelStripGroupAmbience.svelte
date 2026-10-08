<script lang="ts" generics="T">
    import type { Snippet } from 'svelte';
    import ChannelStrip from './ChannelStrip.svelte';
    import AudioMixerText from './AudioMixerText.svelte';
    import ChannelStripAmbience from './ChannelStripAmbience.svelte';
    import type { Resource } from '$lib/resources/common/types';
    import type { AmbienceEngine } from '../../AmbienceEngine.svelte';
    import type { TimeOfDay } from '$lib/model/client/types';
    import { MAX_AMBIENCE_TRACKS } from '$lib/audio/common/model/ambienceEngineModel';

    const {
        engine,
        resources,
        title = undefined,
        timeOfDay,
        onTitleClick = undefined,
        onChildTitleClick = undefined,
        fxSnippet = undefined,
        fxSnippetArg = undefined,
        style=undefined
    }: {
        title?: Snippet|string;
        engine: AmbienceEngine;
        resources: Resource[];
        timeOfDay: TimeOfDay;
        onTitleClick?: ()=>void;
        onChildTitleClick?: (index: number)=>void;
        fxSnippet?: Snippet<[T|undefined]>;
        fxSnippetArg?: T;
        style?: string;
    } = $props();

</script>

<div style="display: flex; flex-direction: column; gap: 5px; {style}">
    <AudioMixerText onclick={onTitleClick}>
    {#if title === undefined}
        {engine.title}
    {:else if typeof title === 'string'}
        {title}
    {:else}
        {@render title()}
    {/if}
    </AudioMixerText>
    <div class="channel-strip-group-main">
        <div class="channel-strip-group-audio-tracks-container">
            <!-- Keyed by track, so removing one doesn't hand its strip's state (e.g. an open picker) to the next -->
            {#each engine.tracks as audioTrack, i (audioTrack)}
                <ChannelStripAmbience {timeOfDay} track={audioTrack} title={resources.find(r=>r.id === audioTrack.loadedResourceId)?.name ?? '(empty)'} resources={resources} onTitleClick={()=>{onChildTitleClick?.(i);}} onRemove={()=>engine.removeTrack(i)}/>
            {/each}
        </div>
        {#if engine.tracks.length < MAX_AMBIENCE_TRACKS}
        <button class="add-track-strip" onclick={()=>engine.addTrack()}>
            <div class="add-track-text">+<br/>Ambience<br/>Track</div>
        </button>
        {/if}
        <ChannelStrip audioTrack={engine} title="BUS" style="--theme-slider-accent: #DCC;"/>
    </div>
</div>
<style>
    .channel-strip-group-audio-tracks-container {
        display: flex;
        gap: 5px;
    }

    /* Styled like the empty "+ Spotify player" strip in ChannelStripSpotify, but sized like a ChannelStrip. */
    .add-track-strip {
        width: 85px;
        box-sizing: content-box;
        padding: 6px;
        background-color: transparent;
        border: 4px dashed #777;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: stretch;
        font: inherit;
        font-family: 'Courier New', Courier, monospace;
        color: #ccc;
        cursor: pointer;
    }

    .add-track-strip:hover {
        border-color: #aaa;
    }

    .add-track-text {
        text-align: center;
        font-weight: bold;
        font-size: 0.8em;
        padding: 8px 0;
    }

    .channel-strip-group-main {
        /* Fill the rest of the group's height, so the strips grow with the tallest one in the mixer row (e.g. Spotify) */
        flex: 1;
        width: fit-content;
        display: flex;
        flex-direction: row;
        gap: 5px;
    }
</style>