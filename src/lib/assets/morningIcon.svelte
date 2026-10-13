<script lang="ts">
    let { size = 16, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} focusable="false">
    <path d="M7 17a5 5 0 0 1 10 0z" />
    <g stroke={color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">
        <line x1="1" y1="20" x2="23" y2="20" />
        <polyline points="9,5 12,2 15,5" />
        <line x1="12" y1="2" x2="12" y2="9" />
        <line x1="1" y1="17" x2="3" y2="17" />
        <line x1="21" y1="17" x2="23" y2="17" />
    </g>
</svg>
