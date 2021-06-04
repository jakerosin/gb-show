'use strict';

import { Video, VideoShow } from '../../api';
import { CatalogEpisodeReference } from './catalog';

import path from 'path';
import filenamify from 'filenamify';

export interface TemplateOpts {
  show?: VideoShow|void;
  video?: Video|void;
  episode?: CatalogEpisodeReference|void;
  quality?: string|void;
  finalize?: boolean|void;
}

const templateAliases = {
  name: ['name', 'video', 'episode_name', 'video_name', 'title', 'episode_title', 'video_title'],
  game: ['game', 'association'],
  time: ['time', 'publish_time', 'publication_time'],
  date: ['date', 'publish_date', 'publication_date'],
  date_text: ['date_text'],
  year: ['year', 'publish_year', 'publication_year'],
  episode: ['number', 'season_episode', 'season_episode_number', 'episode_number', 'season_video', 'season_video_number', 'video_number', 'episode', 'ep', 'e'],
  show_episode_number: ['show_episode_number', 'show_video_number', 'show_episode', 'show_video'],
  episode_count: ['count', 'season_episode_count', 'episode_count'],
  show_episode_count: ['show_episode_count', 'show_video_count'],
  guid: ['guid'],
  id: ['id'],
  show: ['show', 'show_name', 'show_title'],
  show_guid: ['show_guid'],
  show_id: ['show_id'],
  season_name: ['season_name', 'season_title'],
  season_number: ['season', 'season_number', 's'],
  season_count: ['season_count'],
  premium: ['premium'],
  quality: ['quality', 'q']
}

const templateDefault = {
  name: 'Untitled Video',
  game: 'Unknown Game',
  time: '1900-01-01 00-00-00',
  date: '1900-01-01',
  year: '1900',
  episode: '00',
  show_episode_number: '00',
  episode_count: '00',
  show_episode_count: '00',
  guid: '0000-0000',
  id: '0',
  show: 'Giant Bomb',
  show_guid: '0000-0000',
  show_id: '0',
  season_name: 'Specials',
  season_number: '00',
  season_count: '00',
  premium: 'Unknown',
  quality: 'any'
}

const aliaseToTemplateKey = {};
Object.keys(templateAliases).map(key => {
  templateAliases[key].forEach(alias => {
    aliaseToTemplateKey[alias] = key;
  });
});

function padded(num: number, cap: number): string {
  let sig_digits = 0;
  while (cap > 0.6) {  // episode seven prompts a switch to "01, 02" numbering.
    sig_digits++;
    cap /= 10;
  }

  return `${num}`.padStart(sig_digits, '0');
}

export function value(templateKey: string, templateOpts: TemplateOpts): string|void {
  const key = aliaseToTemplateKey[templateKey.toLowerCase()];
  const defaultV = templateOpts.finalize ? templateDefault[key] : null;
  const v = unsafeValue(key, templateOpts);
  return v ? filenamify(v, { replacement:'-' }) : defaultV;
}

function unsafeValue(key: string, templateOpts: TemplateOpts): string|void {
  if (!key) throw new Error(`Template key ${key} not recognized`);

  const { show, episode, quality } = templateOpts;
  const video = templateOpts.video || (episode ? episode.video : null);
  if (show) {
    if (key === 'show') return `${show.title}`;
    if (key === 'show_guid') return `${show.guid}`;
    if (key === 'show_id') return `${show.id}`;
  }

  if (video) {
    if (key === 'name') return `${video.name}`;
    if (key === 'game') {
      if (video.associations && video.associations.length) {
        return `${video.associations[0].name}`;
      }
    }
    if (key === 'time') {
      const date = new Date(`${video.publish_date}Z`);
      return date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
    }
    if (key === 'date') {
      const date = new Date(`${video.publish_date}Z`);
      return date.toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[0];
    }
    if (key ===  'date_text') {
      const date = new Date(`${video.publish_date}Z`);
      const month = date.toLocaleString('default', { month: 'short' });
      return `${month}. ${date.getDate()}, ${date.getFullYear()}`;
    }
    if (key === 'year') {
      const date = new Date(`${video.publish_date}Z`);
      return date.toISOString().replace(/T/, ' ').replace(/\..+/, '').split('-')[0];
    }
    if (key === 'guid') return `${video.guid}`;
    if (key === 'id') return `${video.id}`;
    if (key === 'premium') return `${video.premium ? 'Premium' : 'Free'}`;
  }

  if (episode) {
    if (key === 'episode') return padded(episode.seasonEpisodeNumber, Math.max(10, episode.seasonEpisodeCount));
    if (key === 'show_episode_number') return padded(episode.showEpisodeNumber, Math.max(10, episode.showEpisodeCount));
    if (key === 'episode_count') return padded(episode.seasonEpisodeCount, Math.max(10, episode.seasonEpisodeCount));
    if (key === 'show_episode_count') return padded(episode.showEpisodeCount, Math.max(10, episode.showEpisodeCount));
    if (key === 'season_name') return episode.seasonName;
    if (key === 'season_number') return padded(episode.seasonNumber, episode.seasonCount);
    if (key === 'season_count') return `${episode.seasonCount}`;
  }

  if (quality) {
    if (key === 'quality') return quality;
  }

  return null;
}

export function map(template: string, templateOpts: TemplateOpts): string {
  let mapped = template;
  for (const templateName in templateAliases) {
    const templateValue = value(templateName, templateOpts);
    if (templateValue) {
      for (const templateKey of templateAliases[templateName]) {
        const regexp = RegExp(`{${templateKey}}`, 'ig');
        mapped = mapped.replace(regexp, templateValue);
      }
    }
  }
  return mapped;
}

export const template = {
  value,
  map
}

export default template;
