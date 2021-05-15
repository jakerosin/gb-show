'use strict';

import { VideoShow } from '../../api';
import { VideoEpisodeMatch } from './videos';

import path from 'path';
import filenamify from 'filenamify';

const templateAliases = {
  name: ['name', 'video', 'episode_name', 'video_name', 'title', 'episode_title', 'video_title'],
  game: ['game', 'association'],
  time: ['time', 'publish_time', 'publication_time'],
  date: ['date', 'publish_date', 'publication_date'],
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
  season_count: ['season_count']
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

export function value(templateKey: string, show: VideoShow, episode: VideoEpisodeMatch): string {
  return filenamify(unsafeValue(templateKey, show, episode), { replacement:'-' });
}

function unsafeValue(templateKey: string, show: VideoShow, episode: VideoEpisodeMatch): string {
  const key = aliaseToTemplateKey[templateKey.toLowerCase()];
  if (key === 'name') return `${episode.video.name}`;
  if (key === 'game') {
    if (episode.video.associations && episode.video.associations.length) {
      return `${episode.video.associations[0].name}`;
    }
  }
  if (key === 'time') {
    const date = new Date(`${episode.video.publish_date}Z`);
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '')
  }
  if (key === 'date') {
    const date = new Date(`${episode.video.publish_date}Z`);
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '').split(' ')[0];
  }
  if (key === 'year') {
    const date = new Date(`${episode.video.publish_date}Z`);
    return date.toISOString().replace(/T/, ' ').replace(/\..+/, '').split('-')[0];
  }
  if (key === 'episode') return padded(episode.seasonEpisodeNumber, Math.max(10, episode.seasonEpisodeCount));
  if (key === 'show_episode_number') return padded(episode.showEpisodeNumber, Math.max(10, episode.showEpisodeCount));
  if (key === 'episode_count') return padded(episode.seasonEpisodeCount, Math.max(10, episode.seasonEpisodeCount));
  if (key === 'show_episode_count') return padded(episode.showEpisodeCount, Math.max(10, episode.showEpisodeCount));
  if (key === 'guid') return `${episode.video.guid}`;
  if (key === 'id') return `${episode.video.id}`;
  if (key === 'show') return `${show.title}`;
  if (key === 'show_guid') return `${show.guid}`;
  if (key === 'show_id') return `${show.id}`;
  if (key === 'season_name') return episode.seasonName;
  if (key === 'season_number') return padded(episode.seasonNumber, episode.seasonCount);
  if (key === 'season_count') return `${episode.seasonCount}`;

  throw new Error(`No value for template key ${templateKey}`);
}

export function map(template: string, show: VideoShow, episode: VideoEpisodeMatch): string {
  let mapped = template;
  for (const templateName in templateAliases) {
    const templateValue = value(templateName, show, episode);
    for (const templateKey of templateAliases[templateName]) {
      const regexp = RegExp(`{${templateKey}}`, 'ig');
      mapped = mapped.replace(regexp, templateValue);
    }
  }
  return mapped;
}

export const template = {
  value,
  map
}

export default template;
