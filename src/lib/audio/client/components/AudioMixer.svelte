<script lang="ts">
    import ChannelStrip from "./ChannelStrip/ChannelStrip.svelte";
    import ChannelStripGroup from "./ChannelStrip/ChannelStripGroup.svelte";
    import type { Resource } from "$lib/resources/common/types";
    import PlayIcon from "$lib/audio/client/components/PlayIcon.svelte";
    import PauseIcon from "$lib/audio/client/components/PauseIcon.svelte";
    import ChannelStripGroupAmbience from "./ChannelStrip/ChannelStripGroupAmbience.svelte";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { AudioClockTrack } from "../AudioClockTrack.svelte";
    import type { AudioEngine } from "../AudioEngine.svelte";
    import type { SpotifyPlayer } from "../SpotifyPlayer.svelte";
    import type { SpotifyPreset } from "$lib/audio/common/spotifyPreset";
    import ChannelStripSpotify from "./ChannelStrip/ChannelStripSpotify.svelte";
    import Knob from "./Knob.svelte";
    import { TIME_OF_DAY_TRIM_RANGE_DB } from "$lib/audio/common/model/timeOfDayTrimModel";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";

    /** How long the trim bubble stays up after the knob stops moving. */
    const TRIM_BUBBLE_MS = 1200;

    let {
        audioEngine,
        ambienceResources,
        spotify = undefined,
        spotifyPresets = []
    }: {
        audioEngine: AudioEngine
        ambienceResources: Resource[];
        spotify?: SpotifyPlayer;
        spotifyPresets?: SpotifyPreset[];
    } = $props();

    // The trim being adjusted, shown in a bubble at the top of the screen (the knobs are small, and a finger covers them)
    let trimBubblePhase = $state<TimeOfDay|null>(null);
    let trimBubbleTimer: ReturnType<typeof setTimeout>|null = null;

    function setTrim(phase: TimeOfDay, db: number) {
        audioEngine.setTimeOfDayTrimDb(phase, db);
        trimBubblePhase = phase;
        if (trimBubbleTimer !== null) clearTimeout(trimBubbleTimer);
        trimBubbleTimer = setTimeout(() => { trimBubblePhase = null; trimBubbleTimer = null; }, TRIM_BUBBLE_MS);
    }

    /** Moves the element to the end of <body>, so no ancestor's stacking context or clipping can hide it. */
    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return { destroy() { node.remove(); } };
    }

    function formatTrim(db: number) {
        return `${db > 0 ? '+' : ''}${db.toFixed(1)}`;
    }

    $effect(() => () => { if (trimBubbleTimer !== null) clearTimeout(trimBubbleTimer); });
</script>

