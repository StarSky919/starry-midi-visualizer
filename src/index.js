import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import ProgressBar from 'progress';
import { search, formatTime, formatOutput } from './utils.js';
import { Colors } from './components.js';
import { parseMidi } from './midifile.js';
import { Renderer } from './renderer.js';

const pkgPath = path.resolve(import.meta.dirname, '../package.json');
const { version } = JSON.parse(await fs.readFile(pkgPath));

const barFormat = 'Progress: :pct% (:current of :total frames) Time spent: :time';

class SMVBase {
  fileLoaded = false;
  size = 0;
  tpqn = 0;
  tempos = [];
  trackCount = 0;
  tracks = [];
  noteCount = 0;
  notes = [];
  renderingNotes = [];
  totalTicks = 0;
  songTime = 0;
  currentTime = 0;
  firstPlay = true;
  config;
  renderer;

  async loadFile(path) {
    const file = await fs.readFile(path);
    this.loadData(parseMidi(new Uint8Array(file)));
  }

  loadData({ size, tpqn, trackCount, tracks, noteCount }) {
    this.size = size;
    this.tpqn = tpqn;
    this.trackCount = trackCount;
    this.tracks = tracks;
    this.noteCount = noteCount;
    this.tracks.forEach(track => {
      track.color = Colors[track.index % Colors.length];
      track.tempoEvents.forEach(event => this.tempos.push(event));
      track.notes.forEach(note => this.notes.push(note));
    });
    this.totalTicks = Math.max.apply(null, this.tracks.map(track => track.duration));

    let currentTime = 0;
    let lastEventBeats = 0;
    this.tempos.sort((a, b) => a.tick - b.tick);
    this.tempos.forEach((event, index) => {
      const lastBPM = index > 0 ? this.tempos[index - 1].bpm : this.tempos[0].bpm;
      const beats = event.tick / this.tpqn - lastEventBeats;
      const elapsedSeconds = (60 / lastBPM) * beats;
      event.time = elapsedSeconds + currentTime;
      currentTime = event.time;
      lastEventBeats += beats;
    });

    this.songTime = this.tickToSecond(this.totalTicks) * 1000;
    this.fileLoaded = true;
  }

  tickToSecond(tick) {
    const index = search(this.tempos, tick, 'tick');

    if (index !== -1) {
      const tempo = this.tempos[index];
      const elapsedBeats = (tick - tempo.tick) / this.tpqn;
      return tempo.time + (60 / tempo.bpm) * elapsedBeats;
    } else {
      const beats = tick / this.tpqn;
      return (60 / 120) * beats;
    }
  }

  secondToTick(second) {
    const index = search(this.tempos, second, 'time');

    if (index !== -1) {
      const tempo = this.tempos[index];
      const elapsedTime = second - tempo.time;
      const elapsedBeats = elapsedTime / (60 / tempo.bpm);
      return Math.round(tempo.tick + elapsedBeats * this.tpqn);
    } else {
      const beats = second / (60 / 120);
      return Math.round(beats * this.tpqn);
    }
  }

  get currentTick() {
    return this.secondToTick(this.currentTime / 1000);
  }
}

class Counter extends SMVBase {
  static defaultConfig = {
    resolution: [720, 60],
    framerate: 60,
    crf: 16,
    align: 'left',
    txcolor: '#FFFFFF',
    bgcolor: '#A0A0A0',
    bdwidth: 2,
    bdcolor: '#252525',
    starttime: -1,
    duration: null,
  };

  constructor(config) {
    super();
    this.config = {
      ...Counter.defaultConfig,
      ...config,
    };
    this.renderer = new Renderer.Counter(this);
  }

  async render(filename) {
    if (!this.fileLoaded) {
      throw new Error('No file was loaded');
    }

    console.log('================');
    console.log(`StarryMidiVisualizer.Counter ${version}`);

    this.renderer.pixelsPerTick = this.renderer.height / 2 / this.tpqn * this.config.notespeed;
    this.currentTime = this.config.starttime * 1000;
    const maxTime = this.config.duration ? (this.currentTime + this.config.duration * 1000) : (this.songTime + 1000);

    console.log(formatOutput(
      `MIDI duration: ${formatTime(this.songTime)}\tTPQN: ${this.tpqn}`,
      `Resolution: ${this.config.resolution.join('x')}\tFramerate: ${this.config.framerate}fps`,
    ));
    console.log('================');

    console.log('Preprocessing notes...');
    if (!this.firstPlay) this.notes.forEach(note => {
      note.triggered = note.played = false;
    });
    this.notes.sort((a, b) => a.start - b.start);
    this.renderingNotes = this.notes;
    this.firstPlay = false;

    const ffmpeg = spawn('ffmpeg', [
      '-y', '-hide_banner',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgba',
      '-s', this.config.resolution.join('x'),
      '-r', this.config.framerate,
      '-i', '-',
      '-pix_fmt', 'yuv420p',
      '-crf', this.config.crf,
      '-c:v', 'libx264',
      filename,
    ]);

    console.log('Rendering frames...');
    const startTime = Date.now();
    const totalFrames = Math.ceil((maxTime - this.currentTime) / (1000 / this.config.framerate));
    const renderProgress = new ProgressBar(barFormat, { total: totalFrames, stream: process.stdout });
    const lastIndex = [0, 0];
    let renderedFrames = 0;
    while (renderedFrames < totalFrames) {
      const result = await this.renderer.render(this.currentTick, this.renderingNotes, lastIndex);
      ffmpeg.stdin.write(result);

      this.currentTime += 1000 / this.config.framerate;
      renderedFrames++;

      const percent = Math.floor(renderedFrames / totalFrames * 1e4) / 1e2;
      renderProgress.tick({
        pct: percent.toFixed(2),
        time: formatTime(Date.now() - startTime),
      });
    }
    if (!renderProgress.complete) renderProgress.terminate();

    console.log('Generating video...');
    const startTime2 = Date.now();
    const generateProgress = new ProgressBar(barFormat, { total: renderedFrames, stream: process.stdout });
    let lastFrames;
    ffmpeg.stderr.pipe(new Writable({
      write(chunk, encoding, callback) {
        const msg = chunk.toString();
        if (msg.startsWith('frame')) {
          const captures = /^frame=\s*(\d+)/.exec(msg);
          if (captures) {
            const frames = lastFrames = Number(captures[1]);
            const percent = Math.floor(frames / renderedFrames * 1e4) / 1e2;
            generateProgress.update(percent / 100, {
              pct: percent.toFixed(2),
              time: formatTime(Date.now() - startTime2),
            });
          }
        }
        callback();
      },
    }));
    ffmpeg.stderr.on('end', () => {
      if (lastFrames != renderedFrames) {
        generateProgress.update(1, {
          pct: '100.00',
          time: formatTime(Date.now() - startTime2),
        });
      }
      console.log(`Completed. Saved to '${filename}'`);
    });
    ffmpeg.stdin.end();
  }
}

