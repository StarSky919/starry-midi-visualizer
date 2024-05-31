#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { loadImage } from 'canvas';
import createCLI from './index.js';
import StarryMidiVisualizer from '../index.js';

function inRange(num, min, max) {
  return (num - min) * (num - max) <= 0;
}

function printAndExit(message) {
  console.log(message);
  process.exit(0);
}

function isNumber(src) {
  const value = +src;
  if (Number.isFinite(value)) return value;
  throw 'please enter a number';
}

function isHexColor(src) {
  if (/^((#|0x)[a-f0-9]{3}|(#|0x)[a-f0-9]{6})$/i.test(src)) return src.replace(/^0x/, '#');
  throw 'please enter a correct hex color (starts with \'0x\' or \'#\')';
}

async function isFile(src) {
  const fullPath = path.isAbsolute(src) ? src : path.resolve(process.cwd(), src);
  await fs.access(fullPath).catch(() => {
    throw `'${fullPath}' does not exists`;
  });
  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    throw `'${fullPath}' is a directory`;
  }
  return fullPath;
}

function createRLI() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return {
    getInput: message => new Promise(resolve => rl.question(message, resolve)),
    close: () => rl.close(),
  };
}

const cwd = process.cwd();
const cli = createCLI('smv');

const pkgPath = path.resolve(import.meta.dirname, '../../package.json');
const { version } = JSON.parse(await fs.readFile(pkgPath));
cli.version(version);

cli.option('resolution', '-r <value> output video resolution (default: 1920x1080)', {
  transform(src) {
    const [w, h] = src.split('x').map(Number);
    if ([w, h].some(v => !v)) throw 'please enter a correct value (e.g. 1920x1080)';
    return [w, h];
  },
});
cli.option('framerate', '-f <fps> output video framerate (default: 60)', { transform: isNumber });
cli.option('crf', '<value> ffmpeg crf (default: 16)', { transform: isNumber });
cli.option('output', '-o <path> output video file (default: <input filename>.mp4)', {
  async transform(src) {
    const fullPath = path.isAbsolute(src) ? src : path.resolve(process.cwd(), src);
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (exists) {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
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
cli.option('bgcolor', '-b <hex> background color (default: 0x000000)', { transform: isHexColor });
cli.option('keyh', '-k <pixels> keyboard height (default: 156)', { transform: isNumber });
cli.option('line', '-l <hex> shows a colored line on keyboard', { transform: isHexColor });
cli.option('border', 'apply borders to notes and disable highlight');
cli.option('notespeed', '-s <ratio> pixelsPerTick = videoHeight / 2 / TPQN * <ratio> (default: 1)', { transform: isNumber });

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
      console.log('Please enter a right number');
      continue;
    }
    close();
    return midis[input];
  }
}

const midiFile = await getFile();
const fullPath = await isFile(midiFile).catch(printAndExit);

const smv = new StarryMidiVisualizer(options);
await smv.loadFile(fullPath);
smv.render(options.output ?? `${path.basename(fullPath)}.mp4`);