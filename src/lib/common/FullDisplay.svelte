<script lang="ts">
    import type { ClientModel } from "$lib/client/model";
    import ClockDisplay from "./ClockDisplay.svelte";
    import DayDial from "./DayDial.svelte";
    import { getSkyColor } from "./util";

    export let model: ClientModel;

    export let size: number = 700;

    export let buttonColor: string = "black";

    let adjSize: number = size;
    

    $: border_radius = adjSize*0.03;


    let clock_info = model.clock_info;

    $: progress = 1- $clock_info.cur / $clock_info.max;

    $: console.log("Clock:", $clock_info);


    // On mount, check the screen dimentions and adjust size accordingly
    import { onMount } from "svelte";
    
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

</script>

<div class="full-display-main">
    <div class="container" style="font-size: {adjSize/15}px; width: {adjSize}px; height: {adjSize}px; padding: {border_radius}px; background: radial-gradient(closest-side at center, #0000 0px, #0000 {adjSize/2-border_radius}px, #000F {adjSize/2-border_radius}px, {getSkyColor(progress, 1, 1, 0.8)} {adjSize/2-border_radius*0.85}px, #223 {adjSize/2-border_radius*0.5}px);">
        <ClockDisplay clock_info={model.clock_info} size={adjSize-border_radius*2}/>
        <DayDial day_info={model.day_info} clockData={model.clock_info} size={adjSize-border_radius*2}/>            
        <button aria-label="Ring bell" on:click={()=>{model.playBellSound()}} class="clock-hand-cap" style="background: radial-gradient(closest-side at center, {buttonColor} 89%, {buttonColor} 93%, {getSkyColor(progress, 1, 1, 0.5)} 100%); box-shadow: 0px 0px {adjSize/20}px {getSkyColor(progress, 0.2, 1, 1)} inset, -2px -10px 5px -5px #0008 inset, 0 0 {adjSize/2}px {getSkyColor(progress, 1, 2)}, 0 5px 5px -5px black;"></button>
        
        <!-- <div class="dial-shadow" style="top: {border_radius}px; bottom: {border_radius}px; left: {border_radius}px; right: {border_radius}px; box-shadow: 0 0 {adjSize*0.25}px {getSkyColor(progress, 1, 0.5, 0.1)} inset, 2px 10px 10px -5px #111C inset, 0 0 {adjSize*0.1}px #1118 inset;"></div> -->
        <div class="dial-shadow" style="top: {border_radius}px; bottom: {border_radius}px; left: {border_radius}px; right: {border_radius}px; background: radial-gradient(closest-side at center, {getSkyColor(progress, 0, 0.5, 0.1)} 75%, {getSkyColor(progress, 0.1, 0.5, 0.1)} 90%, {getSkyColor(progress, 0.3, 0.5, 0.1)} 100%); box-shadow: 0 0 {size/3}px #2116 inset;"></div>
    </div>
</div>

<style>

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
        aspect-ratio: 1/1;
        padding: 10px;
        box-sizing: border-box;
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