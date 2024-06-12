#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import createCLI from './index.js';
import {
  inRange,
  checkNumber,
  checkHexColor,
  resolvePath,
  isDirectory,
  checkFile,
  createRLI,
  printAndExit,
} from './utils.js';
import StarryMidiVisualizer from '../index.js';

const cwd = process.cwd();
const cli = createCLI('smvc');

cli.version(StarryMidiVisualizer.VERSION);

cli.option('resolution', '-r <value> output video resolution (default: 720x60)', {
  transform(src) {
    const [w, h] = src.split('x').map(Number);
    if (![w, h].every(v => v > 0)) throw 'please enter a correct value (e.g. 720x60)';
    return [w, h];
  },
});
cli.option('framerate', '-f <fps> output video framerate (default: 60)', { transform: checkNumber(0) });
cli.option('crf', '<value> ffmpeg crf (default: 16)', { transform: checkNumber(0, 51) });
cli.option('output', '-o <path> output video file (default: <filename>_counter.mp4)', {
  async transform(src) {
    const fullPath = resolvePath(src);
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (exists) {
      if (await isDirectory(fullPath)) {
        throw `'${fullPath}' is a directory`;
      }
      const { getInput, close } = createRLI();
      const input = await getInput(`'${fullPath}' already exists, overwrite? [y/N] `);
      if (input.toLowerCase() !== 'y') process.exit(0);
      close();
    }
    return fullPath;
  },
});
cli.option('font', '-F <path> the font file to use', { transform: checkFile });
cli.option('align', '-a <hex> text align (default: left)', {
  transform(src) {
    if (!['left', 'right'].includes(src)) throw 'the value must be \'left\' or \'right\'';
    return src;
  },
});
cli.option('txcolor', '-c <hex> text color (default: 0xFFFFFF)', { transform: checkHexColor });
cli.option('bgcolor', '-b <hex> background color (default: 0xA0A0A0)', { transform: checkHexColor });
cli.option('bdwidth', '-w <pixels> border width (default: 2)', { transform: checkNumber(1) });
cli.option('bdcolor', '-B <hex> border color (default: 0x252525)', { transform: checkHexColor });
cli.option('starttime', '-t <seconds> set the start time offset (default: -1)', { transform: checkNumber() });
cli.option('duration', '-d <seconds> set the cut duration', { transform: checkNumber(1) });

const { args, options } = await cli.parse();

async function getFile() {
  const fileInput = args.shift();
  if (fileInput) return fileInput;

  const files = await fs.readdir(process.cwd());
  const midis = files.filter(name => name.endsWith('.mid'));

  if (!midis.length) {
    printAndExit('Error: Could not find a MIDI file in current directory');
  }

  for (let i = 0; i < midis.length; i++) {
    console.log(`[${i}] ${midis[i]}`);
  }

  const { getInput, close } = createRLI();

  while (true) {
    let input = await getInput('Enter a number to select, or leave blank to cancel: ');
    if (!input) process.exit(0);
    input = +input;
    if (isNaN(input) || !inRange(input, 0, midis.length - 1)) {
      console.log('Please enter a correct number');
      continue;
    }
    close();
    console.log('================');
    return midis[input];
  }
}

const midiFile = await getFile();
const fullPath = await checkFile(midiFile).catch(printAndExit);
const smv = new StarryMidiVisualizer.Counter(options);
await smv.loadFile(fullPath);
smv.render(options.output ?? `${path.basename(fullPath).replace(/.mid$/i, '')}_counter.mp4`);