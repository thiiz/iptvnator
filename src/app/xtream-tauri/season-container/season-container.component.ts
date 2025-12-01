import { KeyValuePipe } from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { XtreamSerieEpisode } from '../../../../shared/xtream-serie-details.interface';

@Component({
    selector: 'app-season-container',
    templateUrl: './season-container.component.html',
    styleUrls: ['./season-container.component.scss'],
    imports: [KeyValuePipe, MatCardModule, MatIcon, MatButton],
})
export class SeasonContainerComponent {
    readonly seasons = input.required<Record<string, XtreamSerieEpisode[]>>();
    readonly viewedEpisodeIds = input<Set<string>>(new Set());

    @Output() episodeClicked = new EventEmitter<any>();

    isEpisodeViewed(episodeId: string): boolean {
        return this.viewedEpisodeIds().has(episodeId);
    }

    selectedSeason: string;

    compareSeasons(a: any, b: any): number {
        return Number(a.key) - Number(b.key);
    }

    selectSeason(seasonKey: string) {
        this.selectedSeason = seasonKey;
    }

    selectEpisode(episode: XtreamSerieEpisode) {
        this.episodeClicked.emit(episode);
    }
}