<style>
    .mixer-groups {
        display: flex;
        /* Stretch (rather than flex-start) so both mixers match heights - they hold different channel
           strips, which would otherwise size each group to its own tallest strip independently. */
        align-items: stretch;
        /* Gap between the two mixers - the main one (ambience/Spotify) and the clocks/sting one. */
        gap: 40px;
        /* Centred when it fits; left-aligned (so scrollable) when wider than the screen. justify-content: center
           would instead push the overflow off the left edge, where it can't be scrolled to. */
        width: max-content;
        margin: 0 auto;
    }

    .mixer-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .mixer-group-title {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #999;
        font-size: 0.75em;
        font-weight: bold;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .mixer-group-title::before,
    .mixer-group-title::after {
        content: "";
        flex: 1;
        height: 1px;
        background: var(--theme-slider-trim);
    }

    /* Per-phase master trims, laid out like the day/dusk/night toggles on the ambience strips. The MASTER strip is
       widened (to 100px, from the usual 85px) so each column fits its knob and a "+12.0" readout. */
    .time-of-day-trims {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 2px;
        padding: 5px 0;
    }

    .time-of-day-trim {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 2px 0;
        border: 1px solid transparent;
        border-radius: 4px;
        color: #FFF8;
    }

    .time-of-day-trim.current {
        border-color: var(--theme-highlight);
        color: white;
    }

    .trim-bubble {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        /* Above the top navbar (1000) and the side menu's mixer overlay (2000) */
        z-index: 3000;
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 8px 18px;
        border-radius: 999px;
        background-color: rgb(50, 50, 54);
        border: 3px solid var(--theme-slider-trim);
        box-shadow: 0 6px 14px #000b;
        color: white;
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        font-size: 1.1em;
        white-space: nowrap;
        pointer-events: none;
    }

    .trim-bubble-value {
        min-width: 6.5ch;
        text-align: right;
    }

    .time-of-day-trim-value {
        font-family: 'Courier New', Courier, monospace;
        font-size: 0.6em;
        font-weight: bold;
    }

    .mixer-channel-strips {
        display: flex;
        gap: 5px;
        align-items: stretch;
        /* Fills the rest of the group's height below the title, so both groups' strip rows still line up
           even though one group's title takes the same space as the other's. */
        flex: 1;
    }
</style>

{#if trimBubblePhase !== null}
<div class="trim-bubble" use:portal>
    <TimeOfDayIcon timeOfDay={trimBubblePhase} size={20}/>
    <span>{TIME_OF_DAY_LABELS[trimBubblePhase]}</span>
    <span class="trim-bubble-value">{formatTrim(audioEngine.timeOfDayTrimDb[trimBubblePhase])} dB</span>
</div>
{/if}

<div class="mixer-main">
    <div class="mixer-groups">
        {#if audioEngine}
        <div class="mixer-group">
            <div class="mixer-group-title">Music &amp; Ambience</div>
            <div class="mixer-channel-strips">
            {#if audioEngine.ambienceEngine !== null}
            {#snippet ambienceEngineTitle()}
                <div style="display: flex; gap: 0.5em; justify-content: center; align-items: center;">
                    <TimeOfDayIcon timeOfDay={audioEngine.timeOfDay} size={14}/>
                    <span>Ambience Engine</span>
                    {#if audioEngine?.ambienceEngine?.effectivelyPlaying}
                    <PlayIcon/>
                    {:else}
                    <PauseIcon/>
                    {/if}
                </div>
            {/snippet}
            <ChannelStripGroupAmbience engine={audioEngine.ambienceEngine} timeOfDay={audioEngine.timeOfDay} resources={ambienceResources} onTitleClick={()=>{audioEngine?.ambienceEngine?.togglePlayPause()}} style="--theme-slider-accent: #FAA;" title={ambienceEngineTitle}/>
            {/if}
            {#if spotify}
            <!-- Spotify plays in the SDK's own iframe, so it can't be routed through the master bus: it gets the
                 master gain applied to its own volume commands instead (see ChannelStripSpotify) so the master
                 fader still controls it, just via Spotify's own volume API rather than a Web Audio gain node -
                 it's still one of this mixer's own channels, not a separate thing, so it sits in the same row.
                 MASTER stays the rightmost strip, so this goes just before it rather than after. -->
            <ChannelStripSpotify {spotify} presets={spotifyPresets} masterGain={audioEngine.gain} style="--theme-slider-accent: #AFA;"/>
            {/if}
            {#snippet timeOfDayTrims()}
                <div class="time-of-day-trims">
                    {#each TIMES_OF_DAY as phase}
                        {@const db = audioEngine.timeOfDayTrimDb[phase]}
                        <div class="time-of-day-trim" class:current={audioEngine.timeOfDay === phase}>
                            <TimeOfDayIcon timeOfDay={phase} size={12}/>
                            <Knob value={db} min={-TIME_OF_DAY_TRIM_RANGE_DB} max={TIME_OF_DAY_TRIM_RANGE_DB} step={0.5}
                                title="{TIME_OF_DAY_LABELS[phase]} level (drag up/down, double-click to reset)"
                                onchange={(v)=>setTrim(phase, v)}/>
                            <span class="time-of-day-trim-value">{formatTrim(db)}</span>
                        </div>
                    {/each}
                </div>
            {/snippet}
            <ChannelStrip audioTrack={audioEngine} title="MASTER" fxSnippet={timeOfDayTrims} style="--theme-slider-accent: #DCC; width: 100px;"/>
            </div>
        </div>
        <!-- Clocks (player bells) and the sting engine get their own mixer, with its own independent master
             fader (audioEngine.clocksMaster) rather than sharing the one above - see AudioEngine.svelte.ts. -->
        <div class="mixer-group">
            <div class="mixer-group-title">SFX</div>
            <div class="mixer-channel-strips">
            {#if audioEngine.stingEngine !== null}
            <ChannelStrip audioTrack={audioEngine.stingEngine} title="STING" onTitleClick={()=>{audioEngine?.stingEngine?.trigger()}} style="--theme-slider-accent: #FA5;"/>
            {/if}
            <ChannelStripGroup model={audioEngine.clockAudioTracks} onChildTitleClick={(clock, index)=>{
                clock.ringEndOfDay();
            }}/>
            <ChannelStrip audioTrack={audioEngine.clocksMaster} title="MASTER" style="--theme-slider-accent: #DCC"/>
            </div>
        </div>
        {/if}
    </div>
</div>