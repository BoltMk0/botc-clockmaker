<script lang="ts">
    let { color, style = "" }: { color: string; style?: string } = $props();
</script>

<!-- An eraser block tipped onto its working corner, with a darker sleeve over its back half. -->
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="{style}" aria-hidden="true" focusable="false">
    <g transform="rotate(-45 12 12)">
        <rect x="2" y="7.5" width="20" height="9" rx="2" fill="{color}"/>
        <path d="M11 7.5 H20 A2 2 0 0 1 22 9.5 V14.5 A2 2 0 0 1 20 16.5 H11 Z" fill="#000" fill-opacity="0.35"/>
        <rect x="2" y="7.5" width="20" height="9" rx="2" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="1"/>
    </g>
</svg>
