<script lang="ts" generics="T">
    import type { AudioTrackModelBase } from '$lib/audio/client/model/AudioTrackModelBase.js';
    import type { Snippet } from 'svelte';
    import ChannelStrip from './ChannelStrip.svelte';

    const {
        masterTrack,
        audioTracks,
        onTitleClick = undefined,
        fxSnippet = undefined,
        fxSnippetArg = undefined
    }: {
        title?: string;
        masterTrack: AudioTrackModelBase;
        audioTracks: AudioTrackModelBase[];
        onTitleClick?: ()=>void;
        fxSnippet?: Snippet<[T|undefined]>;
        fxSnippetArg?: T
    } = $props();

</script>
<div class="channel-strip-group-main">
    <div class="channel-strip-group-audio-tracks-container">
        {#each audioTracks as audioTrack}
            <ChannelStrip {audioTrack}/>
        {/each}
    </div>
    <ChannelStrip audioTrack={masterTrack}/>
</div>

<style>
    
    .channel-strip-group-main {
        width: fit-content;
        display: flex;
        flex-direction: row;
        gap: 5px;
    }
</style>