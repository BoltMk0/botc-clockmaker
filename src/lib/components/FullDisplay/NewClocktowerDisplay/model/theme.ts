import { getContext, setContext } from "svelte";

interface NewClocktowerTheme {
    buntingColorBase: string;
    basePrimary: string;
    baseSecondary: string;
    clockfaceColorPrimary: string;
    clockfaceColorSecondary: string;
    clockfaceColorHighlight: string;
    clockfaceTextColor: string;
    panelColorPrimary: string;
    panelColorSecondary: string;
    panelTextColor: string;
    skyColor: string;
    skyBrightness: number;
}

const CONTEXT_KEY = 'NewClocktowerTheme'

export function getNewClocktowerThemeContext(){
    return getContext<NewClocktowerTheme>(CONTEXT_KEY);
}

export function setNewClocktowerThemeContext(value: NewClocktowerTheme){
    setContext<NewClocktowerTheme>(CONTEXT_KEY, value);
    return value;
}
