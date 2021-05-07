// calls
import * as video from './calls/video';
import * as videoShow from './calls/video-show';

// shared data
import * as Shared from './calls/shared';

// exported types
export { Video } from './calls/video';
export { VideoShow } from './calls/video-show';
export { ListResult } from './base/result';

export function setApiKey(api_key: string) {
  Shared.config.api_key = api_key;
}

export default {
  video,
  videoShow,
  setApiKey
};
