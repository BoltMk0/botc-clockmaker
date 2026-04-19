<script lang="ts">
    import Pillar from "./Parts/Pillar.svelte";
    import SideSpire from "./Parts/SideSpire.svelte";
    import Spike from "./Parts/Spike.svelte";
    export let hue: string|null = null;
    export let style: string = "";
</script>

<svg class="clocktower-sillhouette-main" viewBox="0 0 100 150" style="{hue ? `--clocktower-color-base: ${hue};` : ''} {hue ? "--clocktower-color-highlight: hsl(from var(--clocktower-color-base) calc(h + 20) calc(s*1.2) 70% / 0.1);":""} fill: var(--clocktower-color-base); transition: fill 1s; {style}">
    
    <!-- BASE -->
    <svg x="15" y="100" width="70" height="60" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="5" y="0" width="90" height="100"/>
        
        <Pillar x={5} y={20} width={12} height={85} numPillars={5} borderX={10}/>
        <Pillar x={83} y={20} width={12} height={85} numPillars={5} borderX={10}/>
        
        <Pillar x={0} y={5} width={100} height={3} borderY={25} numPillars={1}/>
        <Pillar x={0} y={0} width={100} height={5} borderY={20} numPillars={40}/>

        <!-- <rect x="2" y="4" width="18" height="12" fill="#333"/> -->
        <Pillar x={3} y={8} width={16} height={12} borderY={10} borderX={10} numPillars={4}/>
        <Pillar x={81} y={8} width={16} height={12} borderY={10} borderX={10} numPillars={4}/>
    </svg>


    <!-- CLOCK CONTAINER -->
    <svg x="10" y="40" width="80" height="60" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect x="2" y="0" width="96" height="100"/>
        <Pillar x={2} y={20} width={16} height={80} borderY={2} borderX={10} numPillars={6}/>
        <Pillar x={82} y={20} width={16} height={80} borderY={2} borderX={10} numPillars={6}/>

        <Pillar x={2} y={8} width={16} height={12} borderY={10} borderX={10} numPillars={4}/>
        <Pillar x={82} y={8} width={16} height={12} borderY={10} borderX={10} numPillars={4}/>


        <Pillar x={0} y={5} width={100} height={3} borderY={25} numPillars={1}/>
        <Pillar x={0} y={0} width={100} height={5} borderY={20} numPillars={40}/>
    </svg>


    <!-- ROOF-->
    <svg x={20} y={0} width={60} height={40} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="0,100 0,90 30,30 30,25 70,25 70,30 100,90 100,100"/>
        <Pillar x={30} y={20} width={40} height={10} numPillars={20} borderY={20}/>
        <Spike x={30} y={0} width={3} height={20}/>
        <Spike x={67} y={0} width={3} height={20}/>
    </svg>


    <!-- SPIRES -->
    <SideSpire x={10} y={0} width={16} height={40}/>
    <SideSpire x={74} y={0} width={16} height={40}/>
</svg>