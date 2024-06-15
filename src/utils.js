export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export function decToHex(dec) {
  return ('0' + dec.toString(16)).slice(-2);
}

export function hexToDec(hex) {
  return parseInt(hex, 16);
}

export function decToBin(decnum) {
  const arr = [];
  const arr2 = [];
  while (decnum > 0) {
    arr.push(decnum % 2);
    decnum = Math.floor(decnum / 2);
  }
  while (arr.length > 0) {
    arr2.push(arr.pop());
  }
  return arr2.join('');
}

export function binToHex(bin) {
  return decToHex(parseInt(bin, 2));
}

export function bytesToHex(byteArray) {
  const hex = [];
  byteArray.forEach(byte => {
    hex.push(decToHex(byte));
  });
  return hex.join('');
}

export function bytesToDec(byteArray) {
  return hexToDec(bytesToHex(byteArray));
}

export function bytesToString(byteArray) {
  if (!byteArray.forEach) {
    return String.fromCharCode(byteArray);
  }
  let str = [];
  byteArray.forEach(byte => {
    str.push(String.fromCharCode(byte));
  });
  return str.join('');
}

export function readVLQ(byteArray) {
  let [result, pointer] = [0, 0], buffer;
  do {
    buffer = byteArray[pointer++];
    result = (result << 7) + (buffer & 0x7F);
  } while (buffer & 0x80);
  return {
    length: pointer,
    value: result,
  };
}

export function search(array, value, prop) {
  let beginning = 0;
  const len = array.length;
  let end = len;
  if (len > 0 && array[len - 1][prop] <= value) {
    return len - 1;
  }
  while (beginning < end) {
    let midPoint = Math.floor(beginning + (end - beginning) / 2);
    const event = array[midPoint];
    const nextEvent = array[midPoint + 1];
    if (event[prop] === value) {
      for (let i = midPoint; i < array.length; i++) {
        const testEvent = array[i];
        if (testEvent[prop] === value) {
          midPoint = i;
        }
      }
      return midPoint;
    } else if (event[prop] < value && nextEvent[prop] > value) {
      return midPoint;
    } else if (event[prop] > value) {
      end = midPoint;
    } else if (event[prop] < value) {
      beginning = midPoint + 1;
    }
  }
  return -1;
}

const p0 = (num, length = 2) => num.toString().padStart(length, '0');

export function formatTime(ms) {
  let seconds = Math.abs(ms) / 1000;
  const s = Math.floor(seconds % 60);
  seconds = seconds / 60;
  const m = Math.floor(seconds);
  return p0(m) + ':' + p0(s);
}

export function formatOutput(...lines) {
  lines = lines.join('\n').split('\n');
  lines = lines.map(line => line.split('\t'));
  const lengths = [];
  for (let i = 0; i < Math.max(...lines.map(line => line.length)); i++) {
    lengths[i] = Math.max(...lines.map(line => line[i]?.length ?? 0));
  }
  return lines.map(line => {
    for (let i = 0; i < line.length - 1; i++) {
      line[i] = line[i].padEnd(lengths[i] + 2, ' ');
    }
    return line.join('');
  }).join('\n');
}