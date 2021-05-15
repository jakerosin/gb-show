export default {
  show: {
    name: 'show', type: String,
    description: "The show in question -- ID, guid, or title."
  },
  episode: {
    name: 'episode', alias: 'e', type: Number,
    description: "The episode number, {1, 2, ...}. If season is specified, relative to the season; otherwise relative to the show."
  },
  video: {
    name: 'video', alias: 'v', type: String,
    description: "The video name."
  },
  season: {
    name: 'season', alias: 's', type: String,
    description: "Show season; either its name, or number {1, 2, ...}"
  },
  season_type: {
    name: 'season-type', alias: 't', type: String,
    description: "Season type: one of ['games', 'years']. If omitted, will guess."
  },
  details: {
    name: 'details', alias: 'd', type: Boolean, defaultValue: false,
    description: "Print additional details, such as full episode lists"
  },
  quality: {
    name: 'quality', alias: 'q', type: String,
    description: "File quality: one of ['highest', 'hd', 'high', 'low']. If omitted, 'highest' is used."
  },
  out: {
    name: 'out', alias: 'o', type: String,
    description: "Output template (or 'null')"
  },
  video_out: {
    name: 'video-out', alias: 'V', type: Boolean,
    description: "Output template for the video file only (or 'null')"
  },
  json_out: {
    name: 'json-out', alias: 'J', type: String,
    description: "Output template for the json info file only (or 'null')"
  },
  image_out: {
    name: 'image-out', alias: 'I', type: String,
    description: "Output template for the image file only (or 'null')"
  },
  replace: {
    name: 'replace', alias: 'r', type: Boolean,
    description: "Replace previously saved files, if they exist"
  },
  commit: {
    name: 'commit', type: Boolean,
    description: 'Perform this command (if omitted, prompt for confirmation or log intended operation without altering state)'
  },
  help: {
    name: 'help', alias: 'h', type: Boolean,
    description: 'Print this help message'
  }
}
