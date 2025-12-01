import {
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
} from '@angular/core';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import { Channel } from '../../../../../shared/channel.interface';
import { getCurrentWindow } from '@tauri-apps/api/window';

Artplayer.AUTO_PLAYBACK_TIMEOUT = 10000;

export interface ArtPlayerTimeUpdateEvent {
    currentTime: number;
    duration: number;
}

export interface AutoPlayNextEpisodeEvent {
    type: 'play' | 'cancel';
}

@Component({
    selector: 'app-art-player',
    imports: [],
    template: `<div #artplayer class="artplayer-container"></div>`,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            .artplayer-container {
                width: 100%;
                height: 100%;
            }
        `,
    ],
})
export class ArtPlayerComponent implements OnInit, OnDestroy, OnChanges {
    @Input() channel: Channel;
    @Input() volume = 1;
    @Input() showCaptions = false;
    @Input() enableAutoPlayNext = false;
    @Input() autoPlayNextLabel = 'Next episode in';
    @Input() autoPlayCancelLabel = 'Cancel';
    @Input() autoPlayNowLabel = 'Play now';

    @Output() timeUpdate = new EventEmitter<ArtPlayerTimeUpdateEvent>();
    @Output() autoPlayNext = new EventEmitter<AutoPlayNextEpisodeEvent>();

    private player: Artplayer;
    private autoPlayPopupShown = false;
    private autoPlayCancelled = false;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;
    private autoPlayCountdown = 10;

    constructor(private elementRef: ElementRef) { }

    ngOnInit(): void {
        this.initPlayer();
    }

    ngOnDestroy(): void {
        // Cleanup countdown interval
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        if (this.player) {
            // Cleanup do listener do Tauri
            if ((this.player as any).__tauriUnlisten) {
                (this.player as any).__tauriUnlisten();
            }
            this.player.destroy();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['channel'] && !changes['channel'].firstChange) {
            // Preserve fullscreen state before destroying player
            const wasFullscreen = this.player?.fullscreen || false;
            
            if (this.player) {
                this.player.destroy();
            }
            
            // Reset auto-play state for new episode
            this.autoPlayPopupShown = false;
            this.autoPlayCancelled = false;
            
            this.initPlayer(wasFullscreen);
        }
    }

    private async initPlayer(restoreFullscreen = false): Promise<void> {
        const el = this.elementRef.nativeElement.querySelector(
            '.artplayer-container'
        );
        const isLive = this.channel?.url?.toLowerCase().includes('m3u8');

        this.player = new Artplayer({
            container: el,
            url: this.channel.url + (this.channel.epgParams || ''),
            volume: this.volume,
            isLive: isLive,
            autoplay: true,
            type: this.getVideoType(this.channel.url),
            pip: true,
            autoPlayback: true,
            autoMini: true,
            lock: true,
            screenshot: true,
            setting: true,
            autoOrientation: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: false, // Desabilita fullscreen web pra usar o do Tauri
            playsInline: true,
            airplay: true,
            backdrop: true,
            mutex: true,
            theme: '#ff0000',
            customType: {
                m3u8: function (video: HTMLVideoElement, url: string) {
                    if (Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(url);
                        hls.attachMedia(video);
                    } else if (
                        video.canPlayType('application/vnd.apple.mpegurl')
                    ) {
                        video.src = url;
                    }
                },
                mkv: function (video: HTMLVideoElement, url: string) {
                    video.src = url;
                    // Add error handling
                    video.onerror = () => {
                        console.error('Error loading MKV file:', video.error);
                        // Fallback to treating it as a regular video
                        video.src = url;
                    };
                },
            },
        });

        // Restore fullscreen state if needed (for episode transitions)
        if (restoreFullscreen) {
            this.player.once('ready', async () => {
                // Small delay to ensure player is fully initialized
                setTimeout(async () => {
                    if (this.player) {
                        this.player.fullscreen = true;
                        try {
                            const appWindow = getCurrentWindow();
                            await appWindow.setFullscreen(true);
                        } catch (error) {
                            console.error('Error restoring fullscreen:', error);
                        }
                    }
                }, 100);
            });
        }

        // Emit time update events and handle auto-play next episode feature
        this.player.on('video:timeupdate', () => {
            if (this.player && this.player.duration > 0) {
                this.timeUpdate.emit({
                    currentTime: this.player.currentTime,
                    duration: this.player.duration,
                });

                // Auto-play next episode logic
                if (this.enableAutoPlayNext && !this.autoPlayPopupShown && !this.autoPlayCancelled) {
                    const timeRemaining = this.player.duration - this.player.currentTime;
                    if (timeRemaining <= 30 && timeRemaining > 0) {
                        this.showAutoPlayPopup();
                    }
                }
            }
        });

        // Integração com fullscreen do Tauri
        this.player.on('fullscreen', async (isFullscreen: boolean) => {
            try {
                const appWindow = getCurrentWindow();
                await appWindow.setFullscreen(isFullscreen);
            } catch (error) {
                console.error('Erro ao alternar fullscreen do Tauri:', error);
            }
        });

        // Escuta mudanças de fullscreen da janela Tauri (ex: F11 ou ESC)
        try {
            const appWindow = getCurrentWindow();
            const unlisten = await appWindow.onResized(async () => {
                const isFullscreen = await appWindow.isFullscreen();
                if (this.player && this.player.fullscreen !== isFullscreen) {
                    this.player.fullscreen = isFullscreen;
                }
            });

            // Guardar unlisten para cleanup no destroy
            (this.player as any).__tauriUnlisten = unlisten;
        } catch (error) {
            console.error('Erro ao monitorar fullscreen do Tauri:', error);
        }
    }

    private getVideoType(url: string): string {
        const extension = url.split('.').pop()?.toLowerCase();
        switch (extension) {
            case 'mkv':
                return 'video/matroska'; // Changed from 'mkv'
            case 'm3u8':
                return 'm3u8';
            case 'mp4':
                return 'mp4';
            default:
                return 'auto';
        }
    }

    private showAutoPlayPopup(): void {
        if (this.autoPlayPopupShown || !this.player) return;
        
        this.autoPlayPopupShown = true;
        this.autoPlayCountdown = 10;

        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'art-auto-play-popup';
        popup.innerHTML = `
            <div class="art-auto-play-content">
                <div class="art-countdown-text">
                    ${this.autoPlayNextLabel} <span class="countdown-number">${this.autoPlayCountdown}</span>s
                </div>
                <div class="art-auto-play-buttons">
                    <button class="art-btn-cancel">${this.autoPlayCancelLabel}</button>
                    <button class="art-btn-play-now">${this.autoPlayNowLabel}</button>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .art-auto-play-popup {
                position: absolute;
                bottom: 70px;
                right: 20px;
                z-index: 99999;
                background: rgba(0, 0, 0, 0.9);
                border-radius: 8px;
                padding: 16px;
                min-width: 200px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                animation: art-slideIn 0.3s ease-out;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            .art-auto-play-content {
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            .art-countdown-text {
                font-size: 14px;
                color: #fff;
                text-align: center;
                font-weight: 500;
            }
            .art-auto-play-buttons {
                display: flex;
                gap: 8px;
                justify-content: center;
            }
            .art-auto-play-buttons button {
                padding: 8px 16px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
                transition: opacity 0.2s;
            }
            .art-auto-play-buttons button:hover {
                opacity: 0.9;
            }
            .art-btn-cancel {
                background: transparent;
                color: #fff;
                border: 1px solid rgba(255,255,255,0.3) !important;
            }
            .art-btn-play-now {
                background: #ff4081;
                color: #fff;
            }
            @keyframes art-slideIn {
                from {
                    opacity: 0;
                    transform: translateX(20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        popup.appendChild(style);

        // Add to player container
        this.player.template.$player.appendChild(popup);

        // Event listeners
        const cancelBtn = popup.querySelector('.art-btn-cancel');
        const playNowBtn = popup.querySelector('.art-btn-play-now');
        const countdownSpan = popup.querySelector('.countdown-number');

        cancelBtn?.addEventListener('click', () => {
            this.cancelAutoPlay(popup);
        });

        playNowBtn?.addEventListener('click', () => {
            this.triggerAutoPlay(popup);
        });

        // Start countdown
        this.countdownInterval = setInterval(() => {
            this.autoPlayCountdown--;
            if (countdownSpan) {
                countdownSpan.textContent = String(this.autoPlayCountdown);
            }
            if (this.autoPlayCountdown <= 0) {
                this.triggerAutoPlay(popup);
            }
        }, 1000);
    }

    private cancelAutoPlay(popup: HTMLElement): void {
        this.autoPlayCancelled = true;
        this.autoPlayPopupShown = false;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        popup.remove();
        this.autoPlayNext.emit({ type: 'cancel' });
    }

    private triggerAutoPlay(popup: HTMLElement): void {
        this.autoPlayPopupShown = false;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        popup.remove();
        this.autoPlayNext.emit({ type: 'play' });
    }

    resetAutoPlayState(): void {
        this.autoPlayPopupShown = false;
        this.autoPlayCancelled = false;
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
    }
}
