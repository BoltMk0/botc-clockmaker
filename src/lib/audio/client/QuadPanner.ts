/**
 * Pans a 4.0 signal (front left, front right, rear left, rear right): the same left/right pan on the front and the rear
 * pair, with a level for each pair. A StereoPannerNode can't do this itself, as it down-mixes anything it's given to stereo.
 *
 * Takes either a four-channel signal into `input`, or a stereo (or mono) one for each pair into `frontInput` and
 * `rearInput`; `output` is always four channels.
 */
export class QuadPanner {
    readonly #context: BaseAudioContext;
    readonly #frontPan: StereoPannerNode;
    readonly #rearPan: StereoPannerNode;
    readonly #output: ChannelMergerNode;
    #input: ChannelSplitterNode|null = null;
    /** Level of the front pair. */
    readonly front: GainNode;
    /** Level of the rear pair. */
    readonly rear: GainNode;

    constructor(context: BaseAudioContext){
        this.#context = context;
        this.#output = context.createChannelMerger(4);
        [this.#frontPan, this.front] = this.createPair(0);
        [this.#rearPan, this.rear] = this.createPair(2);
    }

    private createPair(firstChannel: number): [StereoPannerNode, GainNode] {
        const pan = this.#context.createStereoPanner();
        const level = this.#context.createGain();
        // A merger's inputs are mono, so the pair is split to put each side on its own channel
        const split = this.#context.createChannelSplitter(2);
        pan.connect(level).connect(split);
        split.connect(this.#output, 0, firstChannel);
        split.connect(this.#output, 1, firstChannel + 1);
        return [pan, level];
    }

    /**
     * Four-channel input. Built only when first asked for: a mono signal into `frontInput` would otherwise be summed with
     * this one's stereo pair, and so be panned as stereo - 3dB louder in the middle than a mono signal panned on its own.
     */
    get input(): AudioNode {
        if(this.#input === null){
            const split = this.#input = this.#context.createChannelSplitter(4);
            for(const [pan, first] of [[this.#frontPan, 0], [this.#rearPan, 2]] as const){
                const join = this.#context.createChannelMerger(2);
                split.connect(join, first, 0);
                split.connect(join, first + 1, 1);
                join.connect(pan);
            }
        }
        return this.#input;
    }
    get frontInput(): AudioNode { return this.#frontPan; }
    get rearInput(): AudioNode { return this.#rearPan; }
    get output(): AudioNode { return this.#output; }

    get pan(): number { return this.#frontPan.pan.value; }
    set pan(value: number){
        this.#frontPan.pan.value = value;
        this.#rearPan.pan.value = value;
    }
}

/**
 * Folds a 4.0 signal down to stereo for a level meter: each rear channel added to the front one on its side. An
 * AnalyserNode would otherwise average all four channels, reading a 4.0 signal with silent rears 6dB below the same
 * signal in stereo. A stereo signal passes through as it is.
 */
export function createMeterFold(context: BaseAudioContext): {input: AudioNode, output: AudioNode} {
    // Up-mixes anything with fewer channels as speakers would (stereo to the front pair, mono to both front speakers)
    const input = context.createGain();
    input.channelCount = 4;
    input.channelCountMode = 'explicit';
    input.channelInterpretation = 'speakers';
    const split = context.createChannelSplitter(4);
    input.connect(split);
    const join = context.createChannelMerger(2);
    // Connections into the same merger input are summed
    split.connect(join, 0, 0);
    split.connect(join, 2, 0);
    split.connect(join, 1, 1);
    split.connect(join, 3, 1);
    return {input, output: join};
}
