const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'AdminGames.jsx');
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /\{req\.userName \|\| 'Anonymous'\} <br \/>/g,
  "{req.userName || 'Anonymous'} {req.lobbyCode && <span className=\"bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded-full ml-2 font-mono\">Code: {req.lobbyCode}</span>} <br />"
);

fs.writeFileSync(file, content);
console.log('Updated AdminGames.jsx');
