import fs from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';

export function inRange(num, min, max) {
  return (num - min) * (num - max) <= 0;
}

export function checkNumber(min, max) {
  const check = isNaN(min) ?
    () => true :
    isNaN(max) ?
    num => num >= min :
    num => inRange(num, min, max);
  return function(src) {
    const num = +src;
    if (Number.isFinite(num) && check(num)) return num;
    throw 'please enter a correct number';
  };
}

export function checkHexColor(src) {
  if (/^((#|0x)[a-f0-9]{3}|(#|0x)[a-f0-9]{6})$/i.test(src)) return src.replace(/^0x/, '#');
  throw 'please enter a correct hex color (starts with \'0x\' or \'#\')';
}

export function resolvePath(src) {
  return path.isAbsolute(src) ? src : path.resolve(process.cwd(), src);
}

export async function isDirectory(path) {
  const stat = await fs.stat(path);
  return stat.isDirectory();
}

export async function checkFile(src) {
  const fullPath = resolvePath(src);
  await fs.access(fullPath).catch(() => {
    throw `Error: '${fullPath}' does not exists`;
  });
  if (await isDirectory(fullPath)) {
    throw `Error: '${fullPath}' is a directory`;
  }
  return fullPath;
}

export function createRLI() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return {
    getInput: message => new Promise(resolve => rl.question(message, resolve)),
    close: () => rl.close(),
  };
}

export function printAndExit(message) {
  console.log(message);
  process.exit(0);
}