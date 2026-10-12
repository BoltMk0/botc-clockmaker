<script lang="ts">
    let { size = 16, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} focusable="false">
    <path d="M7 17a5 5 0 0 1 10 0z" />
    <g stroke={color} stroke-width="2" stroke-linecap="round">
        <line x1="1" y1="20" x2="23" y2="20" />
        <line x1="12" y1="6" x2="12" y2="8" />
        <line x1="4.22" y1="9.22" x2="5.64" y2="10.64" />
        <line x1="18.36" y1="10.64" x2="19.78" y2="9.22" />
        <line x1="1" y1="17" x2="3" y2="17" />
        <line x1="21" y1="17" x2="23" y2="17" />
    </g>
</svg>
