import { ApiConfig } from '../base/config';
import * as DateUtils from '../base/date';
import { ItemFilter, ListFilter } from '../base/filter';
import { BasicItem, ItemResult, ListResult, ImageResult } from '../base/result';

import { format as formatVideo, Video } from './video';

import * as Call from './call';

export interface VideoShow extends BasicItem {
  deck?: string|void;
  title?: string|void;
  position?: number|void;
  image?: ImageResult|void;
  logo?: ImageResult|void;
  site_detail_url?: string|void;
  active?: boolean|void;
  display_nav?: boolean|void;
  latest?: Video[]|void;
  premium?: boolean|void;
  api_videos_url?: string|void;
}

export function format(item: any): VideoShow {
  const out = { ...item };
  if (item.latest) out.latest = out.latest.map(formatVideo);
  return out;
}

export async function get(guid: string, filter: ItemFilter = {}, config: ApiConfig = {}): Promise<VideoShow> {
  const path = `https://www.giantbomb.com/api/video_show/${guid}/`;
  const data = await Call.get<VideoShow>('api.videoShow.get', path, filter, config);

  return format(data.results);
}

export async function list(filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<VideoShow>> {
  const path = 'https://www.giantbomb.com/api/video_shows/';
  const data = await Call.list<VideoShow>('api.videoShow.list', path, filter, config);

  if (data.results) data.results = data.results.map(format);

  return data;
}

export async function all(filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<VideoShow>> {
  const path = 'https://www.giantbomb.com/api/video_shows/';
  const data = await Call.autopage<VideoShow>('api.videoShow.list', path, filter, config);

  if (data.results) data.results = data.results.map(format);

  return data;
}
