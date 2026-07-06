<script lang="ts" generics="T">
    import type { AudioTrackModelBase } from '$lib/audio/client/model/AudioTrackModelBase.js';
    import type { Snippet } from 'svelte';
    import ChannelStrip from './ChannelStrip.svelte';
    import type { AudioTrackGroupModel } from '../../model/AudioTrackGroupModel.svelte';
    import AudioMixerText from './AudioMixerText.svelte';

    const {
        model,
        title = undefined,
        onTitleClick = undefined,
        onChildTitleClick = undefined,
        fxSnippet = undefined,
        fxSnippetArg = undefined,
        style=undefined
    }: {
        title?: Snippet|string;
        model: AudioTrackGroupModel;
        onTitleClick?: ()=>void;
        onChildTitleClick?: (id: string)=>void;
        fxSnippet?: Snippet<[T|undefined]>;
        fxSnippetArg?: T;
        style?: string;
    } = $props();

</script>

<div style="display: flex; flex-direction: column; gap: 5px; {style}">
    <AudioMixerText onclick={onTitleClick}>
    {#if title === undefined}
        {model.title}
    {:else if typeof title === 'string'}
        {title}
    {:else}
        {@render title()}
    {/if}
    </AudioMixerText>
    <div class="channel-strip-group-main">
        <div class="channel-strip-group-audio-tracks-container">
            {#each model.audioTracks as audioTrack}
                <ChannelStrip {audioTrack} onTitleClick={()=>{onChildTitleClick?.(audioTrack.id);}}/>
            {/each}
        </div>
        <ChannelStrip audioTrack={model} title="BUS" style="--theme-slider-accent: #DCC;"/>
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