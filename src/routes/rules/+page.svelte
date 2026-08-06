<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types';
    import PillIndexDisplay from './PillIndexDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    const SLIDE_INTERVAL = 14000 as const;
    const {data}: {data: PageData} = $props();

    const {slides} = $derived(data);
    
    $inspect(data);

    let slideIdx = $state(0);
    let imgEle: HTMLImageElement|undefined = $state(undefined);
    let barEle: HTMLDivElement|undefined = $state(undefined);

    let nextSlideTimeout: ReturnType<typeof setTimeout>|null = null;

    function resetTimerBar(){
        if(!barEle) return;
        barEle.style.transition = 'none';
        barEle.style.width = '0%';
    }

    function startTimerBar(){
        if(!barEle) return;
        // Force reflow so the width:0% is applied before the transition starts
        barEle.offsetHeight;
        barEle.style.transition = `width ${SLIDE_INTERVAL}ms linear`;
        barEle.style.width = '100%';
    }

    function setSlideIndex(idx: number){
        if(!imgEle) return;
        slideIdx = idx % slides.length;
        if(nextSlideTimeout) clearTimeout(nextSlideTimeout);
        let timeoutDuration = imgEle.style.opacity !== '1' ? 0 : 1000;
        imgEle.style.opacity = '0';
        resetTimerBar();
        nextSlideTimeout = setTimeout(()=>{
            if(!imgEle) return;
            imgEle.src = `/api/resources/${slides[slideIdx].id}`;
            imgEle.onload = ()=>{
                if(!imgEle) return;
                imgEle.style.opacity = '1';
                startTimerBar();
                nextSlideTimeout = setTimeout(()=>{
                    setSlideIndex(slideIdx+1);
                }, SLIDE_INTERVAL)
            }
        }, timeoutDuration);
    }

    onMount(()=>{
        setSlideIndex(0);
    })

</script>


{#if slides && slides.length > 0}
<div style="position: relative; height: 100%; width: 100%; overflow: hidden;">
    <img bind:this={imgEle} alt="Slide {slideIdx+1}" src=""/>
    <div class="overlay">
        <div class="pill-row">
            <PillIndexDisplay count={slides.length} index={slideIdx} onpillclick={(idx)=>{setSlideIndex(idx)}} style="padding: 0.5em"/>
        </div>
        <div class="timer-bar-track">
            <div class="timer-bar-fill" bind:this={barEle}></div>
        </div>
    </div>
</div>
{:else}
    No rules to show
    <a href="/settings/resources">Upload Slides</a>
{/if}

<Navbar/>

<style>
    img {
        opacity: 0;
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
        transition: opacity 1s ease;
    }

    .overlay {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        background: linear-gradient(to top, rgba(0, 0, 0, 0.6), transparent);
    }

    .pill-row {
        display: flex;
        justify-content: center;
    }

    .timer-bar-track {
        width: 100%;
        height: 2px;
        background: var(--theme-background);
        overflow: hidden;
        flex-shrink: 0;
    }

    .timer-bar-fill {
        width: 0%;
        height: 100%;
        background: var(--theme-highlight);
    }
</style>

