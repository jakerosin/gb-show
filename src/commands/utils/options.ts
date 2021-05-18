export default {
  show: {
    name: 'show', type: String,
    typeLabel: '{underline name}',
    description: "The show in question -- ID, guid, or title."
  },
  episode: {
    name: 'episode', alias: 'e', type: Number,
    typeLabel: '{underline number}',
    description: "The episode number, (1, 2, ...). If season is specified, relative to the season; otherwise relative to the show."
  },
  video: {
    name: 'video', alias: 'v', type: String,
    typeLabel: '{underline name}',
    description: "The video name."
  },
  season: {
    name: 'season', alias: 's', type: String,
    typeLabel: '{underline name/number}',
    description: "Show season; either its name, or number (1, 2, ...)"
  },
  season_type: {
    name: 'season-type', alias: 't', type: String,
    typeLabel: '{underline "games"/"years"}',
    description: "Season type: one of ['games', 'years']. If omitted, will guess."
  },
  show_only: {
    name: 'show-only', type: Boolean,
    description: 'Save only metadata and/or show images; ignore all episodes.'
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
    typeLabel: '{underline path_template}',
    description: "Output template for episode files (or 'none')"
  },
  video_out: {
    name: 'video-out', alias: 'V', type: String,
    typeLabel: '{underline path_template}',
    description: "Output template for the video file only (or 'none')"
  },
  image_out: {
    name: 'image-out', alias: 'I', type: String,
    typeLabel: '{underline path_template}',
    description: "Output template for the image file only (or 'none')"
  },
  metadata_out: {
    name: 'metadata-out', alias: 'M', type: String,
    typeLabel: '{underline path_template}',
    description: "Output template for the video's metadata file only (or 'none')"
  },
  show_out: {
    name: 'show-out', alias: 'S', type: String,
    typeLabel: '{underline path_template}',
    description: "Output template for the show (not episode) files (or 'none')"
  },
  show_image_out: {
    name: 'show-image-out', type: String,
    typeLabel: '{underline path_template}',
    description: "Output template for the show (not episode) image (or 'none')"
  },
  show_metadata_out: {
    name: 'show-metadata-out', type: String,
    typeLabel: '{underline path_template}',
    description: "Output template for the show (not episode) metadata file (or 'none')"
  },
  file_limit: {
    name: 'file-limit', alias: 'f', type: Number,
    typeLabel: '{underline count}',
    description: 'Stop downloading after this many new episodes are saved (ignoring files already downloaded).'
  },
  megabyte_limit: {
    name: 'megabyte-limit', alias: 'm', type: Number,
    typeLabel: '{underline size}',
    description: 'Stop downloading after this many total megabytes are saved (ignoring files already downloaded). Will slightly overshoot, stopping after the first episode that exceeds this threshold.'
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
