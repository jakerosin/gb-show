import { ApiConfig } from '../base/config';
import * as DateUtils from '../base/date';
import { ItemFilter, ListFilter } from '../base/filter';
import { BasicItem, ItemResult, ListResult, ImageResult } from '../base/result';

import * as Call from './call';

interface Association extends BasicItem {
  name: string|void;
  site_detail_url: string|void;
}

interface Show extends BasicItem {
  title: string|void;
  position: number|void;
  site_detail_url: string|void;
  image: ImageResult|void;
  logo: ImageResult|void;
}

export interface Video extends BasicItem {
  associations?: Association[]|void;
  deck?: string|void;
  hd_url?: string|void;
  high_url?: string|void;
  low_url?: string|void;
  embed_player?: string|void;
  image?: ImageResult|void;
  length_seconds?: number|void;
  name?: string|void;
  publish_date?: Date|void;
  site_detail_url?: string|void;
  url?: string|void;
  user?: string|void;
  hosts?: string|void;
  crew?: string|void;
  video_categories?: Association[]|void;
  video_show?: Show|void;
  youtube_id?: string|void;
  saved_time?: any|void;  // TODO check format
  premium?: boolean|void;
}

export function format(item: any): Video {
  return (DateUtils.fromStringFields(item, 'publish_date')) as Video;
}

export async function get(guid: string, filter: ItemFilter = {}, config: ApiConfig = {}): Promise<Video> {
  const path = `https://www.giantbomb.com/api/video/${guid}/`;
  const data = await Call.get<Video>('api.video.get', path, filter, config);

  return format(data.results);
}

export async function list(filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<Video>> {
  const path = 'https://www.giantbomb.com/api/videos/';
  const data = await Call.list<Video>('api.video.list', path, filter, config);

  if (data.results) data.results = data.results.map(format);

  return data;
}
