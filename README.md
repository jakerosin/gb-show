# gb-show

## A CLI for downloading [Giant Bomb](https://www.giantbomb.com) shows and videos.

## How to Use

**[Node Required](https://nodejs.org/en/)**

### Setup

`chmod u+x ./gb-show`: Make the gb-show script executable

Copy your API key from [Giant Bomb](https://www.giantbomb.com/api)

### Run

`./gb-show --api-key <YOUR_API_KEY> list`

`./gb-show --api-key <YOUR_API_KEY> find Mario`

`./gb-show --api-key <YOUR_API_KEY> examine "Endurance Run"`

`./gb-show --api-key <YOUR_API_KEY> download --video "Quick Look Nidhogg" --video-out "{date} {name}"`

`./gb-show --api-key <YOUR_API_KEY> download Endurance --season Shenmue --out "{show}/Season {season} - {season_name}/S{season}E{episode} - {name} [{quality}]"`

## Commands

Four commands (plus aliases) are available:

`help`: display detailed information about the tool and available options. Can also be combined with specific commands for detailed information, such as `./gb-show download help`.

`list [show]` (alias `find [show]`): list the Giant Bomb shows available for download. If a search term is provided, looks for shows involving that query in a name, video, or game.

`examine <show>` (alias `seasons <show>`): retrieves and lists the video content produced for the indicated show, attempting to organize that content into year- or game-based "seasons".

`download [options]` (alias `get [options]`): download a single video, a batch of episodes or seasons within a single show, or an entire show.

## Options

`gb-show` has tool-wide options that should be specified before the command name, and command options that should be listed after. i.e.:

`./gb-show [tool options] <command> [command options]`.

In most cases, rather than listing configuration as command-line options, the same settings can be applied as environment variables.

### Tool Options

**API key is required, but it may be provided via `--api-key` or the `GBSHOW_TOKEN` env variable.**

| Option          | Type   | Required | ENV variable             | Description  |

| --------------- | ------ | -------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| --api-key, -k   | String | Y        | GBSHOW_TOKEN             | Your [Giant Bomb API key](https://www.giantbomb.com/api/)                                    |
| --log-level, -l | String | N        | GBSHOW_LOG_LEVEL         | Minimum significance for display. [fatal, error, warn, info, debug, trace]. Default: "warn"  |
| --no-color, -c  |        | N        | GBSHOW_LOG_NO_COLOR      | Display console output in B/W; no clarity coloration                                         |
| --copy-year, -y |        | N        | GBSHOW_COPY_YEAR         | When constructing seasons, copy publication year (don't correct for Dec->Jan release blocks) |

### List Command Options

| Option               | Type   | Required | ENV variable             | Description  |

| -------------------- | ------ | -------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| [text], --show, -s   | String | N        |                          | Used to find a matching show -- title, episode name, game                                    |

e.g. `./gb-show list "Mario"`

### Examine Command Options

| Option               | Type   | Required | ENV variable             | Description  |

| -------------------- | ------ | -------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| [text], --show, -s   | String | Y        |                          | Used to find a matching show -- title, episode name, game                                    |
| --season-type, -t    | String | N        | GBSHOW_SEASON_TYPE       | Field used to divide the show's seasons: [years, games]. Inferred from show by default.      |
| --details, -d        |        | N        |                          | Display extra information (episode titles)                                                   |

### Download Command Options

**Either `--show` or `--video` is required; they may be combined.**

**Output template arguments `--out`, `--video-out`, etc. (those with "-out") are not required, but necessary for any files to be saved.**

| Option               | Type   | Required | ENV variable             | Description  |

| -------------------- | ------ | -------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| <text>, --show, -s   | String | Y*       |                          | Used to find a matching show -- title, episode name, game.                                   |
| --video, -v          | String | Y*       |                          | Used to find a matching video -- title, episode name, game.                                  |
| --episode, -e        | Number | N        |                          | One-based index for the video. If `--season`, counts within that season; otherwise within the show. Earliest episode is `1`. |
| --season, -s         | String/Number | N |                          | The season (one-based index, or name) for the videos.                                        |
| [from, after, through, to] | * | N       |                          | Specify a range of episodes to download (may be combined with other ranges)                  |
| --season-type, -t    | String | N        | GBSHOW_SEASON_TYPE       | Field used to divide the show's seasons: ["years", "games"]. Show-specific by default.       |
| --details, -d        |        | N        |                          | Display extra information (episodes NOT included in batch)                                   |
| --quality, -q        | String | N        | GBSHOW_QUALITY           | Video/image quality to download: [highest, hd, high, low]. Default: highest                  |
| --show-only,         |        | N        |                          | Ignore videos; only save information related to the show itself                              |
| --out, -o            | String | N*       | GBSHOW_OUT               | File output template; populated by video and show details. "none" for no output.             |
| --video-out, -V      | String | N*       | GBSHOW_VIDEO_OUT         | Video file output template; populated by video and show details. Default is `--out` value. "none" for no output.  |
| --image-out, -I      | String | N*       | GBSHOW_IMAGE_OUT         | Thumbnail file output template; populated by video and show details. Default is `--out` value. "none" for no output.  |
| --metadata-out, -M   | String | N*       | GBSHOW_METADATA_OUT      | Metadata file output template; populated by video and show details. Default is `--out` value. "none" for no output.  |
| --show-out, -S       | String | N*       | GBSHOW_SHOW_OUT          | Show file output template; populated by video and show details. "none" for no output.  |
| --show-image-out     | String | N*       | GBSHOW_SHOW_IMAGE_OUT    | Show thumbnail file output template; populated by show details. Default is `--show-out` value. "none" for no output.  |
| --show-metadata-out  | String | N*       | GBSHOW_SHOW_METADATA_OUT | Show metadata file output template; populated by show details. Default is `--show-out` value. "none" for no output.  |
| --file-limit, -f     | Number | N        | GBSHOW_FILE_LIMIT        | The number of _new_ (not skipped) episodes to download before halting.                 |
| --megabyte-limit, -m | Number | N        | GBSHOW_MEGABYTE_LIMIT    | The number of _new_ (not skipped) megabytes to download before halting.                |
| --replace, -r        |        | N        | GBSHOW_REPLACE           | Replace (overwrite) local files that already exist by downloading them again           |
| --commit             |        | N*       | GBSHOW_COMMIT            | Download the indicated files without first waiting for user confirmation               |

## Download Video Ranges

The `download` command retrieves a batch of videos from a single show: an entire show, season(s) of episodes, a manually specified episode range, or just one video. For example:

`./gb-show download <show>` To retrieve an entire show's worth of videos

`./gb-show download <show> --season <string/number>` To retrieve one season of videos

`./gb-show download --video <string>` To retrieve one video by name

`./gb-show download <show> --episode <number> [--season <number>]` To retrieve one video by episode number

More complex ranges can be specified using anchors: the words [from, after, through, to] begin such a range description.

### Range Options

**At least one option is required.**

| Option               | Type   | Required  | ENV variable             | Description  |

| -------------------- | ------ | --------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| <text>               | String | Y*        |                          | Season/episode number formatted like S02, E17, or S02E17.                                    |
| --video, -v          | String | Y*        |                          | Used to find a matching video -- title, episode name, game.                                  |
| --episode, -e        | Number | Y*        |                          | One-based index for the video. If `--season`, counts within that season; otherwise within the show. Earliest episode is `1`. |
| --season, -s         | String/Number | Y* |                          | The season (one-based index, or name) for the videos.                                        |

### Range Combinations

When multiple ranges are specified, only videos included in all of them will be considered.

`from` and `after` include all episodes _after_ the specified video, with `from` including it.

`through` and `to` include all episodes _before_ the specified video, with `through` including it.

For example:

`./gb-show download <show> --season 2 from --episode 10 to --episode 20` will download episodes 10 through 19 of season 2.

## Download Output Templates

Output filenames and locations _must_ be manually specified, or no files will be written. Output templates should include both the containing directories and the filename itself (file extension will be automatically appended).

Template values, specified in curly braces (e.g. "{name}"), will be replaced with video-specific details when writing a particular file. For instance,

./gb-show download --video "Quick Look Nidhogg" --video-out "output/{show}/{year} {game}" will write to a file named "output/Quick Look/2014 Nidhogg.mp4".

### Output Template Values

| Key               | Description  |

| ----------------- | --------------------------------------------- |
| {name}            | The name of the video                         |
| {game}            | The game featured in the video                |
| {time}            | The video's publication date and time         |
| {date}            | The video's publication date                  |
| {year}            | The video's publication year                  |
| {episode}         | The video's episode number within the season  |
| {show_episode}    | The video's episode number within the show    |
| {episode_count}         | The total episode number within the season  |
| {show_episode_count}    | The total episode number within the show    |
| {episode}         | The video's episode number within the season  |
| {guid}    | The video's GB API GUID    |
| {id}    | The video's GB API ID    |
| {show}    | The show's title    |
| {show_guid}    | The show's GB API GUID    |
| {show_id}    | The show's GB API ID    |
| {season_name}    | The season's inferred; a year, or a game title    |
| {season_number}    | The season's number, starting with 1    |
| {season_count}    | The show's total number of seasons (so far)   |
| {quality}    | The file quality saved    |

## .env File

Most command line options can be replaced with environment variables. For convenience, `.env.example` lists those options (commented) and sample values. To activate those env variables, create a file named `.env` containing any desired values copied-and-modified from `.env.example`. The `gb-show` script will automatically use those settings when run if `.env` is in the current working directory.

## [Giant Bomb API](https://www.giantbomb.com/api)

Searching through shows and videos and constructing a season-structure for a given show can require a lot of API calls. Call are rate-limited (1 second per call) and responses are cached for four hours (`gb-show.cache.json` is created in your working directory); the cache duration can be altered by the `GBSHOW_API_CACHE_MINUTES` environment variable. Due to the number of calls involved, `gb-show` may appear temporarily unresponsive when a show with many episodes is specified (`--log-level trace` can reveal what it's doing).

Always stay in compliance with the [API usage guidelines](https://www.giantbomb.com/api/) and don't download more than 100 videos in a day.

## Alternatives

`gb-show` is intended for downloading and organizing medium to large batches of Giant Bomb videos, for personal archival or viewing through programs like Plex. Although it can be used to download just a few of your favorite videos or the latest releases for the week, this isn't its primary purpose.

If `gb-show` seems overly complicated, or too specific in functionality for you, try [gb-dl](https://github.com/lightpohl/gb-dl), which has a simpler interface designed around downloading individual videos rather than show or season batches.

You could also download them directly from the [Giant Bomb](https://www.giantbomb.com) website!
