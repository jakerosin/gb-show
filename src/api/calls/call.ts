import { get as httpieGet } from 'httpie';
import { encode } from 'querystring';

import { HttpieResponse } from 'httpie';

import { ApiConfig } from '../base/config';
import { ItemFilter, ListFilter, toParams } from '../base/filter';
import { ItemResult, ListResult } from '../base/result';
import * as Shared from './shared';

let last_call = 0;
let calling = false;

async function wait(millis: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(function() {
      res(null);
    }, millis);
  })
};

function nextDelay(): number {
  return last_call + Shared.config.rate_limit_ms - Date.now();
}

async function rateLimitGet(tag: string, fullPath: string): Promise<HttpieResponse> {
  try {
    while (calling) await wait(Shared.config.rate_limit_ms);
    calling = true;

    let delay = 0;
    while ((delay = nextDelay()) > 0) await wait(delay)

    return await httpieGet(fullPath);
  } catch (err) {
		console.error(err);
		throw new Error(`${tag}: an external API error occurred in GET ${fullPath} ; ${err.message}`);
	} finally {
    last_call = Date.now()
    calling = false;
  }
}

export async function get<Type>(tag: string, path: string, filter: ItemFilter = {}, config: ApiConfig = {}): Promise<ItemResult<Type>> {
  const api_key =  config.api_key || Shared.config.api_key;
  const filterParams = toParams({ ...Shared.filter, ...filter });
  if (api_key && api_key.length) filterParams.api_key = api_key;
  const query = encode(filterParams);

  const fullPath = path + (query.length ? `?${query}` : '');

  const { data } = await rateLimitGet(tag, fullPath);

  if (!data || data.error !== 'OK') {
    if (data.error) {
      throw new Error(`${tag}: GET ${fullPath} provided error ${data.error}`);
    }
    throw new Error(`${tag}: GET ${fullPath} provided empty response ${JSON.stringify(data)}`);
  }

  if (!data.results) {
    throw new Error(`${tag}:  GET ${fullPath} provided no results ${JSON.stringify(data)}`);
  } else if (Array.isArray(data.results)) {
    throw new Error(`${tag}:  GET ${fullPath} provided array results ${JSON.stringify(data)}`);
  }

  return data as ItemResult<Type>;
}

export async function list<Type>(tag: string, path: string, filter: ListFilter = {}, config: ApiConfig = {}): Promise<ListResult<Type>> {
  const api_key =  config.api_key || Shared.config.api_key;
  const filterParams = toParams({ ...Shared.filter, ...filter });
  if (api_key && api_key.length) filterParams.api_key = api_key;
  const query = encode(filterParams);

  const fullPath = path + (query.length ? `?${query}` : '');

  const { data } = await rateLimitGet(tag, fullPath);

  if (!data || data.error !== 'OK') {
    if (data.error) {
      throw new Error(`${tag}: GET ${fullPath} provided error ${data.error}`);
    }
    throw new Error(`${tag}: GET ${fullPath} provided empty response ${JSON.stringify(data)}`);
  }

  return data as ListResult<Type>;
}
