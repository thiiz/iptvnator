import {
    Component,
    EventEmitter,
    Output,
    Signal,
    ViewEncapsulation,
    effect,
    inject,
    input,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { StorageMap } from '@ngx-pwa/local-storage';
import { getExtensionFromUrl } from '../../../../shared/playlist.utils';
import { ArtPlayerComponent, AutoPlayNextEpisodeEvent } from '../../player/components/art-player/art-player.component';
import { HtmlVideoPlayerComponent } from '../../player/components/html-video-player/html-video-player.component';
import { VjsPlayerComponent } from '../../player/components/vjs-player/vjs-player.component';
import { Settings, VideoPlayer } from '../../settings/settings.interface';
import { STORE_KEY } from '../../shared/enums/store-keys.enum';

export interface TimeUpdateEvent {
    currentTime: number;
    duration: number;
}

@Component({
    selector: 'app-web-player-view',
    templateUrl: './web-player-view.component.html',
    styleUrls: ['./web-player-view.component.scss'],
    imports: [ArtPlayerComponent, HtmlVideoPlayerComponent, VjsPlayerComponent],
    encapsulation: ViewEncapsulation.None,
})
export class WebPlayerViewComponent {
    storage = inject(StorageMap);

    streamUrl = input.required<string>();
    enableAutoPlayNext = input<boolean>(false);
    autoPlayNextLabel = input<string>('Next episode in');
    autoPlayCancelLabel = input<string>('Cancel');
    autoPlayNowLabel = input<string>('Play now');

    @Output() timeUpdate = new EventEmitter<TimeUpdateEvent>();
    @Output() autoPlayNext = new EventEmitter<AutoPlayNextEpisodeEvent>();

    settings = toSignal(
        this.storage.get(STORE_KEY.Settings)
    ) as Signal<Settings>;

    channel: { url: string };
    player: VideoPlayer;
    vjsOptions: { sources: { src: string; type: string }[] };

    constructor() {
        effect(() => {
            this.player = this.settings()?.player;

            this.setChannel(this.streamUrl());
            if (this.player === VideoPlayer.VideoJs)
                this.setVjsOptions(this.streamUrl());
        });
    }

    setVjsOptions(streamUrl: string) {
        const extension = getExtensionFromUrl(streamUrl);
        const mimeType =
            extension === 'm3u' || extension === 'm3u8' || extension === 'ts'
                ? 'application/x-mpegURL'
                : 'video/mp4';

        this.vjsOptions = {
            sources: [{ src: streamUrl, type: mimeType }],
        };
    }

    setChannel(streamUrl: string) {
        this.channel = {
            url: streamUrl,
        };
    }

    onTimeUpdate(event: TimeUpdateEvent) {
        this.timeUpdate.emit(event);
    }

    onAutoPlayNext(event: AutoPlayNextEpisodeEvent) {
        this.autoPlayNext.emit(event);
    }
}
