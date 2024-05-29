#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import CLI from './index.js';

const cli = CLI('smv');

const pkgPath = resolve(import.meta.dirname, '../../package.json');
const { version } = JSON.parse(await readFile(pkgPath));
cli.version(version);

cli.option('config', '-c <file> specify a config file');

const { args, options } = cli.parse();
console.log(options);

/* const cli = cac('smv');
cli.version(version);
cli.option('-c, --config <file>');
cli.help(section => {
  section[0].body = section[0].body.replace('smv/', 'StarryMidiVisualizer v');
  return section;
});

const { args, options } = cli.parse();
console.log(args, options); */

/* import('../index.js').then(m => m.default)
  .then(async StarryMidiVisualizer => {
    const filename = process.argv[2];
    if (!filename) throw new Error('请指定一个Midi文件');
    const smv = new StarryMidiVisualizer({
      fps: 60,
      noteSpeed: 1.5,
      border: true,
      background: '#C0C0C0',
    });
    await smv.loadFile(filename);
    smv.render(filename.replace(/\.mid$/i, '.mp4'));
  }); */