export class StarryMidiVisualizer extends SMVBase {
  static VERSION = version;

  static Counter = Counter;

  static defaultConfig = {
    resolution: [1920, 1080],
    framerate: 60,
    crf: 16,
    bgcolor: '#000000',
    keyh: 156,
    line: null,
    colormode: 'channel',
    border: false,
    notespeed: 1,
    starttime: -1,
    duration: null,
  };

  constructor(config) {
    super();
    this.config = {
      ...StarryMidiVisualizer.defaultConfig,
      ...config,
    };
    this.renderer = new Renderer(this);
    this.renderer.initialize();
  }

  async render(filename) {
    if (!this.fileLoaded) {
      throw new Error('No file was loaded');
    }

    console.log('================');
    console.log(`StarryMidiVisualizer ${version}`);

    this.renderer.pixelsPerTick = this.renderer.height / 2 / this.tpqn * this.config.notespeed;
    this.currentTime = this.config.starttime * 1000;
    const maxTime = this.config.duration ? (this.currentTime + this.config.duration * 1000) : (this.songTime + 1000);

    console.log(formatOutput(
      `MIDI duration: ${formatTime(this.songTime)}\tTPQN: ${this.tpqn}`,
      `Resolution: ${this.config.resolution.join('x')}\tFramerate: ${this.config.framerate}fps`,
      `Note speed: ${this.config.notespeed}\tKeyboard height: ${this.config.keyh}px`,
    ));
    console.log('================');

    console.log('Preprocessing notes...');
    if (!this.firstPlay) this.notes.forEach(note => {
      note.triggered = note.played = false;
    });
    this.notes.sort((a, b) => a.start - b.start);
    this.renderingNotes[0] = this.notes.filter(note => !this.renderer.allKeys[note.keyCode].isBlack);
    this.renderingNotes[1] = this.notes.filter(note => this.renderer.allKeys[note.keyCode].isBlack);
    this.firstPlay = false;

    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-hide_banner',
      '-f', 'image2pipe',
      '-s', this.config.resolution.join('x'),
      '-r', this.config.framerate,
      '-i', '-',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-crf', this.config.crf,
      filename,
    ]);

    console.log('Rendering frames...');
    const startTime = Date.now();
    const totalFrames = Math.ceil((maxTime - this.currentTime) / (1000 / this.config.framerate));
    const renderProgress = new ProgressBar(barFormat, { total: totalFrames, stream: process.stdout });
    const lastIndex = [0, 0];
    let renderedFrames = 0;
    while (renderedFrames < totalFrames) {
      for (let n = 0; n < 2; n++) {
        let i = lastIndex[n];
        while (i < this.renderingNotes[n].length) {
          if (!this.renderingNotes[n][i].played) break;
          i++;
        }
        lastIndex[n] = i;
      }
      this.renderer.render(this.currentTick, this.renderingNotes, lastIndex);
      ffmpeg.stdin.write(this.renderer.cav.toBuffer());

      this.currentTime += 1000 / this.config.framerate;
      renderedFrames++;

      const percent = Math.floor(renderedFrames / totalFrames * 1e4) / 1e2;
      renderProgress.tick({
        pct: percent.toFixed(2),
        time: formatTime(Date.now() - startTime),
      });
    }
    if (!renderProgress.complete) renderProgress.terminate();

    console.log('Generating video...');
    const startTime2 = Date.now();
    const generateProgress = new ProgressBar(barFormat, { total: renderedFrames, stream: process.stdout });
    let lastFrames;
    ffmpeg.stderr.pipe(new Writable({
      write(chunk, encoding, callback) {
        const msg = chunk.toString();
        if (msg.startsWith('frame')) {
          const captures = /^frame=\s*(\d+)/.exec(msg);
          if (captures) {
            const frames = lastFrames = Number(captures[1]);
            const percent = Math.floor(frames / renderedFrames * 1e4) / 1e2;
            generateProgress.update(percent / 100, {
              pct: percent.toFixed(2),
              time: formatTime(Date.now() - startTime2),
            });
          }
        }
        callback();
      },
    }));
    ffmpeg.stderr.on('end', () => {
      if (lastFrames != renderedFrames) {
        generateProgress.update(1, {
          pct: '100.00',
          time: formatTime(Date.now() - startTime2),
        });
      }
      console.log(`Completed. Saved to '${filename}'`);
    });
    ffmpeg.stdin.end();
  }
}

export default StarryMidiVisualizer;