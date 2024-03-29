import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import ProgressBar from 'progress';
import { createCanvas } from 'canvas';
import { search, formatTime } from './utils.js';
import { parseMidi } from './midifile.js';
import { Renderer } from './renderer.js';

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

const barFormat = '当前进度: :pct% (:current / :total 帧) 已用时: :time';

export class StarryMidiVisualizer {
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
  renderer;

  constructor(options) {
    this.renderer = new Renderer(this, createCanvas(1920, 1080), options);
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

    console.log('----------------');
    console.log('StarryMidiVisualizer (Developed by StarSky919)');

    this.renderer.pixelsPerBeat = this.renderer.height / 2 / this.tpqn * this.renderer.noteSpeed;
    this.currentTime = -1000;
    const maxTime = this.songTime + 1000;

    console.log(`Midi时长: ${formatTime(this.songTime)} TPQN: ${this.tpqn}`);
    console.log(`视频分辨率: ${this.renderer.width}x${this.renderer.height} 视频帧率: ${this.renderer.fps}`);
    console.log(`音符流速: ${this.renderer.noteSpeed} 键盘高度: ${this.renderer.keysHeight} (~${this.renderer.kh.toFixed(2)}px)`);
    console.log('----------------');

    console.log('正在进行音符预处理……');
    this.notes.forEach(note => {
      note.reset();
      const key = this.renderer.allKeys[note.keyCode];
      note.x = key.left;
      note.h = note.duration * this.renderer.pixelsPerBeat;
      if (note.h < 1) note.h = 1;
      note.y = note.start * this.renderer.pixelsPerBeat;
      note.isBlack = key.isBlack;
    });
    this.notes.sort((a, b) => a.start - b.start);
    this.renderingNotes[0] = this.notes.filter(note => !note.isBlack);
    this.renderingNotes[1] = this.notes.filter(note => note.isBlack);

    const ffmpeg = spawn('ffmpeg', [
      '-f', 'image2pipe',
      '-framerate', `${this.renderer.fps}`,
      '-i', '-',
      '-c:v', 'libx264',
      '-crf', '16',
      '-preset', 'ultrafast',
      '-tune', 'zerolatency',
      '-pix_fmt', 'yuvj420p',
      '-y',
      `${filename}`,
    ]);

    console.log('正在渲染和转换帧……');
    const startTime = Date.now();
    const totalFrames = Math.ceil((maxTime - this.currentTime) / (1000 / this.renderer.fps));
    const renderProgress = new ProgressBar(barFormat, { total: totalFrames, stream: process.stdout });
    const lastIndex = [0, 0];
    let renderedFrames = 0;
    while (this.currentTime <= maxTime) {
      for (let n = 0; n < lastIndex.length; n++) {
        let i = lastIndex[n];
        while (i < this.renderingNotes[n].length) {
          if (!this.renderingNotes[n][i].played) break;
          i++
        }
        lastIndex[n] = i;
      }
      this.renderer.render(this.currentTick, this.renderingNotes, lastIndex);
      ffmpeg.stdin.write(this.renderer.cav.toBuffer());
      this.currentTime += 1000 / this.renderer.fps;
      renderedFrames++;

      const percent = Math.floor(renderedFrames / totalFrames * 1e4) / 1e2;
      renderProgress.tick({
        pct: percent.toFixed(2),
        time: formatTime(Date.now() - startTime),
      });
    }
    if (!renderProgress.complete) renderProgress.terminate();

    console.log('正在生成视频……');
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
        generateProgress.update(1,  {
          pct: '100.00',
          time: formatTime(Date.now() - startTime2),
        });
      }
      console.log(`视频已保存至 ${filename}`);
    });
    ffmpeg.stdin.end();
  }
}

export default StarryMidiVisualizer;