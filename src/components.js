import { parseEvents, parseNotes, parseTempoEvents } from './midifile.js';

export class Track {
  index;
  events;
  duration;
  tempoEvents;
  notes;

  constructor(index, arrayBuffer) {
    const events = parseEvents(arrayBuffer);
    this.index = index;
    this.events = events;
    this.duration = events[events.length - 1].tick;
    this.tempoEvents = parseTempoEvents(events);
    this.notes = parseNotes(index, events);
  }
}

export class Note {
  channel;
  track;
  keyCode;
  velocity;
  start;
  end;
  duration;
  triggered = false;
  played = false;

  reset() {
    this.triggered = false;
    this.played = false;
  }
}

export class Key {
  width;
  height;
  isBlack;
  defaultColor;
  left = 0;
  colors = {};

  constructor(width, height, isBlack) {
    this.width = width;
    this.height = height;
    this.isBlack = isBlack;
    this.defaultColor = isBlack ? '#000000' : '#FFFFFF';
  }
}