import { parseEvents, parseNotes, parseTempoEvents } from './midifile.js';

export const Colors = ['#FF0000', '#FF4D00', '#FF9900', '#FFD700', '#FFFF00', '#D7FF00', '#99FF00', '#4DFF00', '#00FF00', '#00FF4D', '#00FF99', '#00FFD7', '#00FFFF', '#4D00FF', '#9900FF', '#D700FF'];

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