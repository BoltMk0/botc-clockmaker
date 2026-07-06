<script lang="ts" generics="T">
    import type { AudioTrackModelBase } from '$lib/audio/client/model/AudioTrackModelBase.js';
    import ChannelStripPan from './ChannelStripPan.svelte';
    import ChannelStripGain from './ChannelStripGain.svelte';
    import type { Snippet } from 'svelte';

    const {
        title, 
        audioTrack, 
        onTitleClick = undefined,
        fxSnippet = undefined,
        fxSnippetArg = undefined
    }: {
        title?: string;
        audioTrack: AudioTrackModelBase;
        onTitleClick?: ()=>void;
        fxSnippet?: Snippet<[T|undefined]>;
        fxSnippetArg?: T
    } = $props();

</script>
<div class="channel-strip-main">
    <button class="strip-name-ele" onclick={onTitleClick} style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
        {title}
    </button>
    {#if fxSnippet}
    {@render fxSnippet(fxSnippetArg)}
    {/if}
    <div class="channel-strip-padding"></div>
    <div style="width: 6em;">
        <ChannelStripPan bind:pan={audioTrack.pan} />
    </div>
    <div>
        <ChannelStripGain bind:value={audioTrack.gain}/>
    </div>
</div>

<style>
    .strip-name-ele {
        width: 100%;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        margin-bottom: 8px;
        background-color: var(--theme-slider-accent);
        color: #4c6851;
        padding: 4px;
        text-align: center;
        border-radius: 3px;
        box-shadow: 0px 2px 8px 0px #0009 inset;
        border: 3px solid var(--theme-slider-trim);
    }

    .channel-strip-main {
        width: 100px;
        background-color: rgb(50, 50, 54);
        padding: 6px;
        border: 4px solid var(--theme-slider-trim);
        border-radius: 8px;
        box-shadow: 0 0 10px #0006 inset, 0px 4px 8px 0px #0009;
        display: flex;
        flex-direction: column;
    }

    .channel-strip-padding {
        flex: 1;
    }
</style>