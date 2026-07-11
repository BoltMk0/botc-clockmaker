<script lang="ts">
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
</script>

<svg viewBox="0 0 20 100" x="{x}" y="{y}" width="{width}" height="{height}" preserveAspectRatio="none">
    <rect x={8} y={7} width={4} height={100}/>
    <circle cx={10} cy={50} r={7}/>
    <circle cx={10} cy={35} r={5}/>
</svg>