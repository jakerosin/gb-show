//  api
import api from '../api';

// types
import { Video, VideoShow } from '../api'

export type ArchiveSeasonType = 'year'|'game';

export interface ArchiveVideoInfo {
  video: Video;
  show: VideoShow;
  seasonNumber: number;
  seasonName: string;
  seasonType: ArchiveSeasonType;
  seasonEpisodeNumber: number;
  showEpisodeNumber: number;
  seasonEpisodeCount: number;
  showEpisodeCount: number;
  seasonCount: number;
}
