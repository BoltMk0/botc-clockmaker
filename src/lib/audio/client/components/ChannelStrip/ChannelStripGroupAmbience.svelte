<script lang="ts" generics="T">
    import type { Snippet } from 'svelte';
    import ChannelStrip from './ChannelStrip.svelte';
    import AudioMixerText from './AudioMixerText.svelte';
    import ChannelStripAmbience from './ChannelStripAmbience.svelte';
    import type { Resource } from '$lib/resources/common/types';
    import type { AmbienceEngine } from '../../AmbienceEngine.svelte';
    import type { TimeOfDay } from '$lib/model/client/types';

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
            {#each engine.tracks as audioTrack, i}
                <ChannelStripAmbience {timeOfDay} track={audioTrack} title={`${audioTrack.loadedResourceId}`} resources={resources} onTitleClick={()=>{onChildTitleClick?.(i);}}/>
            {/each}
        </div>
        <ChannelStrip audioTrack={engine} title="BUS" style="--theme-slider-accent: #DCC;"/>
    </div>
</div>
<style>
    .channel-strip-group-audio-tracks-container {
        display: flex;
        gap: 5px;
    }

    .channel-strip-group-main {
        width: fit-content;
        display: flex;
        flex-direction: row;
        gap: 5px;
    }
</style>