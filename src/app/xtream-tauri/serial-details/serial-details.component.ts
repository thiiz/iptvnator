import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { XtreamSerieEpisode } from '../../../../shared/xtream-serie-details.interface';
import { SeasonContainerComponent } from '../season-container/season-container.component';
import { ViewedEpisodesService } from '../services/viewed-episodes.service';
import { XtreamStore } from '../xtream.store';

@Component({
    selector: 'app-serial-details',
    templateUrl: './serial-details.component.html',
    styleUrls: ['../detail-view.scss'],
    imports: [MatButton, MatIcon, SeasonContainerComponent, TranslatePipe],
})
export class SerialDetailsComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly xtreamStore = inject(XtreamStore);
    private readonly viewedEpisodesService = inject(ViewedEpisodesService);

    readonly selectedItem = this.xtreamStore.selectedItem;
    readonly selectedContentType = this.xtreamStore.selectedContentType;
    readonly isFavorite = this.xtreamStore.isFavorite;
    readonly viewedEpisodeIds = this.xtreamStore.viewedEpisodeIds;

    ngOnInit(): void {
        const { categoryId, serialId } = this.route.snapshot.params;
        this.xtreamStore.fetchSerialDetailsWithMetadata({
            serialId,
            categoryId,
        });
        this.xtreamStore.checkFavoriteStatus(
            serialId,
            this.xtreamStore.currentPlaylist().id
        );
        this.xtreamStore.loadViewedEpisodes(serialId);
    }

    playEpisode(episode: XtreamSerieEpisode) {
        const serialId = this.route.snapshot.params.serialId;
        this.addToRecentlyViewed(serialId);
        this.markEpisodeAsViewed(serialId, episode);

        const streamUrl = this.xtreamStore.constructEpisodeStreamUrl(episode);
        this.xtreamStore.openPlayer(
            streamUrl,
            episode.title,
            this.selectedItem().info.cover,
            episode
        );
    }

    private addToRecentlyViewed(xtreamId: number) {
        this.xtreamStore.addRecentItem({
            contentId: xtreamId,
            playlist: this.xtreamStore.currentPlaylist,
        });
    }

    private async markEpisodeAsViewed(
        serialId: number,
        episode: XtreamSerieEpisode
    ): Promise<void> {
        const playlistId = this.xtreamStore.currentPlaylist().id;
        await this.viewedEpisodesService.markAsViewed({
            series_id: serialId,
            episode_id: episode.id,
            season_number: episode.season,
            episode_number: episode.episode_num,
            playlist_id: playlistId,
        });

        // Update store state
        this.xtreamStore.addViewedEpisode(episode.id);
    }

    toggleFavorite() {
        this.xtreamStore.toggleFavorite(
            this.route.snapshot.params.serialId,
            this.xtreamStore.currentPlaylist().id
        );
    }
}
