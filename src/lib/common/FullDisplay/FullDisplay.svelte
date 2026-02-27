<script lang="ts">
    import type { ClientModel, ClientModelListenerType } from "$lib/client/model";
    import ClockDisplay from "./ClockDisplay.svelte";
    import DayDial from "./DayDial.svelte";
    import { getSkyColor } from "$lib/common/util";

    const NOTIFICATION_TIMEOUT = 10000;

    export let model: ClientModel;
    export let models: ClientModel[] = [];

    export let size: number = 700;
    export let fontScale: number = 1;

    export let buttonColor: string = "black";
    export let onDayShift: ((delta: number)=>void) | undefined = undefined;
    export let onTimeShift: ((delta: number)=>void) | undefined = undefined;

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

    $: adjSize = size;
    
    const rimColor = model.config.theme.rimColor;

    $: console.log(rimColor)

    $: border_radius = adjSize*0.03;


    let clock_info = model.clock_info;

    $: progress = 1- $clock_info.cur / $clock_info.max;


    // On mount, check the screen dimentions and adjust size accordingly
    import { onDestroy, onMount } from "svelte";
    
    function updateSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const minDimension = Math.min(screenWidth, screenHeight);
        const maxSize = minDimension - 20;
        adjSize = Math.min(size, maxSize); // Use 700 as the base/max size
    }
    
    onMount(() => {
        updateSize();
        window.addEventListener('resize', updateSize);
        
        return () => {
            window.removeEventListener('resize', updateSize);
        };
    });

    onDestroy(()=>{
        removeListener();
        for(const m of models){
            if(m !== model){
                m.removeListener(otherModelListener);
            }
        }
    });

    $: shouldHideClock = otherClockNotificationPresent && !showInstructionText;

</script>

<div class="full-display-main" style="scale: {shouldHideClock ? 0.9 : 1}; opacity: {shouldHideClock ? 0.7 : 1}; transition: all 0.5s ease;">
    {#if model.config.teamName}
    <a class="clock-name-title" style="font-size: {size/10}px" href="/{model.clockId}">{model.config.teamName}</a>
    {/if}
    <div class="container" style="font-size: {fontScale*adjSize/15}px; width: {adjSize}px; height: {adjSize}px; padding: {border_radius}px; background: radial-gradient(closest-side at center, #0000 0px, #0000 {adjSize/2-border_radius}px, #000F {adjSize/2-border_radius}px, {getSkyColor(progress, 1, 1, 0.8)} {adjSize/2-border_radius*0.85}px, {rimColor} {adjSize/2-border_radius*0.5}px); box-shadow: {showInstructionText ? `0 0 50px ${model.config.theme.rimColor}` : "none"};">
        <ClockDisplay model={model} size={adjSize-border_radius*2}/>
        <DayDial model={model} size={adjSize-border_radius*2}/>            
        <div class="shiftButtonsTopContainer">
            <div class="shiftButtonsContainer">
                {#if onTimeShift !== undefined}
                <button class="timerShiftButton" onclick={()=>{onTimeShift(-15)}}>
                    -15
                </button>
                <button class="timerShiftButton" onclick={()=>{onTimeShift(15)}}>
                    +15
                </button>
                {/if}
            </div>
            
            <div class="shiftButtonsContainer" style="margin: 0 10px;">
                {#if onDayShift !== undefined}
                <button class="dayShiftButton" onclick={()=>{onDayShift(-1)}}>
                    -
                </button>
                <button class="dayShiftButton" onclick={()=>{onDayShift(1)}}>
                    +
                </button>
                {/if}
            </div>
        </div>
        <button aria-label="Ring bell" onclick={()=>{model.finalBellRinger?.ringBell()}} class="clock-hand-cap" style="background: radial-gradient(closest-side at center, {buttonColor} 30%, #111 50%, #111 83%, {getSkyColor(progress, 1, 1, 0.9)} 100%); box-shadow: 0px 0px {adjSize/25}px {getSkyColor(progress, 0.4, 1, 1)} inset, -2px -10px 5px -5px #0008 inset, 0 0 {adjSize/2}px {getSkyColor(progress, 1, 1.8)}, 1px 1px 2px 0 #FDC7 inset, -1px -1px 2px 0 #0007 inset, 0.4px 2px 4px -1px #0005;"></button>

        <!-- <div class="dial-shadow" style="top: {border_radius}px; bottom: {border_radius}px; left: {border_radius}px; right: {border_radius}px; box-shadow: 0 0 {adjSize*0.25}px {getSkyColor(progress, 1, 0.5, 0.1)} inset, 2px 10px 10px -5px #111C inset, 0 0 {adjSize*0.1}px #1118 inset;"></div> -->
        <div class="dial-shadow" style="top: {border_radius}px; bottom: {border_radius}px; left: {border_radius}px; right: {border_radius}px; background: radial-gradient(closest-side at center, {getSkyColor(progress, 0, 0.5, 0.1)} 75%, {getSkyColor(progress, 0.1, 0.5, 0.1)} 90%, {getSkyColor(progress, 0.3, 0.5, 0.1)} 100%); box-shadow: 0 0 {size/3}px #2116 inset;"></div>
    </div>

    <div class="instruction-text-container" style="opacity: {showInstructionText ? "1" : "0"}; font-size: {size/15}px;">
        <div class="instruction-text">
            {instructionText}
        </div>
    </div>
</div>

<style>

a {
    color: inherit;
    text-decoration: none;
}

.clock-name-title {
    display: block;
    font-family: monospace;
    text-align: center;
    width: 100%;
    height: 0.8em;
    transform: translateY(-50%);
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

    .shiftButtonsTopContainer {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: grid;
        grid-template-rows: 1fr 1fr;
        z-index: 10;
    }

    .shiftButtonsContainer button {
        background: none;
        border: none;
        font-family: monospace;
        cursor: pointer;
    }

    .shiftButtonsContainer {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .timerShiftButton {
        padding-top: 25%;
        font-size: x-large;
        color: #1119
    }

    .dayShiftButton {
        color: #AAAA;
        padding-bottom: 25%;
        font-size: xx-large;
    }

    .dayShiftButton:hoer {
        color: white;
    }

    .clock-hand-cap {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10%;
        aspect-ratio: 1/1;
        border: 0;
        border-radius: 9999em;
        cursor: pointer;
        z-index: 10;
    }

    .full-display-main {
        margin: auto;
        width: fit-content;
        padding: 10px;
        box-sizing: border-box;
        position: relative;
    }

    .container {
        position: relative;
        box-sizing: border-box;
        background-color: black;
        aspect-ratio: 1/1;
        box-shadow: 0 0 5px #0005, 2px 8px 4px -7px #e9e2d1aa inset, 0px -3px 5px -1px #0009 inset, 2px -5px 3px -3px #F424 inset, 5px 10px 10px -5px #0005, 20px 40px 40px 0px #0002;
        border-radius: 99999em;
        transition: background 1s ease;
    }

    .dial-shadow {
        position: absolute;
        border-radius: 9999em;
        transition: background 1s ease;
        /* box-shadow: 0 0 150px rgba(0, 0, 0, 1) inset, 0 10px 10px -5px rgba(0, 0, 0, 0.5) inset; */
    }
</style>