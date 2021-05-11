'use strict';

export async function wait(millis: number): Promise<void> {
  return new Promise((res) => {
    setTimeout(function() {
      res(null);
    }, millis);
  })
};
