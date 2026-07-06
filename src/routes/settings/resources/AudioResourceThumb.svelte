<script lang="ts">
    import type { Resource } from "$lib/resources/common/types";
    import { formatTime } from "$lib/common/util";
    import ResourceThumbView from "./ResourceThumbView.svelte";
    import PlayIcon from "$lib/components/PlayIcon.svelte";
    import PauseIcon from "$lib/components/PauseIcon.svelte";
    import { prettifyResourceName } from "$lib/resources/common/util";

    export let resource: Resource;
    export let style: string = "";
    export let onDelete: (id: string) => void;

    let audioElement: HTMLAudioElement | null = null;

    let duration: number | null = null;
    let progress: number = 0;
    let playing = false;

    function onDurationChange() {
        if (audioElement && Number.isFinite(audioElement.duration)) {
            duration = audioElement.duration;
        }
    }

    function onAudioLoad() {
        if (!audioElement) return;
        if (Number.isFinite(audioElement.duration)) {
            duration = audioElement.duration;
            return;
        }
        // Some MP3s report Infinity until the browser seeks near the end to measure it.
        const el = audioElement;
        const restoreTime = el.currentTime;
        el.currentTime = 1e10;
        el.ontimeupdate = () => {
            el.ontimeupdate = null;
            el.currentTime = restoreTime;
            if (Number.isFinite(el.duration)) duration = el.duration;
        };
    }

</script>

<ResourceThumbView title={prettifyResourceName(resource.name)} tags={[resource.type]} onDelete={() => onDelete(resource.id)} style={style}>
    {#if resource.type === 'sfx' || resource.type === 'music'}
        <audio bind:this={audioElement}
        src={`/api/resources/${resource.id}`} 
        onloadeddata={onAudioLoad} ondurationchange={onDurationChange} onplaying={()=>{playing = true}}
        onpause={()=>{playing = false; audioElement && (audioElement.currentTime = 0)}} 
        ontimeupdate={()=>{progress = audioElement?.currentTime || 0}}
        controls></audio>
    {:else}
        <span>Preview not available for this resource type</span>
    {/if}
</ResourceThumbView>

<style>
audio{
    width: 100%;
}
</style>