export interface BasicItem {
  api_detail_url?: string;
  id?: number;
  guid?: string;
}

interface BasicResult {
  error: string;
  limit: number;
  offset: number;
  number_of_page_results: number;
  number_of_total_results: number;
  status_code: number;
  version: string;
}

export interface ItemResult<Type> extends BasicResult {
  limit: 1;
  offset: 0;
  number_of_page_results: 1;
  number_of_total_results: 1;
  results: Type;
}

export interface ListResult<Type> extends BasicResult {
  results: Type[]|void;
}

export interface ImageResult {
  icon_url: string|void;
  medium_url: string|void;
  screen_url: string|void;
  screen_large_url: string|void;
  small_url: string|void;
  super_url: string|void;
  thumb_url: string|void;
  tiny_url: string|void;
  original_url: string|void;
  image_tags: string;
}
