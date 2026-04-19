<script lang="ts">
    import { getSkyColor } from "../../util";

    export let nsteps: number = 10;


    let colors = Array.from({length: nsteps}, (_, i) => {
        let t = i/(nsteps-1);
        return getSkyColor(t);
    });

</script>

<style>
    .sky-color-swatch {
        width: 100%;
        height: 50px;
    }
</style>

<div class="sky-color-swatch" style="background: linear-gradient(to right, {colors.join(', ')});">

</div>