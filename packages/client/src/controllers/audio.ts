import Util from '../utils/util';

import { Modules } from '@acacia/common/network';

import type Entity from '../entity/entity';
import type Game from '../game';

export default class AudioController {
    /** Duration for background music to fade in and out. */
    private readonly musicCrossfadeDuration = 3; // Crossfade for 3 seconds.

    /** Minimum gain for background music. */
    private readonly musicMinGain = 0.01;
    /** Maximum gain for background music. */
    private readonly musicMaxGain = 0.5;
    /** Additional gain multiplier for continuous footsteps. */
    private readonly footstepVolumeBoost = 1.5;
    /** Light music ducking applied while the footstep loop is active. */
    private readonly footstepMusicDuckMultiplier = 0.82;
    /** Fade duration for footstep-driven mix adjustments. */
    private readonly footstepMusicDuckDuration = 0.2;

    /** Save audio buffers. */
    private buffers: { [url: string]: Promise<AudioBuffer> } = {};

    /** The main audio context. */
    private context!: AudioContext;

    /** Gain node used to fade in/out the background music */
    private musicGainNode!: GainNode;

    /** Gain node used for the looping footstep channel. */
    private footstepGainNode?: GainNode;

    /** Current looping footstep source. */
    private footstepSource?: AudioBufferSourceNode;

    /** Used to discard outdated async footstep loads. */
    private footstepPlaybackToken = 0;

    /** Make sure there's only one gain node for music. */
    private isMusicConnected = false;

    /** Track the current music to avoid restarting the same song. */
    private currentMusic?: string;

    /** Track the currently looping footstep asset. */
    private currentFootstepSound?: string;

    /** Track a footstep asset currently being initialized asynchronously. */
    private pendingFootstepSound?: string;

    public constructor(private game: Game) {}

    /**
     * Creates an audio context (generally when player first interacts with the website).
     */

    public createContext(): void {
        this.context = new AudioContext();
    }

    /**
     * Plays a new sound.
     * @param sound - The sound to play.
     * @param target - The target to play the sound from.
     * If not specified, the sound will be played nonspatially.
     */

    public async playSound(sound: string, target?: Entity) {
        if (this.isAudioEnabled() === false) return;

        let source = await this.bufferSource(`/audio/sounds/${sound}.mp3`),
            soundVolume = this.getSoundVolume(),
            node = source.connect(new GainNode(this.context, { gain: soundVolume }));

        if (target && !this.getSettings().lowPowerMode) {
            let { tileSize } = this.game.map;

            // Create and connect a panner node for spatial sounds
            node = node.connect(
                new PannerNode(this.context, {
                    positionX: target.x,
                    positionY: target.y,
                    distanceModel: 'linear',
                    refDistance: tileSize,
                    maxDistance: tileSize * 10 // Maximum of 10 tiles.
                })
            );
        }

        node.connect(this.context.destination);

        let { gain } = this.musicGainNode;

        // Make sure the music stays dampened with multiple concurrent sounds.
        gain.cancelScheduledValues(this.context.currentTime);

        // Dampen the music by the sound volume.
        this.rampGain(gain, gain.value - (soundVolume * this.musicMaxGain) / 2);

        source.addEventListener('ended', () => {
            this.rampGain(gain, this.getTargetMusicVolume(), 0.5);
        });

        source.start();
    }

    /**
     * Starts or updates the looping footsteps channel for the local player.
     * @param sound - The footstep sound asset to loop.
     */

    public async startFootsteps(sound: string): Promise<void> {
        if (!this.context || this.isAudioEnabled() === false) return;

        if (this.currentFootstepSound === sound && this.footstepSource) {
            this.updateFootstepVolume();
            return;
        }

        if (this.pendingFootstepSound === sound) return;

        let token = ++this.footstepPlaybackToken;

        this.pendingFootstepSound = sound;
        this.stopFootsteps(false, false);

        try {
            let source = await this.bufferSource(`/audio/sounds/${sound}.mp3`);

            if (
                token !== this.footstepPlaybackToken ||
                this.pendingFootstepSound !== sound ||
                this.isAudioEnabled() === false
            )
                return;

            source.loop = true;

            let gainNode = new GainNode(this.context, { gain: this.getFootstepVolume() });

            source.connect(gainNode);
            gainNode.connect(this.context.destination);

            source.start();

            this.footstepSource = source;
            this.footstepGainNode = gainNode;
            this.currentFootstepSound = sound;
            this.pendingFootstepSound = undefined;

            this.updateMusicMix(this.footstepMusicDuckDuration);
        } catch (error) {
            if (token === this.footstepPlaybackToken && this.pendingFootstepSound === sound)
                this.pendingFootstepSound = undefined;

            throw error;
        }
    }

