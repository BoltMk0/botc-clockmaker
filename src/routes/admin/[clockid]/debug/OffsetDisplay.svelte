<script lang="ts">
    import type { ClockClientModel } from "$lib/client/model";
    import { onDestroy, onMount } from "svelte";

    export let model: ClockClientModel;


    let values: number[] = [];
    let filteredAvg: number = 0;
    let minDelta: number|null = null;

    let timeout: ReturnType<typeof setTimeout>|null = null;

    function updateValues() {
        timeout = setTimeout(()=>{
            values = model.deltaTimeManager.deltaToServerTime;
            filteredAvg = model.deltaTimeManager.avgDeltaToServerTime;
            minDelta = model.deltaTimeManager.minDeltaToServerTime;
            updateValues();
        }, 1000);
    }

    onMount(()=>{
        updateValues();
    });

    onDestroy(()=>{
        if(timeout){
            clearTimeout(timeout);
        }
    });

</script>

<div class="offset-display">
    <svg viewBox="0 0 450 200" class="graph">
        <!-- Grid lines -->
        <line x1="50" y1="100" x2="450" y2="100" stroke="#333" stroke-width="0.5" />
        
        <!-- Average line (dotted) -->
        {#if values.length > 0}
            {@const min = Math.min(...values, filteredAvg)}
            {@const max = Math.max(...values, filteredAvg)}
            {@const range = max - min || 1}
            {@const avgY = 180 - ((filteredAvg - min) / range) * 160}
            {@const minY = minDelta !== null ? 180 - ((minDelta - min) / range) * 160 : null}
            
            <!-- Y-axis labels -->
            <text x="5" y="25" class="axis-label">{Math.round(max)}ms</text>
            <text x="5" y="105" class="axis-label">{Math.round((max + min) / 2)}ms</text>
            <text x="5" y="185" class="axis-label">{Math.round(min)}ms</text>
            
            <line 
                x1="50" 
                y1={avgY} 
                x2="450" 
                y2={avgY} 
                stroke="#4ade80" 
                stroke-width="2" 
                stroke-dasharray="5,5" 
            />
            <line 
                x1="50" 
                y1={minY} 
                x2="450" 
                y2={minY} 
                stroke="#4ade80" 
                stroke-width="2" 
                stroke-dasharray="5,5" 
            />
            
            <!-- Data points line -->
            {#if values.length > 1}
                {@const step = 400 / (values.length - 1)}
                <polyline
                    points={values.map((v, i) => {
                        const x = 50 + i * step;
                        const y = 180 - ((v - min) / range) * 160;
                        return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#60a5fa"
                    stroke-width="2"
                />
            {/if}
        {/if}
    </svg>
</div>

<style>
    .offset-display {
        width: 100%;
        max-width: 600px;
        margin: 1rem auto;
    }
    
    .graph {
        width: 100%;
        height: auto;
        background: #1a1a1a;
        border-radius: 8px;
        padding: 10px;
    }
    
    :global(.axis-label) {
        fill: #888;
        font-size: 12px;
        font-family: monospace;
        text-anchor: start;
    }
</style>
