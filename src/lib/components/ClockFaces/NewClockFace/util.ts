export function getColorForProgress(progress: number, hue: number){
    const MIN_SATURATION = 0.7;
    const MAX_SATURATION = 0.7;
    const MIN_BRIGHTNESS = 0.8;
    const MAX_BRIGHTNESS = 0.8;
    const HUE_SHIFT = 50;

    const adjTimeOfDay = Math.abs(progress)%1;
    const sunBrightness = Math.sin((0.1 + 0.8*adjTimeOfDay)*Math.PI);
    const backgroundBrightness = MIN_BRIGHTNESS + (MAX_BRIGHTNESS-MIN_BRIGHTNESS)*sunBrightness;

    const color = `hsl(${(hue + sunBrightness*HUE_SHIFT).toFixed(2)}, ${(MIN_SATURATION + (MAX_SATURATION-MIN_SATURATION) * sunBrightness)*100}%, ${backgroundBrightness*100}%)`;

    return {color, sunBrightness, adjTimeOfDay};
}