<script lang="ts">
    import type { Resource } from "$lib/common/resources";
    import { formatTime } from "$lib/common/util";
    import ResourceThumbView from "./ResourceThumbView.svelte";
    import PlayIcon from "$lib/assets/PlayIcon.svelte";
    import PauseIcon from "$lib/assets/PauseIcon.svelte";

    export let resource: Resource;
    export let style: string = "";

    let audioElement: HTMLAudioElement | null = null;

    let duration: number | null = null;
    let progress: number = 0;
    let playing = false;

    function onAudioLoad() {
        if (audioElement) {
            duration = audioElement.duration;
        }
    }

</script>

<ResourceThumbView title={resource.name} tags={[resource.type]} onDelete={() => {}} style={style}>
    {#if resource.type === 'sfx' || resource.type === 'music'}
        <audio bind:this={audioElement} src={`/admin/api/resources/${resource.id}`} onloadedmetadata={onAudioLoad} onplaying={()=>{playing = true}} onpause={()=>{playing = false; audioElement && (audioElement.currentTime = 0)}} ontimeupdate={()=>{progress = audioElement?.currentTime || 0}}></audio>
        {#if duration !== null && progress !== null}
            <span>{formatTime(progress)}</span>/<span>{formatTime(duration)}</span>
        {/if}
        <span class="play-icon">
            <button class="no-button-style" onclick={() => playing ? audioElement?.pause() : audioElement?.play()}>
                {#if playing}
                    <PauseIcon size={24} color="var(--theme-on-bg-secondary)"/>
                {:else}
                    <PlayIcon size={24} color="var(--theme-on-bg-secondary)"/>
                {/if}
            </button>
        </span>
    {:else}
        <span>Preview not available for this resource type</span>
    {/if}
</ResourceThumbView>

<style>
    .play-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
    }
</style>