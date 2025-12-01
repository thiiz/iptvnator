import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, Inject, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { XtreamSerieEpisode } from '../../../../shared/xtream-serie-details.interface';
import { AutoPlayNextEpisodeEvent } from '../../player/components/art-player/art-player.component';
import { WebPlayerViewComponent } from '../../portals/web-player-view/web-player-view.component';

export interface PlayerDialogData {
    streamUrl: string;
    title: string;
    // Series auto-play data
    episodes?: XtreamSerieEpisode[];
    currentEpisodeId?: string;
    onEpisodeChange?: (episode: XtreamSerieEpisode) => string;
}

@Component({
    templateUrl: './player-dialog.component.html',
    imports: [
        ClipboardModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        TranslateModule,
        WebPlayerViewComponent,
    ],
    styleUrl: './player-dialog.component.scss',
    encapsulation: ViewEncapsulation.None
})
export class PlayerDialogComponent {
    title: string;
    streamUrl: string;

    // Series auto-play properties
    episodes: XtreamSerieEpisode[] = [];
    currentEpisodeId: string | null = null;
    onEpisodeChange: ((episode: XtreamSerieEpisode) => string) | null = null;

    // Auto-play labels (translated)
    autoPlayNextLabel: string;
    autoPlayCancelLabel: string;
    autoPlayNowLabel: string;

    constructor(
        @Inject(MAT_DIALOG_DATA) data: PlayerDialogData,
        private snackBar: MatSnackBar,
        private translateService: TranslateService
    ) {
        this.streamUrl = data.streamUrl;
        this.title = data.title;
        this.episodes = data.episodes || [];
        this.currentEpisodeId = data.currentEpisodeId || null;
        this.onEpisodeChange = data.onEpisodeChange || null;

        // Get translated labels
        this.autoPlayNextLabel = this.translateService.instant('PLAYER.NEXT_EPISODE_IN');
        this.autoPlayCancelLabel = this.translateService.instant('CANCEL');
        this.autoPlayNowLabel = this.translateService.instant('PLAYER.PLAY_NOW');
    }

    showCopyNotification() {
        this.snackBar.open(
            this.translateService.instant('PORTALS.STREAM_URL_COPIED'),
            null,
            {
                duration: 2000,
            }
        );
    }

    get enableAutoPlayNext(): boolean {
        return this.episodes.length > 0 && this.currentEpisodeId !== null && this.hasNextEpisode;
    }

    get hasNextEpisode(): boolean {
        if (this.episodes.length === 0 || !this.currentEpisodeId) return false;
        const currentIndex = this.episodes.findIndex(ep => ep.id === this.currentEpisodeId);
        return currentIndex >= 0 && currentIndex < this.episodes.length - 1;
    }

    private getNextEpisode(): XtreamSerieEpisode | null {
        if (this.episodes.length === 0 || !this.currentEpisodeId) return null;
        const currentIndex = this.episodes.findIndex(ep => ep.id === this.currentEpisodeId);
        if (currentIndex >= 0 && currentIndex < this.episodes.length - 1) {
            return this.episodes[currentIndex + 1];
        }
        return null;
    }

    onAutoPlayNext(event: AutoPlayNextEpisodeEvent) {
        if (event.type === 'play') {
            this.playNextEpisode();
        }
        // 'cancel' is handled internally by the ArtPlayer component
    }

    private playNextEpisode() {
        const nextEpisode = this.getNextEpisode();
        if (nextEpisode && this.onEpisodeChange) {
            const newStreamUrl = this.onEpisodeChange(nextEpisode);
            this.streamUrl = newStreamUrl;
            this.title = nextEpisode.title;
            this.currentEpisodeId = nextEpisode.id;
        }
    }
}
