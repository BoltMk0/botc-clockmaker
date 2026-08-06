<script lang="ts" generics="T">
    import ChannelStripPan from './ChannelStripPan.svelte';
    import ChannelStripGain from './ChannelStripGain.svelte';
    import type { Snippet } from 'svelte';
    import AudioMixerText from './AudioMixerText.svelte';
    import type { AudioTrackBase } from '../../AudioTrack.svelte';

    const {
        audioTrack, 
        title = undefined,
        onTitleClick = undefined,
        fxSnippet = undefined,
        fxSnippetArg = undefined,
        style=undefined
    }: {
        audioTrack: AudioTrackBase;
        title?: string;
        onTitleClick?: (ev?: any)=>void;
        fxSnippet?: Snippet<[T|undefined]>;
        fxSnippetArg?: T;
        style?: string;
    } = $props();

</script>
<div class="channel-strip-main" style="{style}">
    <AudioMixerText onclick={onTitleClick} style="margin-bottom: 5px;" title={title}>{title}</AudioMixerText>
    {#if fxSnippet}
    {@render fxSnippet(fxSnippetArg)}
    {/if}
    <div class="channel-strip-padding"></div>
    <div style="width: 100%;">
        <ChannelStripPan bind:pan={audioTrack.pan} onchange={()=>audioTrack.pan = audioTrack.pan}/>
    </div>
    <div>
        <ChannelStripGain bind:value={audioTrack.gain} onchange={()=>audioTrack.gain = audioTrack.gain}/>
    </div>
</div>

<style>
    .channel-strip-main {
        width: 85px;
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