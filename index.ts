#!/usr/bin/env ts-node

'use strict'

const run = require('./src');

run(__dirname).then(a => process.exit(a));
