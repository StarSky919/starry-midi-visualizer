#!/usr/bin/env node

import('../index.js').then(m => m.default)
  .then(async StarryMidiVisualizer => {
    const filename = process.argv[2];
    if (!filename) throw new Error('请指定一个Midi文件');
    const smv = new StarryMidiVisualizer({
      fps: 60,
      noteSpeed: 1.5,
      border: true,
      background: '#C0C0C0',
    });
    await smv.loadFile(filename);
    smv.render(filename.replace(/\.mid$/i, '.mp4'));
  });