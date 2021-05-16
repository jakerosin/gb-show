'use strict';

// packages
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
// internal
import Logger from '../../utils/logger';
import sharedOptions from './options';

interface OptionDefinition {
  name: string;
  alias?: string;
  description?: string;
  type: any;  // TODO figure this out
  typeLabel?: string;
  multiple?: boolean;
  defaultOption?: boolean;
  defaultValue?: any;
}

interface UsageExample {
  desc: string;
  example: string;
}

interface UsageCommand {
  name: string;
  summary: string;
}

type UsageContent = string|string[]|UsageExample[]|UsageCommand[];

interface UsageSection {
  header?: string;
  content?: UsageContent;
  optionList?: OptionDefinition[];
}

interface ParserOpts {
  title: string;
  description: string;
  aliases?: UsageContent|void;
  synopsis?: UsageContent|void;
  options?: OptionDefinition[]|void;
  examples?: UsageContent|void;
  misc?: UsageSection[]|void;
  footer?: UsageContent|void;
  logger?: Logger|void;
}

export default class Parser implements ParserOpts {
  // opts
  title: string;
  description: string;
  aliases: UsageContent|void;
  synopsis: UsageContent|void;
  options: OptionDefinition[]|void;
  examples: UsageContent|void;
  misc: UsageSection[]|void;
  footer: UsageContent|void;

  // combined
  usage: UsageSection[];

  constructor(opts: ParserOpts) {
    this.title = opts.title;
    this.description = opts.description;
    this.aliases = opts.aliases;
    this.synopsis = opts.synopsis;
    this.options = opts.options ? [...opts.options, sharedOptions.help] : [sharedOptions.help];
    this.examples = opts.examples;
    this.misc = opts.misc;
    this.footer = opts.footer;

    this.usage = [
      {
        header: this.title,
        content: this.description
      }
    ];

    if (this.aliases) this.usage.push({
      header: 'Aliases',
      content: this.aliases
    });

    if (this.synopsis) this.usage.push({
      header: 'Synopsis',
      content: this.synopsis
    });

    if (this.options) this.usage.push({
      header: 'Options',
      optionList: this.options
    });

    if (this.examples) this.usage.push({
      header: 'Examples',
      content: this.examples
    });

    if (this.misc) {
      for (const m of this.misc) {
        this.usage.push(m);
      }
    }

    if (this.footer) this.usage.push({
      content: this.footer
    });
  }

  help(): string {
    return commandLineUsage(this.usage);
  }

  parse(argv: string[]|void, opts: any = {}): any {
    return argv
      ? commandLineArgs(this.options, { argv, ...opts })
      : commandLineArgs(this.options, { stopAtFirstUnknown: true, ...opts });
  }

  process(argv: string[]|void, logger: Logger|void = null, opts: any = {}): any|void {
    const options = this.parse(argv, opts);
    const command = (argv && argv.length) ? argv[0] : 'none';
    if (options.help || (options.command && options.command.toLowerCase() === 'help') || command.toLowerCase() === 'help') {
      if (logger) {
        logger.print(this.help());
      } else {
        console.log(this.help());
      }
      return null;
    }

    return options;
  }
}
