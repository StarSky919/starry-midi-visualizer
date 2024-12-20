import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';
import { createCanvas } from 'canvas';
import { Colors, Key } from './components.js';

export class Renderer {
  static Counter = class {
    constructor(smvc) {
      const {
        resolution,
        framerate,
        font,
        align,
        txcolor,
        bgcolor,
        bdwidth,
        bdcolor,
      } = smvc.config;

      this.ffarg1 = `color=s=${resolution.join('x')}:c=${bgcolor}`;
      this.ffarg2 = `drawtext=fontfile=${font}:text={COUNTER_TEXT}:fontsize=${resolution[1]}:fontcolor=${txcolor}:borderw=${bdwidth}:bordercolor=${bdcolor}:y=(h-text_h)/2${align === 'right' ? ':x=w-text_w' : ''}`;
    }

    render(currentTick, notes, index) {
      let noteCount = index[1];
      for (let i = index[0]; i < notes.length; i++) {
        if (notes[i].start < currentTick) noteCount++;
        else {
          index[0] = i;
          index[1] = noteCount;
          break;
        }
      }

      return new Promise(resolve => {
        const ffmpeg = spawn('ffmpeg', [
          '-v', 'error',
          '-f', 'lavfi',
          '-i', this.ffarg1,
          '-vf', this.ffarg2.replace('{COUNTER_TEXT}', noteCount),
          '-frames:v', '1',
          '-f', 'rawvideo',
          '-pix_fmt', 'rgba',
          '-',
        ]);
        const chunks = [];

        ffmpeg.stdout.pipe(new Writable({
          write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
          },
        }));

        ffmpeg.stdout.on('end', () => resolve(Buffer.concat(chunks)));
      });
    }
  };

  constructor(smv) {
    const {
      resolution,
      framerate,
      bgcolor,
      keyh,
      line,
      colormode,
      border,
      notespeed,
    } = smv.config;

    this.smv = smv;
    this.cav = createCanvas(...resolution);
    this.ctx = this.cav.getContext('2d');
    this.width = this.cav.width;
    this.height = this.cav.height;

    this.framerate = framerate;
    this.bgcolor = bgcolor;
    this.keyh = keyh;
    this.line = line;
    this.colormode = colormode;
    this.border = border;
    this.notespeed = notespeed;
    this.ky = this.height - this.keyh;

    this.allKeys = [];
    this.blackKeys = [];
    this.whiteKeys = [];
    this.wkw = this.width / 75;
    this.bkw = this.wkw * 0.5;
  }

  initialize() {
    this.allKeys = [];
    this.blackKeys = [];
    this.whiteKeys = [];

    const keysMap = [0, 0, 1, 1, 2, 3, 2, 4, 3, 5, 4, 6];
    for (let i = 0; i < 128; i++) {
      const j = i % 12;
      const k = Math.floor(i / 12);
      if ([1, 3, 6, 8, 10].includes(j)) {
        const bk = new Key(this.bkw, this.keyh * 0.65, true),
          l = this.bkw / 2,
          m = keysMap[j],
          n = Math.floor((m + k * 5) / 5) * 7;
        switch (m) {
          case 0:
            bk.left = this.wkw * (1 + n) - l - l * 0.375;
            break;
          case 1:
            bk.left = this.wkw * (2 + n) - l + l * 0.375;
            break;
          case 2:
            bk.left = this.wkw * (4 + n) - l - l * 0.375;
            break;
          case 3:
            bk.left = this.wkw * (5 + n) - l;
            break;
          case 4:
            bk.left = this.wkw * (6 + n) - l + l * 0.375;
            break;
        }
        this.allKeys.push(bk);
        this.blackKeys.push(bk);
      } else {
        const wk = new Key(this.wkw, this.keyh, false);
        wk.left = this.wkw * (keysMap[j] + k * 7);
        this.allKeys.push(wk);
        this.whiteKeys.push(wk);
      }
    }

    this.clear();
    this.drawBackground();
    this.drawKeyboard();
  }

  drawBackground() {
    this.ctx.fillStyle = this.bgcolor;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  drawNotes(currentTick, notes, index) {
    const ct = currentTick * this.pixelsPerTick;
    for (let i = index; i < notes.length; i++) {
      const note = notes[i];
      const noteColor = this.colormode === 'channel' ? Colors[note.channel] : this.smv.tracks[note.track].color;
      if (note.start <= currentTick) {
        if (note.start + note.duration < currentTick) {
          note.played = true;
          this.removeColor(note.keyCode, note.track, note.start);
        } else if (!note.triggered) {
          note.triggered = true;
          this.addColor(note.keyCode, note.track, note.start, noteColor);
        }
      }
      const kw = this.allKeys[note.keyCode].isBlack ? this.bkw : this.wkw;
      const h = Math.max(1, note.duration * this.pixelsPerTick);
      const x = this.allKeys[note.keyCode].left;
      const y = note.start * this.pixelsPerTick * -1 - h + this.ky + ct;
      if (y + h < 0) break;
      if (y > this.ky) continue;
      this.ctx.fillStyle = noteColor;
      this.ctx.fillRect(x, y, kw, h);
      if (this.border) {
        this.ctx.lineWidth = this.wkw * 0.0421875;
        this.ctx.strokeStyle = '#252525';
        this.ctx.strokeRect(x, y, kw, h);
      } else if (y + h >= this.ky) {
        const percent = (this.ky - y) / h;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * percent})`;
        this.ctx.fillRect(x, y, kw, h);
      }
    }
  }

  drawKeyboard() {
    this.ctx.fillStyle = this.bgcolor;
    this.ctx.fillRect(0, this.ky, this.width, this.keyh);

    this.whiteKeys.forEach(key => this.drawKeys(key));
    this.blackKeys.forEach(key => this.drawKeys(key));

    if (this.line) {
      const h = this.keyh / 30;
      this.ctx.fillStyle = this.line;
      this.ctx.fillRect(0, this.ky - h / 2, this.width, h);
    }
  }

  drawKeys(key) {
    const colorKeys = Object.keys(key.colors).map(key => key.split('_'));
    let h, color;

    if (colorKeys.length) {
      h = key.height / 35;
      const indexes = colorKeys.map(key => Number(key[0]));
      const ticks = colorKeys.map(key => Number(key[1]));
      const minIndex = Math.min(...indexes);
      const maxIndex = Math.max(...indexes);
      const maxTick = Math.max(...ticks);
      for (let i = minIndex, j; i < maxIndex + 1; i++) {
        if (key.colors[j = `${i}_${maxTick}`]) {
          color = key.colors[j];
        }
      }
    } else {
      h = key.height / 20;
      color = key.defaultColor;
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(key.left, this.ky, key.width, key.height);

    if (key.isBlack) {
      if (!colorKeys.length) {
        // not pressed black keys
      }
    } else {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      this.ctx.fillRect(key.left, this.height - h, key.width, h);
    }

    this.ctx.lineWidth = this.wkw * 0.0421875;
    this.ctx.strokeStyle = '#252525';
    this.ctx.strokeRect(key.left, this.ky, key.width, key.height);
  }

  addColor(keyCode, index, tick, color) {
    this.allKeys[keyCode].colors[`${index}_${tick}`] = color;
  }

  removeColor(keyCode, index, tick) {
    Reflect.deleteProperty(this.allKeys[keyCode].colors, `${index}_${tick}`);
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  reset() {
    this.clear();
    this.initialize();
  }

  render(currentTick, allNotes, index) {
    this.clear();
    this.drawBackground();
    for (let i = 0; i < 2; i++) {
      this.drawNotes(currentTick, allNotes[i], index[i]);
    }
    this.drawKeyboard();
  }
}

export default Renderer;