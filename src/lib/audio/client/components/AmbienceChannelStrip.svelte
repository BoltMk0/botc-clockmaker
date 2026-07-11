<script lang="ts">
    import { AmbienceEngine } from "$lib/client/ambience_engine";
    import type { AmbienceResourceType } from "$lib/common/ambience";
    import { onDestroy, onMount } from "svelte";
    import { formatGain } from "./util";
    import VSlider from "./VSlider.svelte";
    import { browser } from "$app/environment";

    let {
        context,
        resources,
        outputNode = null
    }: {
        context: AudioContext;
        resources: AmbienceResourceType[];
        outputNode?: AudioNode | null;
    } = $props();

    let audio1: HTMLAudioElement;
    let audio2: HTMLAudioElement;

    let selectedResourceValue: number = $state(-1);

    let engine: AmbienceEngine | undefined = $state();
    onMount(()=>{
        if(audio1 && audio2 && context){
            engine = new AmbienceEngine(context, [audio1, audio2], outputNode ?? undefined);
        }

        loadSettings();
    });

    onDestroy(()=>{
        saveSettings();
    });

    function loadResource(index: number){
        if(typeof index === "string") index = parseInt(index);
        if(isNaN(index) || index < 0 || index >= resources.length){
            engine?.stop();
            saveSettings();
            return;
        };
        engine?.loadResource(resources[index]);
        saveSettings();
    }

    let saveSettingsTimeout: NodeJS.Timeout;
    function scheduleSaveSettings(){
        if(saveSettingsTimeout){
            clearTimeout(saveSettingsTimeout);
        }
        saveSettingsTimeout = setTimeout(()=>{
            saveSettings();
        }, 1000);
    }

    function saveSettings(){
        if(browser) {
            console.log("Saving ambience channel settings: selectedResourceValue =", selectedResourceValue, "gain =", engine?.masterGain.gain.value);
            const settings = {
                selectedResourceValue,
                gain: engine?.masterGain.gain.value
            };
            localStorage.setItem("ambienceChannelSettings", JSON.stringify(settings));
        }
    }

    function loadSettings(){
        if(browser) {
            const settingsString = localStorage.getItem("ambienceChannelSettings");
            if(settingsString){
                const settings = JSON.parse(settingsString);
                console.log("Loaded ambience channel settings:", settings);
                if(engine){
                    if(settings.gain !== undefined){
                        engine.masterGain.gain.value = settings.gain;
                    }
                    if(settings.selectedResourceValue !== undefined){
                        selectedResourceValue = settings.selectedResourceValue;
                        loadResource(selectedResourceValue);
                    }
                }
            }
        }
    }


</script>

<div class="channel-strip-main">
    <audio bind:this={audio1} style="display: none;" loop></audio>
    <audio bind:this={audio2} style="display: none;" loop></audio>

{#if engine}
    <div style="display: grid; grid-template-rows: 1fr auto; height: 100%;">
        <div>
            <div class="strip-name-ele">
                Ambience
            </div>
            <div style="width: 6em;" class="strip-name-ele">
                <div style="text-align: center;">
                    <div>
                        <select bind:value={selectedResourceValue} onchange={()=>{loadResource(selectedResourceValue)}}>
                            <option value="" disabled selected>Select Ambience</option>
                            <option value="NULL" >None</option>
                            {#each resources as resource, index}
                                <option value={index}>
                                    {resource.name}
                                </option>
                            {/each}
                        </select>
                    </div>
                </div>
            </div>
        </div>

        <div>
            <div style="text-align: center;" class="strip-name-ele">
                <div>Gain</div>
                <div>
                    {formatGain(engine.masterGain.gain.value)}
                </div>
            </div>
            <div style="margin: auto; width: fit-content; height: 200px; padding: 8px 0;">
                <VSlider bind:value={engine.masterGain.gain.value} min={-60} max={0} step={1} logarithmic onchange={scheduleSaveSettings}/>
            </div>
        </div>

    </div>
{/if}
</div>

<style>
    select {
        width: 100%;
        box-sizing: border-box;
        background-color: var(--theme-slider-accent);
        color: #000A;
        font-family: monospace;
    }

    .strip-name-ele {
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
        width: fit-content;
        background-color: rgb(50, 50, 54);
        padding: 6px;
        border: 4px solid var(--theme-slider-trim);
        border-radius: 8px;
        box-shadow: 0 0 10px #0006 inset, 0px 4px 8px 0px #0009;
    }
</style>
