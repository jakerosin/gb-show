'use strict';

import { encode } from 'querystring';

import * as date from './date';

export interface ItemFilter {
  format?: 'xml'|'json'|'jsonp';
  fields?: string[];
}

interface ListSortFilter {
  field: string;
  direction: 'asc'|'desc';
}

interface ListValuesFilter {
  field: string;
  value: string|number|Date;
}

interface ListDateFilter {
  field:  string;
  start: Date;
  end: Date;
}

export type ListFieldFilter = ListValuesFilter|ListDateFilter;

export interface ListFilter extends ItemFilter {
  limit?: number;
  offset?: number;
  sort?: ListSortFilter;
  filter?: ListFieldFilter|ListFieldFilter[]
}

type SearchFilterResources = 'game'|'franchise'|'character'|'concept'|'object'
  |'location'|'person'|'company'|'video';

export interface PageFilter extends ItemFilter {
  limit?: number;
  page?: number;
  filter?: ListFieldFilter|ListFieldFilter[];
}

export interface SearchFilter extends PageFilter {
  limit?: number;
  page?: number;
  filter?: ListFieldFilter|ListFieldFilter[];
  query?: string;
  resources?: SearchFilterResources[]
}

// TODO this but with better typing
export function toParams(filter: any = {}): any {
  const params: any = { ...filter };
  if (filter.fields) {
    params.field_list = filter.fields.join();
    delete params.fields;
  }
  if (filter['sort']) {
    params.sort = `${filter['sort'].field}:${filter['sort'].direction}`;
  }
  if (filter['resources']) {
    params.resources = filter.resources.join();
  }
  if (filter['filter']) {
    const elems = [].concat(filter['filter']);
    const filterElements: ListValuesFilter[] = elems.map(e => {
      if (e.start) {
        return {
          field: e.field,
          value: `${date.toString(e.start)}|${date.toString(e.end)}`
        }
      } else if (e.value instanceof Date || Object.prototype.toString.call(e.value) === '[object Date]') {
        return {
          field: e.field,
          value: date.toString(e.value as Date)
        }
      } else {
        return {
          field: e.field,
          value: e.value
        }
      }
    })
    params.filter = filterElements.map(e => `${e.field}:${e.value}`).join()
  }

  return params;
}
