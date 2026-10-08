<script lang="ts" generics="T">
    import type { Resource } from "$lib/resources/common/types";
    import ChannelStrip from "./ChannelStrip.svelte";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import type { AudioAmbienceTrack } from "../../AudioAmbienceTrack.svelte";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import { AMBIENCE_ACTIVE_KEYS } from "$lib/audio/common/model/ambienceTrackModel";
    import CustomOverlay from "$lib/components/CustomOverlay.svelte";

    let {
        resources,
        track,
        title,
        timeOfDay,
        onTitleClick = undefined,
        onRemove = undefined
    }: {
        resources: Resource[];
        track: AudioAmbienceTrack;
        title: string;
        timeOfDay: TimeOfDay;
        onTitleClick?: (ev?: any)=>void;
        /** Shows a "Remove ambience track" button at the bottom of the track picker when set. */
        onRemove?: ()=>void;
    } = $props();

    const selectedResourceValue: number = $derived(resources.findIndex((r)=>{return track.loadedResourceId === r.id}));
    let showOverlay = $state(false);
</script>


{#snippet timeOfDayActiveIndicator(active: boolean)}
    <div style="width: 0.5em; height: 0.5em; border-radius: 50%; background-color: {active ? '#6A7' : '#FFF5'}; border: 0.1em solid #111">

    </div>
{/snippet}


{#snippet timeOfDayActivitySelection()}
    <div style="display: grid; grid-template-columns: repeat({TIMES_OF_DAY.length}, 1fr); gap: 3px 3px; padding: 5px 3px; box-sizing: border-box; width: 100%; overflow: hidden; justify-items: center;">
        {#each TIMES_OF_DAY as phase}
            {@const key = AMBIENCE_ACTIVE_KEYS[phase]}
            <button class="daynight-btn button-style" onclick={()=>{track[key] = !track[key]}} class:isEnabled={track[key]} title="{track[key] ? 'Plays' : 'Silent'} at {TIME_OF_DAY_LABELS[phase].toLowerCase()}">
                <TimeOfDayIcon timeOfDay={phase} color={track[key] ? 'white' : '#FFF5'}/>
            </button>
        {/each}
        {#each TIMES_OF_DAY as phase}
            {@render timeOfDayActiveIndicator(timeOfDay === phase)}
        {/each}
    </div>
{/snippet}

<div style="position: relative;">

    <ChannelStrip
        audioTrack={track}
        fxSnippet={timeOfDayActivitySelection}
        title={title}
        onTitleClick={(ev)=>{
            showOverlay = !showOverlay;
            ev.stopPropagation();
            ev.preventDefault();
            onTitleClick?.(ev);
        }}
    />

    <CustomOverlay title="Select track" showButton={false} bind:visible={showOverlay}>
        <div class="resource-select-list">
            <button class="button-style" disabled={selectedResourceValue === -1} onclick={()=>{track.loadedResourceId = null; showOverlay = false;}}>None</button>
            {#each resources as resource, i (resource.id)}
                <button class="button-style" disabled={selectedResourceValue === i} onclick={()=>{track.loadedResourceId = resource.id; showOverlay = false;}}>{resource.name}</button>
            {/each}
            {#if onRemove}
                <button class="button-style remove-track-btn" onclick={()=>{showOverlay = false; onRemove();}}>Remove ambience track</button>
            {/if}
        </div>
    </CustomOverlay>
</div>

<style>
    .resource-select-list {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
        min-width: 200px;
    }

    button.remove-track-btn {
        margin-top: 0.7em;
        background-color: var(--theme-error);
        color: var(--theme-on-error);
    }

    button.daynight-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        border: 2px solid transparent;
        box-sizing: border-box;
        width: 100%;
        max-width: 2em;
        aspect-ratio: 1;
        padding: 0;
    }

    button.daynight-btn.isEnabled {
        border-color: var(--theme-highlight);
    }
</style>