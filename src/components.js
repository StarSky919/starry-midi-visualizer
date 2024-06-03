import { parseEvents, parseNotes, parseTempoEvents } from './midifile.js';

export const Colors = [
  'hsl(0, 100%, 50%)', 'hsl(22.5, 100%, 50%)', 'hsl(45, 100%, 50%)', 'hsl(67.5, 100%, 50%)', 'hsl(90, 100%, 50%)', 'hsl(112.5, 100%, 50%)', 'hsl(135, 100%, 50%)', 'hsl(157.5, 100%, 50%)', 'hsl(180, 100%, 50%)', 'hsl(202.5, 100%, 50%)', 'hsl(225, 100%, 50%)', 'hsl(247.5, 100%, 50%)', 'hsl(270, 100%, 50%)', 'hsl(292.5, 100%, 50%)', 'hsl(315, 100%, 50%)', 'hsl(337.5, 100%, 50%)',
  'hsl(0, 100%, 75%)', 'hsl(22.5, 100%, 75%)', 'hsl(45, 100%, 75%)', 'hsl(67.5, 100%, 75%)', 'hsl(90, 100%, 75%)', 'hsl(112.5, 100%, 75%)', 'hsl(135, 100%, 75%)', 'hsl(157.5, 100%, 75%)', 'hsl(180, 100%, 75%)', 'hsl(202.5, 100%, 75%)', 'hsl(225, 100%, 75%)', 'hsl(247.5, 100%, 75%)', 'hsl(270, 100%, 75%)', 'hsl(292.5, 100%, 75%)', 'hsl(315, 100%, 75%)', 'hsl(337.5, 100%, 75%)',
];

export const EventTypes = {
  SET_TEMPO: 'Set Tempo',
  END_OF_TRACK: 'End of Track',
  NOTE_ON: 'Note On',
  NOTE_OFF: 'Note Off',
};

export class Track {
  index;
  events;
  duration;
  tempoEvents;
  notes;

  constructor(index, arrayBuffer) {
    const events = parseEvents(arrayBuffer);
    this.index = index;
    this.duration = events[events.length - 1].tick;
    this.tempoEvents = parseTempoEvents(events);
    this.notes = parseNotes(index, events);
  }

  get noteCount() {
    return this.notes.length;
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