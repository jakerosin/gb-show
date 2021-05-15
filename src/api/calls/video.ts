'use strict';

import { ApiConfig } from '../base/config';
import { ItemFilter, ListFilter, PageFilter } from '../base/filter';
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
  publish_date?: string|void;
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

export async function get(guid: string, filter: ItemFilter = {}, config: ApiConfig = {}): Promise<Video> {
  const path = `https://www.giantbomb.com/api/video/${guid}/`;
  const data = await Call.get<Video>('api.video.get', path, filter, config);

  return data.results;
}

export async function list(filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<Video>> {
  const path = 'https://www.giantbomb.com/api/videos/';
  const data = await Call.list<Video>('api.video.list', path, filter, config);

  return data;
}

export async function all(filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<Video>> {
  const path = 'https://www.giantbomb.com/api/videos/';
  const data = await Call.autopageList<Video>('api.video.all', path, filter, config);

  return data;
}

export async function find(predicate: (Video) => boolean, filter: ListFilter = {}, config: ApiConfig = {}): Promise<Video|void> {
  const path = 'https://www.giantbomb.com/api/videos/';
  const data = await Call.autopageList<Video>('api.video.find', path, filter, config, predicate);

  if (data.results && data.results.length) {
    const candidate = data.results[data.results.length - 1];
    if (predicate(candidate)) return candidate;
  }
}

export async function search(query: string, filter: PageFilter = {}, config: ApiConfig = {}): Promise<ListResult<Video>> {
  const data = await Call.search<Video>('api.video.search', query, 'video', filter, config);

  return data;
}

export async function searchAll(query: string, filter: PageFilter = {}, config: ApiConfig = {}): Promise<ListResult<Video>> {
  const data = await Call.autopageSearch<Video>('api.video.searchAll', query, 'video', filter, config);

  return data;
}

export async function searchFor(query: string, predicate: (Video) => boolean, filter: PageFilter = {}, config: ApiConfig = {}): Promise<Video|void> {
  const data = await Call.autopageSearch<Video>('api.video.searchFor', query, 'video', filter, config, predicate);

  if (data.results && data.results.length) {
    const candidate = data.results[data.results.length - 1];
    if (predicate(candidate)) return candidate;
  }
}
