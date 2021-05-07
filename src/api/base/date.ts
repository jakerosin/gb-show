'use strict';

export function toString(date: Date): string {
  return date.toISOString()
    .replace(/T/, ' ')
    .replace(/\..+/, '');
}

export function fromString(str: string): Date {
  return new Date(`${str}Z`);
}

export function toStringFields(obj: any, fields: string|string[]): any {
  const result: any = { ...obj };
  const fieldNames = [].concat(fields);
  for (const field of fieldNames) {
    if (result[field] !== void 0) {
      result[field] = toString(result[field]);
    }
  }
  return result;
}

export function fromStringFields(obj: any, fields: string|string[]): any {
  const result: any = { ...obj };
  const fieldNames = [].concat(fields);
  for (const field of fieldNames) {
    if (result[field] !== void 0) {
      result[field] = fromString(result[field]);
    }
  }
  return result;
}
