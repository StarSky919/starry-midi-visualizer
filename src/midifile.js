import ProgressBar from 'progress';
import {
  decToHex,
  hexToDec,
  decToBin,
  binToHex,
  bytesToHex,
  bytesToDec,
  bytesToString,
  readVLQ,
} from './utils.js';
import { EventTypes, Track } from './components.js';

function error(msg) {
  return new Error(`Invalid MIDI file${msg ? `: ${msg}` : ''}`);
}

export function parseMidi(arrayBuffer) {
  const data = {
    size: arrayBuffer.length,
    tracks: [],
    noteCount: 0,
  };
  let pointer = 0;

  const size = Math.floor(data.size / 1024 / 1024 * 100) / 100;
  console.log(`File size: ${size}M (${data.size})`);

  if (bytesToString(arrayBuffer.subarray(pointer, pointer + 4)) != 'MThd') {
    throw error();
  }
  pointer += 4;

  if (bytesToDec(arrayBuffer.subarray(pointer, pointer + 4)) != 6) {
    throw error();
  }
  pointer += 4;

  const type = bytesToDec(arrayBuffer.subarray(pointer, pointer + 2));
  if (type !== 1) throw error();
  data.type = type;
  pointer += 2;

  data.trackCount = bytesToDec(arrayBuffer.subarray(pointer, pointer + 2));
  pointer += 2;

  data.tpqn = bytesToDec(arrayBuffer.subarray(pointer, pointer + 2));
  pointer += 2;

  const bar = new ProgressBar('Loading tracks: :current / :total (Total notes so far: :notes)', { total: data.trackCount, stream: process.stdout });
  while (pointer < arrayBuffer.length) {
    if (bytesToString(arrayBuffer.subarray(pointer, pointer + 4)) != 'MTrk') {
      throw error();
    }
    pointer += 4;

    const trackLength = bytesToDec(arrayBuffer.subarray(pointer, pointer + 4));
    pointer += 4;

    const track = new Track(data.tracks.length, arrayBuffer.subarray(pointer, pointer + trackLength));
    data.tracks.push(track);
    data.noteCount += track.notes.length;
    bar.tick({
      notes: data.noteCount,
    });
    pointer += trackLength;
  }

  return data;
}

export function parseEvents(arrayBuffer) {
  if (bytesToDec(arrayBuffer.subarray(arrayBuffer.length - 3, arrayBuffer.length)) != 0xFF2F00) {
    throw error();
  }

  const events = [];
  let lastEventType = 0;
  let ticks = 0;
  let pointer = 0;

  while (pointer < arrayBuffer.length) {
    const event = {};

    const delta = readVLQ(arrayBuffer.subarray(pointer));
    event.delta = delta.value;
    ticks += delta.value;
    event.tick = ticks;
    pointer += delta.length;

    switch (arrayBuffer[pointer++]) {
      case 0xF0:
      case 0xF7:
        const dataLength = readVLQ(arrayBuffer.subarray(pointer));
        pointer += dataLength.length + dataLength.value;
        break;
      case 0xFF:
        switch (arrayBuffer[pointer++]) {
          case 0x00:
          case 0x59:
            pointer += 3;
            break;
          case 0x01:
          case 0x02:
          case 0x03:
          case 0x04:
          case 0x05:
          case 0x06:
          case 0x07:
          case 0x09:
          case 0x7F:
            const dataLength = readVLQ(arrayBuffer.subarray(pointer));
            pointer += dataLength.length + dataLength.value;
            break;
          case 0x20:
          case 0x21:
            pointer += 2;
            break;
          case 0x2F:
            event.type = EventTypes.END_OF_TRACK;
            pointer++;
            break;
          case 0x51:
            pointer++;
            event.type = EventTypes.SET_TEMPO;
            event.value = bytesToDec(arrayBuffer.subarray(pointer, pointer + 3));
            event.bpm = 60000000 / event.value;
            pointer += 3;
            break;
          case 0x54:
            pointer += 6;
            break;
          case 0x58:
            pointer += 5;
            break;
          default:
            throw error();
        }
        break;
      default:
        const eventType = arrayBuffer[pointer - 1];
        if (eventType < 0x80) {
          if (lastEventType <= 0x8F) {
            event.type = EventTypes.NOTE_OFF;
            event.channel = lastEventType - 0x80;
            event.note = eventType;
            event.velocity = arrayBuffer[pointer++];
          } else if (lastEventType <= 0x9F) {
            event.type = EventTypes.NOTE_ON;
            event.channel = lastEventType - 0x90;
            event.note = eventType;
            event.velocity = arrayBuffer[pointer++];
          } else if (lastEventType <= 0xAF) {
            pointer++;
          } else if (lastEventType <= 0xBF) {
            pointer++;
          } else if (lastEventType <= 0xCF) {
            void 0;
          } else if (lastEventType <= 0xDF) {
            void 0;
          } else if (lastEventType <= 0xEF) {
            pointer++;
          } else throw error();
        } else {
          lastEventType = eventType;
          if (eventType <= 0x8F) {
            event.type = EventTypes.NOTE_OFF;
            event.channel = eventType - 0x80;
            event.keyCode = arrayBuffer[pointer++];
            event.velocity = arrayBuffer[pointer++];
          } else if (eventType <= 0x9F) {
            event.type = EventTypes.NOTE_ON;
            event.channel = eventType - 0x90;
            event.keyCode = arrayBuffer[pointer++];
            event.velocity = arrayBuffer[pointer++];
          } else if (eventType <= 0xAF) {
            pointer += 2;
          } else if (eventType <= 0xBF) {
            pointer += 2;
          } else if (eventType <= 0xCF) {
            pointer++;
          } else if (eventType <= 0xDF) {
            pointer++;
          } else if (eventType <= 0xEF) {
            pointer += 2;
          } else {
            throw error();
          }
        }
    }

    if (Object.getOwnPropertyNames(event).length > 2) {
      events.push(event);
    }
  }

  return events;
}

export function parseTempoEvents(events) {
  const tempoEvents = [];
  events.forEach(event => {
    if (event.type == EventTypes.SET_TEMPO) {
      tempoEvents.push(event);
    }
  });
  return tempoEvents;
}

export function parseNotes(trackIndex, events) {
  const temp = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    events[i] = null;
    if (!Number.isFinite(event.keyCode)) continue;
    temp[event.keyCode] ??= [];
    temp[event.keyCode].push(event);
  }
  const notes = [];
  for (const _events of temp.filter(Boolean)) {
    const noteOnEvents = _events.filter(event => event.type == EventTypes.NOTE_ON);
    const noteOffEvents = _events.filter(event => event.type == EventTypes.NOTE_OFF);
    while (noteOnEvents.length) {
      const noteOn = noteOnEvents.shift();
      const offIndex = noteOffEvents.findIndex(
        noteOff =>
        noteOff.keyCode === noteOn.keyCode &&
        noteOff.tick >= noteOn.tick
      );
      if (offIndex !== -1) {
        const noteOff = noteOffEvents.splice(offIndex, 1)[0];
        const note = {};
        note.channel = noteOn.channel;
        note.track = trackIndex;
        note.keyCode = noteOn.keyCode;
        note.velocity = noteOn.velocity;
        note.start = noteOn.tick;
        note.duration = noteOff.tick - noteOn.tick;
        note.triggered = note.played = false;
        notes.push(note);
      }
    }
  }
  return notes;
}