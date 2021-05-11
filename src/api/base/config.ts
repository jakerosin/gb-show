'use strict';

import Cache from  '../cache';
import Logger from '../../utils/logger';

export interface ApiConfig {
  api_key?: string;
  rate_limit_ms?: number;
  logger?: Logger|void;
  cache?: Cache|void;
}
