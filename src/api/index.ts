'use strict';

// calls
import * as video from './calls/video';
import * as videoShow from './calls/video-show';

// shared data
import * as Shared from './calls/shared';

// exported types
export { Video } from './calls/video';
export { VideoShow } from './calls/video-show';
export { ListResult } from './base/result';

export function setApiKey(api_key: string): void {
  Shared.config.api_key = api_key;
}

export function setRateLimitMS(rate_limit_ms: number): void {
  Shared.config.rate_limit_ms = rate_limit_ms;
}

export default {
  video,
  videoShow,
  setApiKey,
  setRateLimitMS
};
