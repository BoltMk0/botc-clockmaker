<script lang="ts" generics="T, T2 extends AudioTrack">
    import type { Snippet } from 'svelte';
    import ChannelStrip from './ChannelStrip.svelte';
    import AudioMixerText from './AudioMixerText.svelte';
    import { AudioTrackGroup } from '../../AudioTrackGroup';
    import { AudioTrack } from '../../AudioTrack.svelte';

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
        model: AudioTrackGroup<T2>|T2[];
        onTitleClick?: ()=>void;
        onChildTitleClick?: (clock: T2, index: number)=>void;
        fxSnippet?: Snippet<[T|undefined]>;
        fxSnippetArg?: T;
        style?: string;
    } = $props();

</script>

<div style="display: flex; flex-direction: column; gap: 5px; {style}">
    {#if model instanceof AudioTrackGroup}
    <AudioMixerText onclick={onTitleClick}>
        {#if title === undefined}
        {model.title}
        {:else if typeof title === 'string'}
        {title}
        {:else}
        {@render title()}
        {/if}
    </AudioMixerText>
    {/if}
    <div class="channel-strip-group-main">
        <div class="channel-strip-group-audio-tracks-container">
            {#each (model instanceof AudioTrackGroup ? model.tracks : model) as audioTrack, i}
                <ChannelStrip {audioTrack} onTitleClick={()=>{onChildTitleClick?.(audioTrack, i);}} title={audioTrack.title}/>
            {/each}
        </div>
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
        flex: 1;
    }
</style>