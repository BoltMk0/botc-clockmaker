<script lang="ts">
    import type { ClockClientModel, ClientModelListenerType } from "$lib/client/model";

    const NOTIFICATION_TIMEOUT = 10000;

    export let model: ClockClientModel;
    export let models: ClockClientModel[] = [];
    export let type: FullDisplayMode = "original";

    export let size: number = 700;

    let otherClockNotificationPresent: boolean = false;
    let showInstructionText: boolean = false;
    let instructionText: string = "";
    let instructionTimeout: NodeJS.Timeout | undefined = undefined;
    let otherClockNotificationTimeout: NodeJS.Timeout | undefined = undefined;


    function setInstruction(text: string) {
        if(instructionTimeout){
            clearTimeout(instructionTimeout);
        }
        instructionText = text;
        showInstructionText = true;
        instructionTimeout = setTimeout(()=>{
            showInstructionText = false;
        }, NOTIFICATION_TIMEOUT);
    }

    const removeListener = model.addListener({
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

    for(const m of models){
        if(m !== model){
            m.addListener(otherModelListener);
        }
    }

    let clock_info = model.clock_info;
    let day_info = model.day_info;
    let playerCount = model.playerCount;

    $: progress = 1- $clock_info.cur / $clock_info.max;


    // On mount, check the screen dimentions and adjust size accordingly
    import { onDestroy, onMount } from "svelte";
    import type { FullDisplayMode } from "./fullDisplayTypes";
    import NewClocktower from "../NewClocktower.svelte";
    import SkyDisplay from "../ClockFaces/OldClockFace/SkyDisplay.svelte";
    import OldClockFace from "../ClockFaces/OldClockFace/OldClockFace.svelte";

    onDestroy(()=>{
        removeListener();
        for(const m of models){
            if(m !== model){
                m.removeListener(otherModelListener);
            }
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
    {#if type === "clocktower"}
        <SkyDisplay progress={progress} style=""/>
        <!-- <NewClocktower totalTime={220} timeRemaining={220*(1-minuteHandProgress)} hue={200} dayNumber={3} playerCount={10} style="top: 0; position: absolute;"/> -->
        <NewClocktower totalTime={$clock_info.max} timeRemaining={$clock_info.cur} hue={model.config.theme.hue} dayNumber={$day_info.day} playerCount={$playerCount} size={size} style="top: 0; position: absolute; font-size: {size/40}px;"/>
        <div class="clock-name-title dumbledore-font" style="font-size: {size/10}px; bottom: 0;">{model.config.teamName ?? model.clockId}</div>

    {:else if type === "original"}
        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
            <div class="clock-name-title dumbledore-font" style="font-size: {size/10}px; transform: translateY(-100%); height: 0.5em;">{model.config.teamName ?? model.clockId}</div>
            <OldClockFace totalTime={$clock_info.max} {progress} dayNumber={$day_info.day} {size} hue={model.config.theme.hue}/>
        </div>
    {:else}
        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
            <div class="clock-name-title dumbledore-font" style="font-size: {size/10}px; transform: translateY(-100%); height: 0.5em;">{model.config.teamName ?? model.clockId}</div>
            <SkyDisplay progress={progress} style=""/>
        </div>
    {/if}

    <div class="instruction-text-container" style="opacity: {showInstructionText ? "1" : "0"}; font-size: {size/15}px;">
        <div class="instruction-text">
            {instructionText}
        </div>
    </div>
</div>
