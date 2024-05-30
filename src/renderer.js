import { createCanvas } from 'canvas';
import { Key } from './components.js';
import { channelColors } from './index.js';

export class Renderer {
  constructor(smv) {
    const {
      resolution,
      framerate,
      bgcolor,
      keyh,
      line,
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
    this.border = border;
    this.notespeed = notespeed;

    this.allKeys = [];
    this.blackKeys = [];
    this.whiteKeys = [];
    this.wkw = this.width / 75;
    this.bkw = this.wkw * 0.55;
    this.bottom = this.height - this.keyh;
  }

  initialize() {
    this.allKeys = [];
    this.blackKeys = [];
    this.whiteKeys = [];

    const keysMap = [1, 1, 2, 2, 3, 4, 3, 5, 4, 6, 5, 7];
    for (let i = 0; i < 128; i++) {
      const j = i % 12,
        k = Math.floor(i / 12);
      switch (j) {
        case 1:
        case 3:
        case 6:
        case 8:
        case 10:
          const bk = new Key(this.bkw, this.keyh * 0.65, true),
            l = this.bkw / 2,
            m = keysMap[j],
            n = Math.floor((m + k * 5 - 1) / 5) * 7;
          switch (m) {
            case 1:
              bk.left = this.wkw * (1 + n) - l - l * 0.375;
              break;
            case 2:
              bk.left = this.wkw * (2 + n) - l + l * 0.375;
              break;
            case 3:
              bk.left = this.wkw * (4 + n) - l - l * 0.375;
              break;
            case 4:
              bk.left = this.wkw * (5 + n) - l;
              break;
            case 5:
              bk.left = this.wkw * (6 + n) - l + l * 0.375;
              break;
          }
          this.allKeys.push(bk);
          this.blackKeys.push(bk);
          break;
        case 0:
        case 2:
        case 4:
        case 5:
        case 7:
        case 9:
        case 11:
          const wk = new Key(this.wkw, this.keyh, false);
          wk.left = this.wkw * (keysMap[j] + k * 7 - 1);
          this.allKeys.push(wk);
          this.whiteKeys.push(wk);
          break;
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
    this.ctx.scale(1, -1);
    this.ctx.translate(0, -this.height);
    const ct = currentTick * this.pixelsPerTick;
    for (let i = index; i < notes.length; i++) {
      const note = notes[i];
      if (note.start <= currentTick) {
        if (note.start + note.duration < currentTick) {
          note.played = true;
          this.removeColor(note.keyCode, note.channel, note.start);
        } else if (!note.triggered) {
          note.triggered = true;
          this.addColor(note.keyCode, note.channel, note.start, channelColors[note.channel]);
        }
      }
      const kw = this.allKeys[note.keyCode].isBlack ? this.bkw : this.wkw;
      const h = Math.max(1, note.duration * this.pixelsPerTick);
      const x = this.allKeys[note.keyCode].left;
      const y = note.start * this.pixelsPerTick + this.keyh - ct;
      if (y > this.height) break;
      if (y + h < this.keyh) continue;
      this.ctx.fillStyle = channelColors[note.channel];
      this.ctx.fillRect(x, y, kw, h);
      if (this.border) {
        this.ctx.lineWidth = this.wkw * 0.0421875;
        this.ctx.strokeStyle = '#252525';
        this.ctx.strokeRect(x, y, kw, h);
      } else if (y < this.keyh) {
        const percent = 1 - (this.keyh - y) / h;
        this.ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * percent})`;
        this.ctx.fillRect(x, y, kw, h);
      }
    }
    this.ctx.scale(1, -1);
    this.ctx.translate(0, -this.height);
  }

  drawKeyboard() {
    if (this.line) {
      const h = this.keyh / 30;
      this.ctx.fillStyle = this.line;
      this.ctx.fillRect(0, this.bottom - h, this.width, h);
    }

    this.whiteKeys.forEach(key => this.drawKeys(key));
    this.blackKeys.forEach(key => this.drawKeys(key));
  }

  drawKeys(key) {
    const colorKeys = Object.keys(key.colors).map(key => key.split('_'));
    const y = this.bottom;
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
    this.ctx.fillRect(key.left, y, key.width, key.height);

    const y2 = this.height - h;

    if (key.isBlack) {
      if (!colorKeys.length) {
        // not pressed black keys
      }
    } else {
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      this.ctx.fillRect(key.left, y2, key.width, h);
    }

    this.ctx.lineWidth = this.wkw * 0.0421875;
    this.ctx.strokeStyle = '#252525';
    this.ctx.strokeRect(key.left, y, key.width, key.height);
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
    for (let i = 0; i < allNotes.length; i++) {
      this.drawNotes(currentTick, allNotes[i], index[i]);
    }
    this.drawKeyboard();
  }
}

export default Renderer;