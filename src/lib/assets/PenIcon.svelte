<script lang="ts">
    export let color: string = 'currentColor';
    export let style: string = '';

    $: svgStyle = style ? `${style}; color: ${color};` : `color: ${color};`;
</script>

<svg
    viewBox="0 0 24 40"
    xmlns="http://www.w3.org/2000/svg"
    style={svgStyle}
    aria-hidden="true"
    focusable="false"
>
    <path
        stroke="currentColor"
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 2 L22 22 L22 36 L16 38 L8 38 L2 36 L2 22 Z M2 22 L8 24 L16 24 L22 22 M8 24 L8 38 Z M16 24 L16 38 Z" />
    
    <path fill="currentColor" d="M12 2 L18 14 L15 16 L9 16 L6 14 Z" />
</svg>