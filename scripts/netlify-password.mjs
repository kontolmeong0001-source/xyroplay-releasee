export default function password(prompt) {
  if (!process.stdin.isTTY) throw Error('Terminal interaktif diperlukan.');
  return new Promise((resolve,reject) => {
    process.stdout.write(prompt);
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
    let value = '';
    function finish() {process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data',read); process.stdout.write('\n');}
    function read(text) {
      for (const ch of text) {
        if (ch === '\u0003') {finish(); reject(Error('Dibatalkan')); return;}
        if (ch === '\r' || ch === '\n') {finish(); resolve(value); return;}
        if (ch === '\u007f' || ch === '\b') value = value.slice(0,-1);
        else if (ch >= ' ' && value.length < 128) value += ch;
      }
    }
    process.stdin.on('data',read);
  });
}
