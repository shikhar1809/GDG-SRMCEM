const fs = require('fs');
const path = require('path');

const generateTechQuiz = () => {
  const q = [
    { question: 'What does PC stand for?', options: ['Personal Computer', 'Private Computer', 'Primary Computer', 'Public Computer'], correctIndex: 0 },
    { question: 'Which company created the iPhone?', options: ['Google', 'Microsoft', 'Apple', 'Samsung'], correctIndex: 2 },
    { question: 'What does WWW stand for?', options: ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide'], correctIndex: 0 },
    { question: 'Which of these is a web browser?', options: ['Windows', 'Google Chrome', 'Python', 'Microsoft Word'], correctIndex: 1 },
    { question: 'What is the main brain of the computer called?', options: ['Monitor', 'Keyboard', 'CPU', 'Mouse'], correctIndex: 2 },
    { question: 'What symbol is used in an email address?', options: ['#', '$', '&', '@'], correctIndex: 3 },
    { question: 'Which company owns YouTube?', options: ['Facebook', 'Microsoft', 'Google', 'Apple'], correctIndex: 2 },
    { question: 'What does Wi-Fi stand for?', options: ['Wireless Fidelity', 'Wired Fiber', 'Wireless Fiber', 'Wide Field'], correctIndex: 0 },
    { question: 'What do you use to type on a computer?', options: ['Monitor', 'Mouse', 'Printer', 'Keyboard'], correctIndex: 3 },
    { question: 'Which of these is a social media platform?', options: ['Excel', 'Instagram', 'Photoshop', 'Notepad'], correctIndex: 1 },
    { question: 'What does USB stand for?', options: ['Universal Serial Bus', 'United States Broad', 'Ultra Secure Board', 'Unified System Block'], correctIndex: 0 },
    { question: 'What do you click with on a computer?', options: ['Keyboard', 'Monitor', 'Mouse', 'Speaker'], correctIndex: 2 },
    { question: 'Which company created Windows?', options: ['Apple', 'Microsoft', 'Google', 'IBM'], correctIndex: 1 },
    { question: 'What is the name of Google\'s mobile operating system?', options: ['iOS', 'Windows Mobile', 'Android', 'Symbian'], correctIndex: 2 },
    { question: 'What does AI stand for?', options: ['Artificial Intelligence', 'Auto Internet', 'Advanced Interface', 'Active Icon'], correctIndex: 0 },
    { question: 'Which bird is the logo for Twitter (X)?', options: ['Eagle', 'Owl', 'Larry the Bird', 'Parrot'], correctIndex: 2 },
    { question: 'What is the most popular search engine?', options: ['Bing', 'Yahoo', 'Google', 'DuckDuckGo'], correctIndex: 2 },
    { question: 'What do you need to access the internet?', options: ['A router/modem', 'A printer', 'A speaker', 'A microphone'], correctIndex: 0 },
    { question: 'What is the short form of Application?', options: ['Ape', 'App', 'Ali', 'Art'], correctIndex: 1 },
    { question: 'Which of these is used for video calls?', options: ['Spotify', 'Zoom', 'Notepad', 'Paint'], correctIndex: 1 },
    { question: 'What is the visual display of a computer called?', options: ['Mouse', 'Keyboard', 'Monitor', 'CPU'], correctIndex: 2 },
    { question: 'What does a printer do?', options: ['Makes sound', 'Prints documents', 'Takes photos', 'Records video'], correctIndex: 1 },
    { question: 'Which app is famous for short videos?', options: ['LinkedIn', 'TikTok', 'Word', 'Excel'], correctIndex: 1 },
    { question: 'What is a smartphone?', options: ['A smart TV', 'A mobile phone with internet', 'A smartwatch', 'A digital camera'], correctIndex: 1 },
    { question: 'Which of these is a search engine?', options: ['Facebook', 'Bing', 'Instagram', 'WhatsApp'], correctIndex: 1 },
    { question: 'What is used to store data permanently?', options: ['RAM', 'Hard Drive', 'Processor', 'Monitor'], correctIndex: 1 },
    { question: 'What does a camera do?', options: ['Plays music', 'Takes pictures', 'Prints paper', 'Types text'], correctIndex: 1 },
    { question: 'Which app is used for texting and calling over internet?', options: ['WhatsApp', 'Excel', 'Photoshop', 'Calculator'], correctIndex: 0 },
    { question: 'What is a popular streaming service for movies?', options: ['Spotify', 'Netflix', 'SoundCloud', 'Twitch'], correctIndex: 1 },
    { question: 'What does a speaker do?', options: ['Shows pictures', 'Produces sound', 'Takes video', 'Types words'], correctIndex: 1 },
    { question: 'What is the name of Apple\'s laptop?', options: ['ThinkPad', 'MacBook', 'Chromebook', 'ZenBook'], correctIndex: 1 },
    { question: 'What does VR stand for?', options: ['Virtual Reality', 'Visual Recording', 'Video Resolution', 'Vocal Recognition'], correctIndex: 0 },
    { question: 'Which platform is used for professional networking?', options: ['Snapchat', 'TikTok', 'LinkedIn', 'Pinterest'], correctIndex: 2 },
    { question: 'What is the logo of Instagram?', options: ['A bird', 'A camera', 'A ghost', 'A phone'], correctIndex: 1 },
    { question: 'What is the primary color of the Facebook logo?', options: ['Red', 'Green', 'Blue', 'Yellow'], correctIndex: 2 },
    { question: 'What is a smartwatch?', options: ['A smart phone', 'A wearable computer on wrist', 'A smart TV', 'A smart speaker'], correctIndex: 1 },
    { question: 'Which company makes the PlayStation?', options: ['Microsoft', 'Nintendo', 'Sony', 'Sega'], correctIndex: 2 },
    { question: 'Which company makes the Xbox?', options: ['Sony', 'Microsoft', 'Nintendo', 'Valve'], correctIndex: 1 },
    { question: 'What does GPS stand for?', options: ['Global Positioning System', 'General Print Server', 'Graphic Photo System', 'Global Phone Signal'], correctIndex: 0 },
    { question: 'What is a popular platform for listening to music?', options: ['Netflix', 'Spotify', 'Hulu', 'Steam'], correctIndex: 1 },
    { question: 'Which browser is made by Apple?', options: ['Chrome', 'Edge', 'Safari', 'Firefox'], correctIndex: 2 },
    { question: 'What is the name of Microsoft\'s virtual assistant?', options: ['Siri', 'Alexa', 'Cortana', 'Bixby'], correctIndex: 2 },
    { question: 'What is the name of Apple\'s virtual assistant?', options: ['Cortana', 'Alexa', 'Siri', 'Google Assistant'], correctIndex: 2 },
    { question: 'What is the name of Amazon\'s virtual assistant?', options: ['Siri', 'Cortana', 'Bixby', 'Alexa'], correctIndex: 3 },
    { question: 'What do you use to click on things on a laptop?', options: ['Touchpad', 'Monitor', 'Speaker', 'Webcam'], correctIndex: 0 },
    { question: 'What is a selfie?', options: ['A type of phone', 'A self-portrait photograph', 'A smart watch', 'A video game'], correctIndex: 1 },
    { question: 'What is a drone?', options: ['A submarine', 'An unmanned aerial vehicle', 'A sports car', 'A smart TV'], correctIndex: 1 },
    { question: 'What does a microphone do?', options: ['Captures sound', 'Shows video', 'Prints text', 'Moves cursor'], correctIndex: 0 },
    { question: 'Which company makes the Galaxy series smartphones?', options: ['Apple', 'Samsung', 'Google', 'OnePlus'], correctIndex: 1 },
    { question: 'What is a laptop?', options: ['A portable personal computer', 'A large desktop PC', 'A smartphone', 'A smartwatch'], correctIndex: 0 }
  ];
  return `export const TECH_QUIZ_QUESTIONS = ${JSON.stringify(q, null, 2)};\n`;
};

const generateGuessImpostor = () => {
  const q = [
    { category: 'Social Media Apps', items: ['Facebook', 'Instagram', 'Twitter', 'Microsoft Excel'], impostorIndex: 3, reason: 'Excel is a spreadsheet app, the rest are social media.' },
    { category: 'Web Browsers', items: ['Chrome', 'Safari', 'Firefox', 'Photoshop'], impostorIndex: 3, reason: 'Photoshop is for editing photos, the rest are browsers.' },
    { category: 'Tech Companies', items: ['Google', 'Apple', 'Microsoft', 'McDonalds'], impostorIndex: 3, reason: 'McDonalds is a fast food chain, not a tech company.' },
    { category: 'Smartphone Brands', items: ['Samsung', 'Apple', 'OnePlus', 'Toyota'], impostorIndex: 3, reason: 'Toyota makes cars, not smartphones.' },
    { category: 'Computer Parts', items: ['Monitor', 'Keyboard', 'Mouse', 'Bicycle'], impostorIndex: 3, reason: 'A bicycle is not a computer part.' },
    { category: 'Operating Systems', items: ['Windows', 'macOS', 'Android', 'Google Chrome'], impostorIndex: 3, reason: 'Chrome is a browser, not an operating system.' },
    { category: 'Video Streaming', items: ['Netflix', 'YouTube', 'Hulu', 'Calculator'], impostorIndex: 3, reason: 'Calculator is for math, the rest are for streaming videos.' },
    { category: 'Music Apps', items: ['Spotify', 'Apple Music', 'Amazon Music', 'Google Maps'], impostorIndex: 3, reason: 'Google Maps is for navigation, not music.' },
    { category: 'Gaming Consoles', items: ['PlayStation', 'Xbox', 'Nintendo Switch', 'Microwave'], impostorIndex: 3, reason: 'A microwave is a kitchen appliance.' },
    { category: 'Virtual Assistants', items: ['Siri', 'Alexa', 'Google Assistant', 'Mario'], impostorIndex: 3, reason: 'Mario is a video game character.' },
    { category: 'Programming Languages', items: ['Python', 'Java', 'C++', 'English'], impostorIndex: 3, reason: 'English is a human language, not a programming language.' },
    { category: 'Tech Billionaires', items: ['Elon Musk', 'Bill Gates', 'Mark Zuckerberg', 'Gordon Ramsay'], impostorIndex: 3, reason: 'Gordon Ramsay is a chef.' },
    { category: 'Storage Devices', items: ['Hard Drive', 'USB Flash Drive', 'SD Card', 'Speaker'], impostorIndex: 3, reason: 'A speaker plays sound, it does not store files.' },
    { category: 'Output Devices', items: ['Monitor', 'Printer', 'Speaker', 'Keyboard'], impostorIndex: 3, reason: 'Keyboard is an input device.' },
    { category: 'Input Devices', items: ['Mouse', 'Keyboard', 'Microphone', 'Monitor'], impostorIndex: 3, reason: 'Monitor is an output device.' },
    { category: 'File Types (Images)', items: ['.jpg', '.png', '.gif', '.mp3'], impostorIndex: 3, reason: '.mp3 is an audio file format.' },
    { category: 'File Types (Documents)', items: ['.doc', '.pdf', '.txt', '.mp4'], impostorIndex: 3, reason: '.mp4 is a video file format.' },
    { category: 'Ride Sharing Apps', items: ['Uber', 'Lyft', 'Ola', 'Tinder'], impostorIndex: 3, reason: 'Tinder is a dating app.' },
    { category: 'Food Delivery Apps', items: ['Zomato', 'Swiggy', 'UberEats', 'Spotify'], impostorIndex: 3, reason: 'Spotify is for music.' },
    { category: 'E-commerce Sites', items: ['Amazon', 'Flipkart', 'eBay', 'WhatsApp'], impostorIndex: 3, reason: 'WhatsApp is a messaging app.' },
    { category: 'Messaging Apps', items: ['WhatsApp', 'Telegram', 'Signal', 'Netflix'], impostorIndex: 3, reason: 'Netflix is a streaming app.' },
    { category: 'Search Engines', items: ['Google', 'Bing', 'Yahoo', 'Windows'], impostorIndex: 3, reason: 'Windows is an operating system.' },
    { category: 'Cloud Storage', items: ['Google Drive', 'Dropbox', 'OneDrive', 'Bluetooth'], impostorIndex: 3, reason: 'Bluetooth is a wireless technology.' },
    { category: 'Wearable Tech', items: ['Apple Watch', 'Fitbit', 'Galaxy Watch', 'Laptop'], impostorIndex: 3, reason: 'A laptop is not wearable tech.' },
    { category: 'Smart Home Devices', items: ['Smart Bulb', 'Smart Thermostat', 'Smart Plug', 'Smart Water Bottle'], impostorIndex: 3, reason: 'Smart Water Bottle is usually not considered a core smart home device.' }, // maybe easy enough
    { category: 'Programming Concepts', items: ['Loop', 'Variable', 'Function', 'Steering Wheel'], impostorIndex: 3, reason: 'Steering Wheel is for cars.' },
    { category: 'Network Terms', items: ['Wi-Fi', 'Ethernet', 'Router', 'Monitor'], impostorIndex: 3, reason: 'Monitor is a display device.' },
    { category: 'Computer Brands', items: ['Dell', 'HP', 'Lenovo', 'Nike'], impostorIndex: 3, reason: 'Nike makes shoes.' },
    { category: 'Antivirus Software', items: ['Norton', 'McAfee', 'Kaspersky', 'Adobe Premiere'], impostorIndex: 3, reason: 'Adobe Premiere is for video editing.' },
    { category: 'Video Editing Software', items: ['Premiere Pro', 'Final Cut Pro', 'DaVinci Resolve', 'Microsoft Word'], impostorIndex: 3, reason: 'Word is for text documents.' },
    { category: 'Photo Editing Apps', items: ['Photoshop', 'Lightroom', 'Snapseed', 'Excel'], impostorIndex: 3, reason: 'Excel is a spreadsheet app.' },
    { category: 'Spreadsheet Apps', items: ['Excel', 'Google Sheets', 'Numbers', 'TikTok'], impostorIndex: 3, reason: 'TikTok is a video app.' },
    { category: 'Presentation Apps', items: ['PowerPoint', 'Google Slides', 'Keynote', 'Snapchat'], impostorIndex: 3, reason: 'Snapchat is a messaging app.' },
    { category: 'Coding Editors', items: ['VS Code', 'Sublime Text', 'Notepad++', 'Spotify'], impostorIndex: 3, reason: 'Spotify is for music.' },
    { category: 'Tech Events', items: ['Google I/O', 'Apple WWDC', 'CES', 'Super Bowl'], impostorIndex: 3, reason: 'Super Bowl is a sports event.' },
    { category: 'Video Games', items: ['Minecraft', 'Fortnite', 'Roblox', 'Chrome'], impostorIndex: 3, reason: 'Chrome is a web browser.' },
    { category: 'Game Developers', items: ['EA', 'Ubisoft', 'Nintendo', 'KFC'], impostorIndex: 3, reason: 'KFC sells fried chicken.' },
    { category: 'Tech YouTubers', items: ['MKBHD', 'Linus Tech Tips', 'Mrwhosetheboss', 'Gordon Ramsay'], impostorIndex: 3, reason: 'Gordon Ramsay is a chef.' },
    { category: 'Mobile Processors', items: ['Snapdragon', 'Apple A-Series', 'Exynos', 'Intel Core i9'], impostorIndex: 3, reason: 'Intel Core i9 is a desktop/laptop processor.' },
    { category: 'Wireless Tech', items: ['Bluetooth', 'Wi-Fi', 'NFC', 'USB Cable'], impostorIndex: 3, reason: 'USB Cable is a wired technology.' },
    { category: 'Computer Keys', items: ['Shift', 'Enter', 'Spacebar', 'Screen'], impostorIndex: 3, reason: 'Screen is not a keyboard key.' },
    { category: 'Email Providers', items: ['Gmail', 'Outlook', 'Yahoo Mail', 'Twitter'], impostorIndex: 3, reason: 'Twitter is a social media site.' },
    { category: 'Tech Buzzwords', items: ['Metaverse', 'Web3', 'Blockchain', 'Sandwich'], impostorIndex: 3, reason: 'A sandwich is food.' },
    { category: 'Internet Domains', items: ['.com', '.org', '.net', '.exe'], impostorIndex: 3, reason: '.exe is an executable file extension.' },
    { category: 'Tech Podcasts', items: ['Waveform', 'Lex Fridman', 'Reply All', 'Vogue'], impostorIndex: 3, reason: 'Vogue is a fashion magazine.' },
    { category: 'AI Tools', items: ['ChatGPT', 'Gemini', 'Midjourney', 'Paint'], impostorIndex: 3, reason: 'Paint is a basic drawing app, not AI.' },
    { category: 'Streaming Devices', items: ['Chromecast', 'Apple TV', 'Roku', 'Toaster'], impostorIndex: 3, reason: 'A toaster makes toast.' },
    { category: 'Smart Speakers', items: ['Amazon Echo', 'Google Nest', 'Apple HomePod', 'Mousepad'], impostorIndex: 3, reason: 'A mousepad is a surface for a mouse.' },
    { category: 'Audio Brands', items: ['Sony', 'Bose', 'Sennheiser', 'Intel'], impostorIndex: 3, reason: 'Intel is known for computer chips, not audio.' },
    { category: 'Keyboard Types', items: ['Mechanical', 'Membrane', 'Virtual', 'Liquid'], impostorIndex: 3, reason: 'Liquid is not a type of keyboard.' }
  ];
  return `export const GUESS_IMPOSTOR_QUESTIONS = ${JSON.stringify(q, null, 2)};\n`;
};

const generateTechRecall = () => {
  const words = [
    'Laptop', 'Mouse', 'Keyboard', 'Monitor', 'Screen', 'Phone', 'Tablet', 'Camera', 'Drone', 'Robot',
    'Wi-Fi', 'Internet', 'Website', 'Email', 'Google', 'Apple', 'Microsoft', 'Amazon', 'Facebook', 'Twitter',
    'Code', 'Data', 'Cloud', 'Server', 'Network', 'Router', 'Modem', 'Pixel', 'Video', 'Audio',
    'Music', 'Photo', 'App', 'Game', 'Chat', 'Text', 'Call', 'Search', 'Link', 'Web',
    'Browser', 'Chrome', 'Safari', 'Firefox', 'Window', 'Mac', 'Linux', 'Android', 'iOS', 'Smart',
    'Watch', 'Band', 'Speaker', 'Headset', 'Earbuds', 'Battery', 'Charger', 'Cable', 'Port', 'Drive',
    'Disk', 'Flash', 'Memory', 'RAM', 'Chip', 'Processor', 'Card', 'Board', 'System', 'Software',
    'Update', 'Install', 'Delete', 'Save', 'Copy', 'Paste', 'Print', 'Scan', 'Click', 'Type',
    'Swipe', 'Tap', 'Scroll', 'Zoom', 'Play', 'Pause', 'Stop', 'Record', 'Share', 'Send',
    'Upload', 'Download', 'Stream', 'Live', 'Post', 'Like', 'Comment', 'Follow', 'Friend', 'User',
    'Profile', 'Account', 'Password', 'Login', 'Logout', 'Secure', 'Lock', 'Key', 'Safe', 'Alert',
    'Virus', 'Bug', 'Error', 'Crash', 'Fix', 'Repair', 'Help', 'Support', 'Guide', 'Manual',
    'Tool', 'Gear', 'Tech', 'Digital', 'Cyber', 'Virtual', 'Real', 'Fake', 'Bot', 'AI',
    'Smart', 'Fast', 'Slow', 'Quick', 'Easy', 'Hard', 'Simple', 'Complex', 'Basic', 'Pro',
    'Free', 'Paid', 'Buy', 'Sell', 'Shop', 'Store', 'Cart', 'Pay', 'Card', 'Cash',
    'Bank', 'Money', 'Coin', 'Token', 'Crypto', 'Bitcoin', 'Wallet', 'Chain', 'Block', 'Node',
    'Link', 'Host', 'Domain', 'Site', 'Page', 'Blog', 'Vlog', 'News', 'Feed', 'Stream',
    'Cast', 'Show', 'Movie', 'Film', 'Clip', 'Short', 'Reel', 'Story', 'Post', 'Draft',
    'Edit', 'Filter', 'Crop', 'Cut', 'Join', 'Merge', 'Split', 'Mix', 'Blend', 'Color',
    'Light', 'Dark', 'Mode', 'Theme', 'Style', 'Font', 'Text', 'Word', 'Letter', 'Number'
  ];
  
  const mapped = words.map(w => ({ word: w }));
  return `export const TECH_RECALL_WORDS = ${JSON.stringify(mapped, null, 2)};\n`;
};

fs.writeFileSync(path.join(__dirname, 'src/utils/gameData/techQuizData.js'), generateTechQuiz());
fs.writeFileSync(path.join(__dirname, 'src/utils/gameData/guessImpostorData.js'), generateGuessImpostor());
fs.writeFileSync(path.join(__dirname, 'src/utils/gameData/techRecallData.js'), generateTechRecall());

console.log("Rewrote game content with basic easy questions.");
