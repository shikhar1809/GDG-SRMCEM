const fs = require('fs');
const path = require('path');

const gamesToUpdate = ['PromptWars.jsx', 'TechQuiz.jsx', 'GuessImpostor.jsx', 'TechRecall.jsx', 'AIEye.jsx'];
const dir = path.join(__dirname, 'src', 'pages');

gamesToUpdate.forEach(game => {
  const file = path.join(dir, game);
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('const [lobbyCode,')) {
      content = content.replace(
        /const \[requestStatus, setRequestStatus\] = useState\('none'\);/,
        "const [requestStatus, setRequestStatus] = useState('none');\n  const [lobbyCode, setLobbyCode] = useState(null);"
      );
    }

    if (!content.includes('setLobbyCode(snap.data().lobbyCode)')) {
      content = content.replace(
        /setRequestStatus\(snap\.data\(\)\.status\);/,
        "setRequestStatus(snap.data().status);\n        setLobbyCode(snap.data().lobbyCode);"
      );
      content = content.replace(
        /setRequestStatus\('none'\);/,
        "setRequestStatus('none');\n        setLobbyCode(null);"
      );
    }

    if (!content.includes('lobbyCode:')) {
      content = content.replace(
        /timestamp: serverTimestamp\(\)/g,
        "lobbyCode: Math.floor(100 + Math.random() * 900).toString(),\n                          timestamp: serverTimestamp()"
      );
    }

    if (!content.includes('Lobby Code:')) {
      content = content.replace(
        /<span className="font-bold">Waiting for Admin Approval\.\.\.<\/span>\s*<\/div>/g,
        `<span className="font-bold">Waiting for Admin Approval...</span>\n                      </div>\n                      <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">\n                        Lobby Code: <span className="text-purple-600">{lobbyCode || '...'}</span>\n                      </div>`
      );
    }

    fs.writeFileSync(file, content);
    console.log(`Updated ${game}`);
  }
});
