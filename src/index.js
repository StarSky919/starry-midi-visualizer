import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import ProgressBar from 'progress';
import { search, formatTime, formatOutput } from './utils.js';
import { parseMidi } from './midifile.js';
import { Renderer } from './renderer.js';

const pkgPath = path.resolve(import.meta.dirname, '../package.json');
const { version } = JSON.parse(await fs.readFile(pkgPath));

const defaultConfig = {
  resolution: [1920, 1080],
  framerate: 60,
  crf: 16,
  bgcolor: '#000000',
  keyh: 156,
  line: null, // '#A02222'
  border: false,
  notespeed: 1,
};

export const allKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const blackKeys = ['C#', 'D#', 'F#', 'G#', 'A#'];
export const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const channelColors = ['#FF0000', '#FF4D00', '#FF9900', '#FFD700', '#FFFF00', '#D7FF00', '#99FF00', '#4DFF00', '#00FF00', '#00FF4D', '#00FF99', '#00FFD7', '#00FFFF', '#4D00FF', '#9900FF', '#D700FF'];
export const EventTypes = {
  SET_TEMPO: 'Set Tempo',
  END_OF_TRACK: 'End of Track',
  NOTE_ON: 'Note On',
  NOTE_OFF: 'Note Off',
};

const barFormat = 'Progress: :pct% (:current of :total frames) Time spent: :time';

export class StarryMidiVisualizer {
  static VERSION = version;

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

  constructor(config) {
    this.config = {
      ...defaultConfig,
      ...config,
    };
    this.renderer = new Renderer(this);
    this.renderer.initialize();
  }

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
      const tempoTime = tempo.time;
      const elapsedBeats = (tick - tempo.tick) / this.tpqn;
      return tempoTime + (60 / tempo.bpm) * elapsedBeats;
    } else {
      const beats = tick / this.tpqn;
      return (60 / 120) * beats;
    }
  }

  secondToTick(second) {
    const index = search(this.tempos, second, 'time');

    if (index !== -1) {
      const tempo = this.tempos[index];
      const tempoTime = tempo.time;
      const elapsedTime = second - tempoTime;
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

  async render(filename) {
    if (!this.fileLoaded) {
      throw new Error('No file was loaded');
    }

    console.log('================');
    console.log(`StarryMidiVisualizer ${version}`);

    this.renderer.pixelsPerTick = this.renderer.height / 2 / this.tpqn * this.config.notespeed;
    this.currentTime = -1000;
    const maxTime = this.songTime + 1000;

    console.log(formatOutput(
      `Duration: ${formatTime(this.songTime)}\tTPQN: ${this.tpqn}`,
      `Resolution: ${this.renderer.width}x${this.renderer.height}\tFramerate: ${this.config.framerate}fps`,
      `Note speed: ${this.config.notespeed}\tKeyboard height: ${this.config.keyh}px`,
      `RAM used：${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}M`,
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
      '-f', 'image2pipe',
      '-framerate', `${this.config.framerate}`,
      '-i', '-',
      '-c:v', 'libx264',
      '-crf', this.config.crf,
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuv420p',
      '-y',
      `${filename}`,
    ]);

    console.log('Rendering frames...');
    const startTime = Date.now();
    const totalFrames = Math.ceil((maxTime - this.currentTime) / (1000 / this.config.framerate));
    const renderProgress = new ProgressBar(barFormat, { total: totalFrames, stream: process.stdout });
    const lastIndex = [0, 0];
    let renderedFrames = 0;
    while (this.currentTime <= maxTime) {
      for (let n = 0; n < lastIndex.length; n++) {
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