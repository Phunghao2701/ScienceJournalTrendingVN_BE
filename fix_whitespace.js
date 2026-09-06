const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.test.js')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let count = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Replace non-breaking spaces and other irregular whitespaces with regular spaces
  const regex = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g;
  if (regex.test(content)) {
    content = content.replace(regex, ' ');
    fs.writeFileSync(file, content, 'utf8');
    count++;
  }
});
console.log('Fixed ' + count + ' files with irregular whitespace.');