    /**
     * Stops the looping footsteps channel.
     */

    public stopFootsteps(invalidateToken = true, restoreMusic = true): void {
        if (invalidateToken) {
            this.footstepPlaybackToken++;
            this.pendingFootstepSound = undefined;
        }

        this.currentFootstepSound = undefined;

        if (this.footstepSource) {
            try {
                this.footstepSource.stop();
            } catch {
                // Source may already be stopped.
            }

            this.footstepSource.disconnect();
            this.footstepSource = undefined;
        }

        this.footstepGainNode?.disconnect();
        this.footstepGainNode = undefined;

        if (restoreMusic) this.updateMusicMix(this.footstepMusicDuckDuration);
    }

    /**
     * Plays background music, replacing any currently playing music.
     * @param music - The music to play. If not specified, it will stop the current music.
     */

    public async playMusic(music?: string) {
        if (!music) return this.stopMusic();
        if (music === this.currentMusic) return;

        let source = await this.bufferSource(`/audio/music/${music}.mp3`);
        source.loop = true;

        this.stopMusic();
        this.currentMusic = music;

        source.connect(this.musicGainNode);

        if (this.isAudioEnabled()) this.musicGainNode.connect(this.context.destination);

        this.rampGain(
            this.musicGainNode.gain,
            this.getTargetMusicVolume(),
            this.musicCrossfadeDuration
        );
        source.start();
    }

    /**
     * Loads and saves the buffer of an audio source.
     * @param url - The url of the audio to buffer.
     * @returns The audio buffer source node.
     */

    private async bufferSource(url: string) {
        this.updateVolume();

        this.buffers[url] ??= this.loadAudio(url);

        try {
            return new AudioBufferSourceNode(this.context, {
                buffer: await this.buffers[url]
            });
        } catch (error) {
            delete this.buffers[url];
            console.error(`Failed to load audio asset: ${url}`, error);
            throw error;
        }
    }

    /**
     * Loads and decodes an audio source into a buffer.
     * @param url - The url of the audio to load.
     * @returns The decoded audio source.
     */

    private async loadAudio(url: string) {
        let response = await fetch(url);

        if (!response.ok)
            throw new Error(`Failed to fetch audio asset: ${url} (${response.status})`);

        let arrayBuffer = await response.arrayBuffer(),
            audioBuffer = await this.context.decodeAudioData(arrayBuffer);

        return audioBuffer;
    }

    /**
     * Updates the volume of the music.
     * This is also where the audio context is initialized.
     */

    public updateVolume() {
        if (!this.musicGainNode) this.initMusicNode();

        let musicVolume = this.getMusicVolume(),
            targetMusicVolume = this.getTargetMusicVolume();

        if (musicVolume <= 0 || this.isAudioEnabled() === false) {
            if (this.isMusicConnected) {
                this.musicGainNode.disconnect(this.context.destination);
                this.isMusicConnected = false;
            }
        } else {
            let { gain } = this.musicGainNode;

            gain.cancelScheduledValues(this.context.currentTime);

            if (this.isMusicConnected) this.rampGain(gain, targetMusicVolume);
            else {
                this.musicGainNode.connect(this.context.destination);
                this.isMusicConnected = true;

                this.rampGain(gain, this.musicMinGain);
                this.rampGain(gain, targetMusicVolume, this.musicCrossfadeDuration);
            }
        }

        if (this.isAudioEnabled()) this.updateFootstepVolume();
        else this.stopFootsteps();
    }

    /**
     * Updates the current audio context listener with the position and orientation of the player.
     */

    public updatePlayerListener() {
        if (!this.context || this.isAudioEnabled() === false || this.getSettings().lowPowerMode)
            return;

        let { player } = this.game,
            { positionX, positionY, forwardX, forwardY } = this.context.listener;

        if (!positionX || !positionY || !forwardX || !forwardY) {
            this.context.listener.setPosition(player.x, player.y, 0);

            return;
        }

        positionX.value = player.x;
        positionY.value = player.y;

        switch (player.orientation) {
            case Modules.Orientation.Up: {
                forwardX.value = 0;
                forwardY.value = 1;
                break;
            }

            case Modules.Orientation.Down: {
                forwardX.value = 0;
                forwardY.value = -1;
                break;
            }

            case Modules.Orientation.Left: {
                forwardX.value = -1;
                forwardY.value = 0;
                break;
            }

            case Modules.Orientation.Right: {
                forwardX.value = 1;
                forwardY.value = 0;
                break;
            }
        }
    }

