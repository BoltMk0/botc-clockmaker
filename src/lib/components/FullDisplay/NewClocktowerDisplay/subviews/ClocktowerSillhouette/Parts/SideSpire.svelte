<script lang="ts">
    import { getNewClocktowerThemeContext } from "$lib/components/FullDisplay/NewClocktowerDisplay/model/theme";
    import BuntingFlag from "../Bunting/BuntingFlag.svelte";
    import Flag from "./Flag.svelte";
    import Pillar from "./Pillar.svelte";
    import Spike from "./Spike.svelte";

    let {
        x,
        y,
        width,
        height
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
    } = $props();

    const theme = getNewClocktowerThemeContext();
</script>

<svg class="side-spire" viewBox="0 0 100 100" x="{x}" y="{y}" width="{width}" height="{height}" preserveAspectRatio="none">

    <!-- CONE -->
    <svg x={7} y={20} width={86} height={51} viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points="0,100 25,65 50,10 75,65 100,100"/>
        <polygon points="0,100 25,65 50,10 40,60 25,100" style="fill: {theme.baseSecondary}; transition: fill 0.5s ease;"/>
    </svg>

    <!-- <Pillar x={0} y={90} height={10} width={100} numPillars={10} borderY={20}/> -->
    <Pillar x={10} y={75} height={16} width={80} numPillars={1} borderX={10}/>
    <Pillar x={0} y={90} height={10} width={100} numPillars={1} borderX={10} borderY={30}/>
    <Pillar x={5} y={70} height={5} width={90} numPillars={7} borderX={10} borderY={30}/>
    

    <Spike x={45} y={10} width={10} height={20}/>

    <Flag x={50} y={21} width={28} height={6} fill={theme.buntingColorBase}/>

    <!-- WINDOW -->
    <rect x={39} y={82} width={20} height={8}/>
    <ellipse cx={49} cy={82} rx={10} ry={5}/>
</svg>
