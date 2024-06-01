function unique(arr) {
  return Array.from(new Set(arr));
}

function uncapitalize(source) {
  return source.charAt(0).toLowerCase() + source.slice(1);
}

function camelize(source) {
  return source.replace(/[_-][a-z]/g, str => str.slice(1).toUpperCase());
}

function hyphenate(source) {
  return uncapitalize(source)
    .replace(/_/g, '-')
    .replace(/.[A-Z]+/g, str => str[0] + '-' + str.slice(1).toLowerCase());
}

function optionError({ name, desc, syntax }, error) {
  console.log(
    `Invalid option '${name}'` +
    (error ? `: ${error}` : '') +
    '\n\nUsage:\n  ' + syntax + (desc ? '  ' + desc : '')
  );
  process.exit(0);
}

function printHelp({ _name, _examples, options }) {
  const _options = unique(Object.values(options));
  const longest = Math.max(..._options.map(option => option.syntax.length));
  const formatted = _options.map(option => {
    const padded = option.syntax.padEnd(longest + 2, ' ');
    return '  ' + padded + option.desc;
  }).join('\n');
  console.log(
    `Usage:\n  ${_name} [options] [arguments]` +
    (_options.length ? '\n\nOptions:\n' + formatted : '') +
    (_examples.length ? '\n\nExamples:\n' + _examples.map(e => '  ' + e).join('\n') : '')
  );
  process.exit(0);
}

function printVersion({ _version }) {
  console.log(_version);
  process.exit(0);
}

export class CLI {
  _name;
  _version;
  _examples = [];
  options = {};

  constructor(name) {
    this._name = name;
    this.option('help', '-h print help (this message)');
  }

  version(version) {
    this._version = version;
    this.option('version', '-v print version');
  }

  example(example) {
    this._examples.push(example);
  }

  option(name, def = '', { transform, fallback } = {}) {
    name = hyphenate(name);

    const option = {
      name,
      transform,
      fallback,
    };

    let short, param, desc = [];
    for (const seg of def.split(/\s/)) {
      if (!short && /^-[a-z]$/i.test(seg)) short = seg.slice(1);
      else if (!param && /^\[[^\]]+\]|<[^>]+>$/.test(seg)) {
        if (seg.startsWith('<')) option.required = true;
        param = seg.slice(1, -1);
      } else desc.push(seg);
    }

    option.desc = desc.join(' ');
    option.syntax = short ? '-' + short : '';
    option.syntax += short ? ', --' + name : '--' + name;
    option.syntax += param ? option.required ? ` <${param}>` : ` [${param}]` : '';
    option.isBoolean = !param;

    this.options[name] = option;
    if (short) this.options[short] = this.options[name];

    return this;
  }

  async parse(argv = process.argv) {
    argv = argv.slice(2);

    const args = [];
    const options = {};

    while (argv.length > 0) {
      const arg = argv.shift();

      if (!arg.startsWith('-')) {
        args.push(arg);
        continue;
      }

      let name = arg.replace(/^-+/, '');

      if (/^-[a-z]+$/i.test(arg)) {
        name = name.split('');
      } else name = [name];

      for (let i = 0; i < name.length; i++) {
        const option = this.options[name[i]];
        if (!option) continue;
        const key = camelize(option.name);

        if (option.isBoolean) {
          options[key] = true;
          continue;
        }

        const isLast = i === name.length - 1;
        const optArg = isLast ? argv.shift() : null;

        if (!optArg) {
          if (option.required) {
            optionError(option, 'requires an argument');
          } else {
            options[key] = null;
            continue;
          }
        }

        try {
          const transform = option.transform || (arg => arg);
          options[key] = await transform(optArg);
        } catch (error) {
          optionError(option, error);
        }
      }
    }

    if (options.help) printHelp(this);
    if (options.version) printVersion(this);

    return { args, options };
  }
}

export default name => new CLI(name);