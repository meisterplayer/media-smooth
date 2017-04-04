// HASPlayer is not a module. We include it via ES6 imports and use the Global set MediaPlayer.
import GlobalMediaPlayer from './lib/hasplayer'; //eslint-disable-line

const MediaPlayer = window.MediaPlayer;

class Smooth extends Meister.MediaPlugin {
    constructor(config, meister) {
        super(config, meister);

        this.mediaPlayer = null;
        this.isLive = false;
        this.bitrates = [];
    }

    static get pluginName() {
        return 'Smooth';
    }

    isItemSupported(item) {
        return new Promise((resolve) => {
            if (item.type !== 'smooth' && item.type !== 'mss') {
                return resolve({
                    supported: false,
                    errorCode: Meister.ErrorCodes.WRONG_TYPE,
                });
            }

            if (!window.MediaSource) {
                return resolve({
                    supported: false,
                    errorCode: Meister.ErrorCodes.NOT_SUPPORTED,
                });
            }

            // Make sure we can play smooth with DRM.
            if (item.drm || item.drmConfig) {
                this.meister.one('drmKeySystemSupport', (supportedDRMSystems) => {
                    let supported = false;

                    // Smooth only supports PlayReady.
                    Object.keys(supportedDRMSystems).forEach((key) => {
                        if (key === 'com.microsoft.playready' && supportedDRMSystems[key]) {
                            supported = true;
                        }
                    });

                    return resolve({
                        supported,
                        errorCode: supported ? null : Meister.ErrorCodes.NO_DRM,
                    });
                });

                this.meister.trigger('requestDrmKeySystemSupport', {});
            } else {
                return resolve({
                    supported: true,
                });
            }
        });
    }

    process(item) {
        return new Promise((resolve, reject) => {
            this.player = this.meister.getPlayerByType('html5', item);

            if (this.player) {
                resolve(item);
            } else {
                reject(`${this.name}: Unable to play item ${item.src}, no player available.`);
            }
        });
    }

    hasPlayerLoadHack() {
        // Use a timeout so the eventHandler block for meister error is removed.
        setTimeout(() => {
            // HAS player sometimes uses the hostname as the video src, but resolves it on its own later.
            if (this.meister.playerPlugin.mediaElement.currentSrc === `${location.protocol}//${location.host}/`) {
                console.info('Ignoring error: strange HAS player behaviour.');
            } else {
                // Throw error anyway.
                this.meister.error('Media not found', Meister.ErrorCodes.NO_MEDIA_FOUND);
            }
            // Rearm the override.
            this.one('error', true, this.hasPlayerLoadHack.bind(this));
        }, 1);
    }

    load(item) {
        super.load(item);

        // Add potential error event override for bogus HAS player error.
        this.one('error', true, this.hasPlayerLoadHack.bind(this));

        return new Promise((resolve) => {
            this.mediaPlayer = new MediaPlayer();
            this.mediaPlayer.init(this.meister.playerPlugin.mediaElement);
            this.mediaPlayer.load({
                url: item.src,
            });

            // this.mediaPlayer.getDebug().setLevel(4);

            this.attachEvents();
            resolve();
        });
    }

    unload() {
        super.unload();

        if (this.mediaPlayer) {
            this.mediaPlayer.stop();
            this.mediaPlayer.reset();
            this.mediaPlayer = null;
        }

        this.isLive = false;
        this.bitrates = [];
    }

    attachEvents() {
        this.on('_playerTimeUpdate', this._onPlayerTimeUpdate.bind(this));
        this.on('_playerSeek', this._onPlayerSeek.bind(this));
        this.on('requestSeek', this.onRequestSeek.bind(this));
        this.on('requestBitrate', this.onRequestBitrate.bind(this));

        this.mediaPlayer.eventBus.addEventListener('manifestLoaded', this.onManifestLoaded.bind(this));
    }

    onManifestLoaded(e) {
        if (e.data.mediaPresentationDuration === Infinity) {
            this.isLive = true;
        }

        const adaptionSets = e.data.Period.AdaptationSet;
        const bitrates = [];

        bitrates.push({
            bitrate: 0,
            index: -1,
        });

        adaptionSets.forEach((adaptationSet) => {
            if (adaptationSet.id === 'video') {
                const representations = adaptationSet.Representation;
                representations.reverse();

                representations.forEach((representation, index) => {
                    bitrates.push({
                        bitrate: representation.bandwidth,
                        index,
                    });
                });
            }
        });

        this.bitrates = bitrates;

        this.meister.trigger('itemTimeInfo', {
            isLive: this.isLive,
            hasDVR: false,
        });

        this.meister.trigger('itemBitrates', {
            bitrates,
            currentIndex: -1,
        });
    }

    _onPlayerTimeUpdate() {
        this.meister.trigger('playerTimeUpdate', {
            currentTime: this.meister.currentTime,
            duration: this.meister.duration,
        });
    }

    _onPlayerSeek() {
        const currentTime = this.meister.currentTime;
        const duration = this.meister.duration;
        const relativePosition = currentTime / duration;

        this.meister.trigger('playerSeek', {
            relativePosition,
            currentTime,
            duration,
        });
    }

    onRequestSeek(e) {
        let targetTime;

        if (Number.isFinite(e.relativePosition)) {
            targetTime = e.relativePosition * this.meister.duration;
        } else if (Number.isFinite(e.timeOffset)) {
            targetTime = this.meister.currentTime + e.timeOffset;
        } else if (Number.isFinite(e.targetTime)) {
            targetTime = e.targetTime;
        }

        // Check whether we are allowed to seek forward.
        if (!e.forcedStart && this.blockSeekForward && targetTime > this.meister.currentTime) { return; }

        if (Number.isFinite(targetTime)) {
            this.meister.currentTime = targetTime;
        }
    }

    onRequestBitrate(e) {
        if (e.bitrateIndex === -1) {
            this.mediaPlayer.setAutoSwitchQuality(true);
            return;
        }

        let newBitrate = 0;

        this.bitrates.forEach((bitrate) => {
            if (bitrate.index === e.bitrateIndex) {
                newBitrate = bitrate.bitrate;
            }
        });

        this.mediaPlayer.setAutoSwitchQuality(false);
        this.mediaPlayer.setQualityFor('video', e.bitrateIndex);

        this.meister.trigger('playerSwitchBitrate', {
            newBitrate,
            newBitrateIndex: e.bitrateIndex,
        });
    }
}

Meister.registerPlugin('smooth', Smooth);
Meister.registerPlugin(Smooth.pluginName, Smooth);

export default Smooth;
