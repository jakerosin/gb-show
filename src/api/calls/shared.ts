'use strict';

import { ApiConfig } from '../base/config';
import { ItemFilter } from '../base/filter';

export const config: ApiConfig = {
  api_key: '',
  rate_limit_ms: 1000
}

export const filter: ItemFilter = {
  format: 'json'
}
