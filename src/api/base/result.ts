'use strict';

export function isID(value: any): boolean {
  const num = Number(`${value}`);
  return !isNaN(num) && num > 0;
}

export function isGUID(value: any): boolean {
  try {
    const parts = `${value}`.trim().split('-');
    return parts.length === 2 && parts.every(isID);
  } catch (err) {
    return false;
  }
}

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

export interface ItemResult<T> extends BasicResult {
  limit: 1;
  offset: 0;
  number_of_page_results: 1;
  number_of_total_results: 1;
  results: T;
}

export interface ListResult<T> extends BasicResult {
  results: T[]|void;
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
