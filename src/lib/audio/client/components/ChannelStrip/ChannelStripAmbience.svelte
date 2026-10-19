<script lang="ts" generics="T">
    import type { AmbienceResource } from "$lib/common/ambience";
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
        stereoHere = false,
        onTitleClick = undefined,
        onRemove = undefined
    }: {
        resources: AmbienceResource[];
        track: AudioAmbienceTrack;
        title: string;
        timeOfDay: TimeOfDay;
        /** This device plays sound in stereo, so the front and rear switches make no difference to what it plays. */
        stereoHere?: boolean;
        onTitleClick?: (ev?: any)=>void;
        /** Shows a "Remove ambience track" button at the bottom of the track picker when set. */
        onRemove?: ()=>void;
    } = $props();

    const selectedResourceValue: number = $derived(resources.findIndex((r)=>{return track.loadedResourceId === r.id}));
    let showOverlay = $state(false);
</script>


{#snippet timeOfDayActivitySelection()}
    <!-- Two by two (morning & day, then dusk & night). Lit from inside where the track plays; the current phase outlined -->
    <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 2em)); gap: 4px; justify-content: center; padding: 5px 3px; box-sizing: border-box; width: 100%; overflow: hidden;">
        {#each TIMES_OF_DAY as phase}
            {@const key = AMBIENCE_ACTIVE_KEYS[phase]}
            <button class="daynight-btn button-style" onclick={()=>{track[key] = !track[key]}} class:isEnabled={track[key]} class:isCurrent={timeOfDay === phase} title="{track[key] ? 'Plays' : 'Silent'} at {TIME_OF_DAY_LABELS[phase].toLowerCase()}">
                <TimeOfDayIcon timeOfDay={phase} color={track[key] ? 'white' : '#FFF5'}/>
            </button>
        {/each}
    </div>
    <!-- Which speakers it plays from in 4.0. One is always on: turning off the last does nothing -->
    <div class="output-selection" class:stereoHere title={stereoHere ? 'This device plays in stereo: the track plays at the front if either is on' : undefined}>
        {#each [['outputFront', 'F', 'front'], ['outputRear', 'R', 'rear']] as const as [key, label, pair]}
            <button class="daynight-btn output-btn button-style" onclick={()=>{track[key] = !track[key]}} class:isEnabled={track[key]} title="{track[key] ? 'Plays' : 'Silent'} from the {pair} speakers in 4.0">
                {label}
            </button>
        {/each}
    </div>
{/snippet}

<!-- Flex, so the strip stretches to this wrapper's (stretched) height rather than sitting at its natural height -->
<div style="position: relative; display: flex;">

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
                <button class="button-style" disabled={selectedResourceValue === i} onclick={()=>{track.loadedResourceId = resource.id; showOverlay = false;}}>{resource.title}</button>
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

    /* Laid out like the phase switches above */
    .output-selection {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 2em));
        gap: 4px;
        justify-content: center;
        padding: 0 3px 5px;
        box-sizing: border-box;
        width: 100%;
        overflow: hidden;
    }

    .output-selection.stereoHere {
        opacity: 0.45;
    }

    button.output-btn {
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        color: #FFF5;
    }

    button.output-btn.isEnabled {
        color: white;
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

    /* A phase the track plays in: lit from inside, light blue - dimmer while it isn't the current phase */
    button.daynight-btn.isEnabled {
        background: radial-gradient(circle, #8CEA 0%, #8CE4 60%, #8CE1 100%);
        box-shadow: inset 0 0 5px #ADFC;
    }

    button.daynight-btn.isEnabled.isCurrent {
        background: radial-gradient(circle, #96CBEBE6 0%, #7DBDEB73 60%, #7DBDEB1A 100%);
        box-shadow: inset 0 0 7px #AED2EB;
    }

    button.daynight-btn.isCurrent {
        border-color: var(--theme-highlight);
    }
</style>