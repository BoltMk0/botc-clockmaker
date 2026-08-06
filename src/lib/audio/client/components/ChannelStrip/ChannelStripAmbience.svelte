<script lang="ts" generics="T">
    import type { Resource } from "$lib/resources/common/types";
    import ChannelStrip from "./ChannelStrip.svelte";
    import DayIcon from "$lib/assets/dayIcon.svelte";
    import NightIcon from "$lib/assets/nightIcon.svelte";
    import type { AudioAmbienceTrack } from "../../AudioAmbienceTrack.svelte";
    import type { TimeOfDay } from "$lib/model/client/types";

    let {
        resources,
        track,
        title,
        timeOfDay,
        onTitleClick = undefined
    }: {
        resources: Resource[];
        track: AudioAmbienceTrack;
        title: string;
        timeOfDay: TimeOfDay;
        onTitleClick?: (ev?: any)=>void;
    } = $props();

    const selectedResourceValue: number = $derived(resources.findIndex((r)=>{return track.loadedResourceId === r.id}));
    let showOverlay = $state(false);
</script>


{#snippet timeOfDayActiveIndicator(active: boolean)}
    <div style="width: 0.5em; height: 0.5em; border-radius: 50%; background-color: {active ? '#6A7' : '#FFF5'}; border: 0.1em solid #111">

    </div>
{/snippet}


{#snippet timeOfDayActivitySelection()}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px 5px; padding: 5px; box-sizing: border-box; width: 100%; overflow: hidden; justify-items: center;">
        <button class="daynight-btn button-style" onclick={()=>{track.activeInDay = !track.activeInDay}} class:isEnabled={track.activeInDay} class:highlight={timeOfDay === 'day' && track.activeInDay}>
            <DayIcon color={track.activeInDay ? 'white' : '#FFF5'}/>
        </button>
        <button class="daynight-btn button-style" onclick={()=>{track.activeAtNight = !track.activeAtNight}} class:isEnabled={track.activeAtNight} class:highlight={timeOfDay === 'night' && track.activeAtNight}>
            <NightIcon color={track.activeAtNight ? 'white' : '#FFF5'}/>
        </button>
        {@render timeOfDayActiveIndicator(true)}
        {@render timeOfDayActiveIndicator(false)}
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

    {#if showOverlay}
    <div class="resource-select-overlay">
        {#each resources as resource, i (resource.id)}
            <button class="button-style" disabled={selectedResourceValue === i} onclick={()=>{track.loadedResourceId = resource.id; showOverlay = false;}}>{resource.name}</button>
        {/each}
    </div>
    {/if}
</div>

<svelte:body onclick={()=>{showOverlay = false;}}/>


<style>
    .resource-select-overlay {
        position: absolute;
        top: 3em;

        background-color: var(--theme-bg);
        padding: 0.5em;
        z-index: 999;
    }

    button.daynight-btn {
        display: flex;
        justify-content: center;
        align-items: center;
        border: 2px solid transparent;
        box-sizing: border-box;
        width: 2em;
        height: 2em;
        padding: 0;
    }

    button.daynight-btn.isEnabled {
        border-color: var(--theme-highlight);
    }

    button.daynight-btn.highlight {
        box-shadow: 0 0 5px black inset;
    }
</style>