import { inject, Injectable } from '@angular/core';
import { DatabaseService } from '../../services/database.service';

export interface ViewedEpisodeData {
    episode_id: string;
    season_number: number;
    episode_number: number;
    watched_at: string;
}

// Structure: { [series_id]: ViewedEpisodeData[] }
export type ViewedEpisodesMap = Record<string, ViewedEpisodeData[]>;

@Injectable({
    providedIn: 'root',
})
export class ViewedEpisodesService {
    private dbService = inject(DatabaseService);

    private async getViewedEpisodesMap(
        playlistId: string
    ): Promise<ViewedEpisodesMap> {
        const db = await this.dbService.getConnection();
        const result = await db.select<{ viewed_episodes: string }[]>(
            'SELECT viewed_episodes FROM playlists WHERE id = ?',
            [playlistId]
        );

        if (!result[0]?.viewed_episodes) {
            return {};
        }

        try {
            return JSON.parse(result[0].viewed_episodes);
        } catch {
            return {};
        }
    }

    private async saveViewedEpisodesMap(
        playlistId: string,
        map: ViewedEpisodesMap
    ): Promise<void> {
        const db = await this.dbService.getConnection();
        await db.execute(
            'UPDATE playlists SET viewed_episodes = ? WHERE id = ?',
            [JSON.stringify(map), playlistId]
        );
    }

    async markAsViewed(item: {
        series_id: number;
        episode_id: string;
        season_number: number;
        episode_number: number;
        playlist_id: string;
    }): Promise<void> {
        const map = await this.getViewedEpisodesMap(item.playlist_id);
        const seriesKey = item.series_id.toString();

        if (!map[seriesKey]) {
            map[seriesKey] = [];
        }

        // Check if episode already exists
        const existingIndex = map[seriesKey].findIndex(
            (e) => e.episode_id === item.episode_id
        );

        const episodeData: ViewedEpisodeData = {
            episode_id: item.episode_id,
            season_number: item.season_number,
            episode_number: item.episode_number,
            watched_at: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
            map[seriesKey][existingIndex] = episodeData;
        } else {
            map[seriesKey].push(episodeData);
        }

        await this.saveViewedEpisodesMap(item.playlist_id, map);
    }

    async markAsUnviewed(
        seriesId: number,
        episodeId: string,
        playlistId: string
    ): Promise<void> {
        const map = await this.getViewedEpisodesMap(playlistId);
        const seriesKey = seriesId.toString();

        if (map[seriesKey]) {
            map[seriesKey] = map[seriesKey].filter(
                (e) => e.episode_id !== episodeId
            );

            if (map[seriesKey].length === 0) {
                delete map[seriesKey];
            }
        }

        await this.saveViewedEpisodesMap(playlistId, map);
    }

    async isViewed(
        seriesId: number,
        episodeId: string,
        playlistId: string
    ): Promise<boolean> {
        const map = await this.getViewedEpisodesMap(playlistId);
        const seriesKey = seriesId.toString();
        return map[seriesKey]?.some((e) => e.episode_id === episodeId) ?? false;
    }

    async getViewedEpisodeIds(
        seriesId: number,
        playlistId: string
    ): Promise<Set<string>> {
        const map = await this.getViewedEpisodesMap(playlistId);
        const seriesKey = seriesId.toString();
        const episodes = map[seriesKey] ?? [];
        return new Set(episodes.map((e) => e.episode_id));
    }

    async getViewedEpisodesForSeries(
        seriesId: number,
        playlistId: string
    ): Promise<ViewedEpisodeData[]> {
        const map = await this.getViewedEpisodesMap(playlistId);
        const seriesKey = seriesId.toString();
        return map[seriesKey] ?? [];
    }

    async clearSeriesHistory(
        seriesId: number,
        playlistId: string
    ): Promise<void> {
        const map = await this.getViewedEpisodesMap(playlistId);
        const seriesKey = seriesId.toString();
        delete map[seriesKey];
        await this.saveViewedEpisodesMap(playlistId, map);
    }
}