    /**
     * Stops any currently playing music, and initializes a new one.
     */

    public stopMusic() {
        this.currentMusic = undefined;

        let gainNode = this.musicGainNode;

        // Replace the current music node.
        this.initMusicNode();

        // Return if there's no music to stop.
        if (!gainNode) return;

        let { gain } = gainNode;

        gain.cancelScheduledValues(this.context.currentTime);
        this.rampGain(gain, this.musicMinGain, this.musicCrossfadeDuration);

        setTimeout(() => gainNode.disconnect(), this.musicCrossfadeDuration * 1000);
    }

    /**
     * (Re)initialize a new music node.
     */

    private initMusicNode() {
        this.musicGainNode = new GainNode(this.context, { gain: this.musicMinGain });
    }

    /**
     * Transitions the audio gain following a linear ramp.
     * @param gain - The audio parameter to ramp.
     * @param volume - The volume to ramp to. If less or equal to zero, the volume won't change.
     * @param duration - The duration to ramp by. If not specified, the ramp will be instant.
     */

    private rampGain(gain: AudioParam, volume: number, duration = 0) {
        if (volume > 0) gain.linearRampToValueAtTime(volume, this.context.currentTime + duration);
    }

    /**
     * Gets the sound volume from the settings.
     * @returns The sound volume.
     */

    private getSoundVolume(): number {
        return this.getSettings().soundVolume / 100;
    }

    /**
     * Gets the effective looping footstep volume from the settings.
     * @returns The footstep volume.
     */

    private getFootstepVolume(): number {
        return Math.min(1, this.getSoundVolume() * this.footstepVolumeBoost);
    }

    private updateFootstepVolume(): void {
        if (this.footstepGainNode) this.footstepGainNode.gain.value = this.getFootstepVolume();
    }

    private getTargetMusicVolume(): number {
        let musicVolume = this.getMusicVolume();

        return this.hasActiveFootsteps()
            ? musicVolume * this.footstepMusicDuckMultiplier
            : musicVolume;
    }

    private hasActiveFootsteps(): boolean {
        return Boolean(this.footstepSource || this.pendingFootstepSound);
    }

    private updateMusicMix(duration = 0): void {
        if (!this.musicGainNode || !this.context || !this.isMusicConnected) return;

        let { gain } = this.musicGainNode;

        gain.cancelScheduledValues(this.context.currentTime);
        this.rampGain(gain, this.getTargetMusicVolume(), duration);
    }

    /**
     * Gets the music volume from the settings.
     * @returns The music volume.
     */

    private getMusicVolume(): number {
        return (this.getSettings().musicVolume / 100) * this.musicMaxGain * 2;
    }

    /**
     * Gets whether or not the audio is enabled.
     * @returns `true` if the audio is enabled.
     */

    private isAudioEnabled(): boolean {
        return this.getSettings().audioEnabled;
    }

    /**
     * Gets the settings object from the game storage.
     * @returns The settings object.
     */

    private getSettings(): Game['storage']['data']['settings'] {
        return this.game.storage.data.settings;
    }

    public getCurrentMusic(): string | undefined {
        return this.currentMusic;
    }

    /**
     * Picks between the two possible hit sound effects
     * and plays one of them randomly.
     * @param target The target used for dimensional audio.
     */

    public playHitSound(target: Entity): void {
        this.playSound(`hit${Util.randomInt(1, 2)}`, target);
    }

    /**
     * Plays one of the kill sound effects randomly.
     * @param target The target used for dimensional audio.
     */

    public playKillSound(target: Entity): void {
        this.playSound(`kill${Util.randomInt(1, 2)}`, target);
    }

    /**
     * Plays one of the mining sound effects randomly.
     * @param target The target used for dimensional audio.
     */

    public playMiningSound(target: Entity): void {
        this.playSound(`mining${Util.randomInt(1, 3)}`, target);
    }

    /**
     * Plays one of the chopping sound effects randomly.
     * @param target The target used for dimensional audio.
     */

    public playChoppingSound(target: Entity): void {
        this.playSound(`wood${Util.randomInt(1, 4)}`, target);
    }
}
