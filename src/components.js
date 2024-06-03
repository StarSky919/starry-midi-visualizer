import { parseEvents, parseNotes, parseTempoEvents } from './midifile.js';

export const Colors = [
  'hsl(0deg 100% 50%)', 'hsl(22.5deg 100% 50%)', 'hsl(45deg 100% 50%)', 'hsl(67.5deg 100% 50%)', 'hsl(90deg 100% 50%)', 'hsl(112.5deg 100% 50%)', 'hsl(135deg 100% 50%)', 'hsl(157.5deg 100% 50%)', 'hsl(180deg 100% 50%)', 'hsl(202.5deg 100% 50%)', 'hsl(225deg 100% 50%)', 'hsl(247.5deg 100% 50%)', 'hsl(270deg 100% 50%)', 'hsl(292.5deg 100% 50%)', 'hsl(315deg 100% 50%)', 'hsl(337.5deg 100% 50%)',
  'hsl(0deg 100% 75%)', 'hsl(22.5deg 100% 75%)', 'hsl(45deg 100% 75%)', 'hsl(67.5deg 100% 75%)', 'hsl(90deg 100% 75%)', 'hsl(112.5deg 100% 75%)', 'hsl(135deg 100% 75%)', 'hsl(157.5deg 100% 75%)', 'hsl(180deg 100% 75%)', 'hsl(202.5deg 100% 75%)', 'hsl(225deg 100% 75%)', 'hsl(247.5deg 100% 75%)', 'hsl(270deg 100% 75%)', 'hsl(292.5deg 100% 75%)', 'hsl(315deg 100% 75%)', 'hsl(337.5deg 100% 75%)',
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