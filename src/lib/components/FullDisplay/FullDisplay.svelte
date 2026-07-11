<script lang="ts">
    import type { ClockClientModel, ClientModelListenerType } from "$lib/model/client/ClockClientModel";
    import { onDestroy } from "svelte";
    import NewClocktower from "../NewClocktower.svelte";
    import SkyDisplay from "../ClockFaces/OldClockFace/SkyDisplay.svelte";
    import OldClockFace from "../ClockFaces/OldClockFace/OldClockFace.svelte";
    import { appSettings } from "$lib/model/client/appSettings.svelte";
    import type { FullDisplayMode } from "./fullDisplayTypes";


    const NOTIFICATION_TIMEOUT = 10000;

    let {
        model,
        models = [],
        displayMode = undefined,
        size=undefined
    } : {
        model: ClockClientModel;
        models?: ClockClientModel[];
        displayMode?: FullDisplayMode;
        size?: number;
    } = $props();

    let otherClockNotificationPresent: boolean = $state(false);
    let showInstructionText: boolean = $state(false);
    let instructionText: string = $state("");


    let instructionTimeout: NodeJS.Timeout | undefined = undefined;
    let otherClockNotificationTimeout: NodeJS.Timeout | undefined = undefined;


    function setInstruction(text: string) {
        console.log("SETTINGS INSTRUCTION TO", text)
        if(instructionTimeout){
            clearTimeout(instructionTimeout);
        }
        instructionText = text;
        showInstructionText = true;
        instructionTimeout = setTimeout(()=>{
            showInstructionText = false;
        }, NOTIFICATION_TIMEOUT);
    }


    let removeModelListener: ()=>void;
    $effect(()=>{
        console.debug("Setting up model listener")
        if(removeModelListener) removeModelListener();
        removeModelListener = model.addListener( {
            onBellRingRequest: ()=>{
                setInstruction("Your Story Teller requires your attention!");
            },
            onReminderBellRing: ()=>{
                setInstruction("The end of the day is approaching...");
            },
            onFinalBellRing: ()=>{
                setInstruction("The day has ended! Please return to the Town Square.");
            }
        });
    });

    function onOtherModelNotification(){
        if(otherClockNotificationTimeout){
            clearTimeout(otherClockNotificationTimeout);
        }
        otherClockNotificationPresent = true;
        otherClockNotificationTimeout = setTimeout(()=>{
            otherClockNotificationPresent = false;
        }, NOTIFICATION_TIMEOUT);
    }

    const otherModelListener: ClientModelListenerType = {
        onBellRingRequest: onOtherModelNotification,
        onReminderBellRing: onOtherModelNotification,
        onFinalBellRing: onOtherModelNotification
    }

    $effect(()=>{
        for(const m of models){
            if(m !== model)
                m.addListener(otherModelListener);
            else {
                m.removeListener(otherModelListener);
            }
        }
    });

    let clock_info = $derived(model.clock_info);
    let day_info = $derived(model.day_info);
    let playerCount = $derived(model.playerCount);

    const progress = $derived(1- $clock_info.cur / $clock_info.max);

    const shownDisplayMode = $derived(displayMode ?? appSettings.displayMode);
    const shownSize = $derived(size ?? appSettings.size);

    // On mount, check the screen dimentions and adjust size accordingly

    onDestroy(()=>{
        removeModelListener();
        for(const m of models){
            m.removeListener(otherModelListener);
        }
    });

</script>



<style>
    .clock-name-title {
        display: block;
        text-align: center;
        width: 100%;
        transform: translateY(-100%);
        text-shadow: 0 0 5px #0008, 1px 2px 4px #000A;
        opacity: 0.9;
        margin: 0;
    }

    .instruction-text-container {
        transition: opacity 0.5s ease; 
        display: flex; 
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 20;
        font-family: monospace;
        padding: 0.6em;
        box-sizing: border-box;
        width: 100%;
        text-align: center;
    }

    .instruction-text {
        padding: 10px 20px; 
        background-color: #000A;
        color: white; 
        font-size: 1.5em; 
        border-radius: 10px; 
        box-shadow: 0 0 10px #0005, 0 0 20px #0008 inset;
    }
</style>
<div style="height: 100%;  width: 100%; overflow: hidden; position: relative; opacity: {otherClockNotificationPresent && !showInstructionText ? 0.6 : 1}; transition: opacity 0.5s ease;">
    {#if shownDisplayMode === "clocktower"}
        <SkyDisplay progress={progress} style=""/>
        <!-- <NewClocktower totalTime={220} timeRemaining={220*(1-minuteHandProgress)} hue={200} dayNumber={3} playerCount={10} style="top: 0; position: absolute;"/> -->
        <NewClocktower totalTime={$clock_info.max} timeRemaining={$clock_info.cur} hue={model.config.theme.hue} dayNumber={$day_info.day} playerCount={$playerCount} style="top: 0; position: absolute;"/>
        {#if appSettings.showClockNames}
        <div class="clock-name-title dumbledore-font" style="font-size: {shownSize/10}px; bottom: 0;">{model.config.teamName ?? model.clockId}</div>
        {/if}
    {:else if shownDisplayMode === "original"}
        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
            <div class="clock-name-title dumbledore-font" style="font-size: {shownSize/10}px; transform: translateY(-100%); height: 0.5em;">{model.config.teamName ?? model.clockId}</div>
            <OldClockFace totalTime={$clock_info.max} {progress} dayNumber={$day_info.day} size={size ?? shownSize} hue={model.config.theme.hue}/>
        </div>
    {:else}
        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
            <div class="clock-name-title dumbledore-font" style="font-size: {shownSize/10}px; transform: translateY(-100%); height: 0.5em;">{model.config.teamName ?? model.clockId}</div>
            <SkyDisplay progress={progress} style=""/>
        </div>
    {/if}

    <div class="instruction-text-container" style="opacity: {showInstructionText ? "1" : "0"}; font-size: {shownSize/15}px;">
        <div class="instruction-text">
            {instructionText}
        </div>
    </div>
</div>
