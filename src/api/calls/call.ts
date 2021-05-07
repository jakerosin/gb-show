import { get as httpieGet } from 'httpie';
import { encode } from 'querystring';

import { HttpieResponse } from 'httpie';

import { ApiConfig } from '../base/config';
import { ItemFilter, ListFilter, PageFilter, SearchFilter, toParams } from '../base/filter';
import { ItemResult, ListResult } from '../base/result';
import * as Shared from './shared';

type URL = {
  full: string;
  safe: string;
  base: string;
  tag: string;
}

let last_call = 0;
let calling = false;

function toURL(tag: string, base: string, filter: ItemFilter = {}, config: ApiConfig = {}): URL {
  const api_key =  config.api_key || Shared.config.api_key;
  const filterParams = toParams({ ...Shared.filter, ...filter });
  const safeQuery = encode(filterParams);
  if (api_key && api_key.length) filterParams.api_key = api_key;
  const fullQuery = encode(filterParams);

  return {
    full: base + (fullQuery.length ? `?${fullQuery}` : ''),
    safe: base + (safeQuery.length ? `?${safeQuery}` : ''),
    base,
    tag
  }
}

async function wait(millis: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(function() {
      res(null);
    }, millis);
  })
};

function nextDelay(config: ApiConfig): number {
  let { rate_limit_ms } = config;
  if (rate_limit_ms === void 0) rate_limit_ms = Shared.config.rate_limit_ms;
  return last_call + rate_limit_ms - Date.now();
}

async function rateLimitGet(url: URL, config: ApiConfig): Promise<HttpieResponse> {
  try {
    while (calling) await wait(500);
    calling = true;

    let delay = 0;
    while ((delay = nextDelay(config)) > 0) await wait(delay)

    return await httpieGet(url.full);
  } catch (err) {
		console.error(err);
		throw new Error(`${url.tag}: an external API error occurred in GET ${url.safe} ; ${err.message}`);
	} finally {
    last_call = Date.now()
    calling = false;
  }
}

function validateResponseStatus(url: URL, data: any): void {
  if (!data) {
    throw new Error(`${url.tag}: GET ${url.safe} provided empty response`);
  } else if ( data.status_code !== 1) {
    throw new Error(`${url.tag}: GET ${url.safe} provided error ${data.error}`);
  }
}

export async function get<Type>(tag: string, path: string, filter: ItemFilter = {}, config: ApiConfig = {}): Promise<ItemResult<Type>> {
  const url = toURL(tag, path, filter, config);

  const { data } = await rateLimitGet(url, config);
  validateResponseStatus(url, data);

  if (!data.results) {
    throw new Error(`${tag}:  GET ${url.safe} provided no results ${JSON.stringify(data)}`);
  } else if (Array.isArray(data.results)) {
    throw new Error(`${tag}:  GET ${url.safe} provided array results ${JSON.stringify(data)}`);
  }

  return data as ItemResult<Type>;
}

export async function list<Type>(tag: string, path: string, filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<Type>> {
  const url = toURL(tag, path, filter, config);

  const { data } = await rateLimitGet(url, config);
  validateResponseStatus(url, data);

  return data as ListResult<Type>;
}

export async function search<Type>(tag: string, query: string, resources: string|string[], filter: PageFilter = {}, config: ApiConfig = {}): Promise<ListResult<Type>> {
  const path = 'https://www.giantbomb.com/api/search/';
  const url = toURL(tag, path, { ...filter, resources:[].concat(resources), query } as SearchFilter, config);

  const { data } = await rateLimitGet(url, config);
  validateResponseStatus(url, data);

  return data as ListResult<Type>;
}
