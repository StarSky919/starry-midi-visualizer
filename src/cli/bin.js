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
const cli = createCLI('smv');

cli.version(StarryMidiVisualizer.VERSION);

cli.option('resolution', '-r <value> output video resolution (default: 1920x1080)', {
  transform(src) {
    const [w, h] = src.split('x').map(Number);
    if (![w, h].every(v => v > 0)) throw 'please enter a correct value (e.g. 1920x1080)';
    return [w, h];
  },
});
cli.option('framerate', '-f <fps> output video framerate (default: 60)', { transform: checkNumber(0) });
cli.option('crf', '<value> ffmpeg crf (default: 16)', { transform: checkNumber(0, 51) });
cli.option('output', '-o <path> output video file (default: <input filename>.mp4)', {
  async transform(src) {
    const fullPath = resolvePath(src);
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (exists) {
      if (await isDirectory(fullPath)) {
        throw `Error: '${fullPath}' is a directory`;
      }
      const { getInput, close } = createRLI();
      const input = await getInput(`'${fullPath}' already exists, overwrite? [y/N] `);
      if (input.toLowerCase() !== 'y') process.exit(0);
      close();
    }
    return fullPath;
  },
});
cli.option('bgcolor', '-b <hex> background color (default: 0x000000)', { transform: checkHexColor });
cli.option('keyh', '-k <pixels> keyboard height (default: 156)', { transform: checkNumber(0) });
cli.option('line', '-l <hex> shows a colored line on keyboard', { transform: checkHexColor });
cli.option('colormode', '-c <mode> note color based on \'channel\' or \'track\' (default: channel)', {
  transform(src) {
    if (['track', 'channel'].includes(src.toLowerCase())) return src;
    throw 'the value must be \'channel\' or \'track\'';
  },
});
cli.option('border', 'apply borders to notes and disable highlight');
cli.option('notespeed', '-s <ratio> pixPerTick = vHeight / 2 / TPQN * <ratio> (default: 1)', { transform: checkNumber(0.05) });
cli.option('starttime', '-t <seconds> set start time of the song (default: -1)', { transform: checkNumber() });

cli.example('smv song.mid');
cli.example('smv -r 2560x1440 -k 208 -s 1.5');
cli.example('smv song.mid -b 0xC0C0C0 --border -o ../Videos/song.mp4');

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
const smv = new StarryMidiVisualizer(options);
await smv.loadFile(fullPath);
smv.render(options.output ?? `${path.basename(fullPath)}.mp4`);