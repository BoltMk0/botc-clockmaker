<script lang="ts">
    import { getNewClocktowerThemeContext } from "../../../model/theme";

    let {
        x,
        y,
        width,
        height,
        color,
        rotate=undefined,
        style = ''
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
        color: string;
        style?: string;
        rotate?: string|number
    } = $props();


    const theme = getNewClocktowerThemeContext()

    const rotateDeg = $derived(
        typeof rotate === 'number' ? rotate : rotate !== undefined ? parseFloat(rotate) : undefined
    );

</script>

<svg
    viewBox="0 0 100 100"
    x="{x}"
    y="{y}"
    width="{width}"
    height="{height}"
    preserveAspectRatio="none"
    style="fill: {color}; {style};"
    transform={rotateDeg !== undefined ? `rotate(${rotateDeg} ${x + width / 2} ${y})` : undefined}
>
    <polygon points="0,0 50,100 100,0" style="fill: {theme.baseSecondary}"/>
    <polygon points="3,0 97,0 50,94"/>
</svg>