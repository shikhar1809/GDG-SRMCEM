// Tech Recall word bank.
//
// New gameplay: player sees a hint + partial letters (first letter revealed,
// then one more every 30s up to 3 reveals). More hints used = fewer points.
//
// Difficulty is based on how familiar the word is to a BTech 1st-year student.
//   easy   → everyday tech terms ANY person would know (kept simple, common words)
//   medium → terms a BTech 1st-year student would likely know
//   hard   → deeper CS concepts usually taught in later semesters
//
// Test constraints:
//   - All words must be >= 5 letters (too short = not a memory test)
//   - Easy avg length < medium avg length < hard avg length
//   - At least 3x the draw profile in each tier (profile: easy:6, medium:2, hard:0)

export const TECH_RECALL_WORDS = [
  // --- easy: everyday tech words anyone knows (min 5 chars) ----------------
  { word: 'Email',      hint: 'Electronic messages sent over the internet', difficulty: 'easy' },
  { word: 'Photo',      hint: 'An image captured by a camera or smartphone', difficulty: 'easy' },
  { word: 'Click',      hint: 'Pressing a mouse button or tapping a touchscreen element', difficulty: 'easy' },
  { word: 'Login',      hint: 'The process of entering your username and password to access an account', difficulty: 'easy' },
  { word: 'Mouse',      hint: 'A handheld device you move on a desk to control the cursor on screen', difficulty: 'easy' },
  { word: 'Emoji',      hint: 'Small colourful icons used in messages to express emotions', difficulty: 'easy' },
  { word: 'Virus',      hint: 'A malicious program that spreads and can damage your computer', difficulty: 'easy' },
  { word: 'Screen',     hint: 'The flat display surface of a phone, laptop, or monitor', difficulty: 'easy' },
  { word: 'Selfie',     hint: 'A photo you take of yourself, usually with the front camera', difficulty: 'easy' },
  { word: 'Search',     hint: 'What you type into Google when you want to find information online', difficulty: 'easy' },
  { word: 'Laptop',     hint: 'A portable personal computer you can use on your lap', difficulty: 'easy' },
  { word: 'Upload',     hint: 'Sending a file from your device to the internet or a server', difficulty: 'easy' },
  { word: 'Folder',     hint: 'A container on your computer used to organise and group files', difficulty: 'easy' },
  { word: 'Backup',     hint: 'A copy of data stored safely so it can be restored if lost', difficulty: 'easy' },
  { word: 'Cookie',     hint: 'A small file stored by a website in your browser to remember you', difficulty: 'easy' },
  { word: 'Cursor',     hint: 'The blinking symbol on your screen that shows where you are typing', difficulty: 'easy' },
  { word: 'Update',     hint: 'A new version of software that fixes bugs and adds features', difficulty: 'easy' },
  { word: 'Camera',     hint: 'A device or sensor used to capture photos and videos', difficulty: 'easy' },
  { word: 'Charger',    hint: 'A device that refills the battery of your phone or laptop', difficulty: 'easy' },
  { word: 'Browser',    hint: 'Software you use to visit websites, like Chrome or Firefox', difficulty: 'easy' },
  { word: 'Download',   hint: 'Transferring a file from the internet to your device', difficulty: 'easy' },
  { word: 'Keyboard',   hint: 'An input device with keys used to type text and commands into a computer', difficulty: 'easy' },
  { word: 'Internet',   hint: 'The global network connecting billions of computers and devices worldwide', difficulty: 'easy' },
  { word: 'Password',   hint: 'A secret word or phrase used to verify your identity when logging in', difficulty: 'easy' },
  { word: 'Bluetooth',  hint: 'Short-range wireless technology used to connect devices like earphones', difficulty: 'easy' },
  { word: 'Notification', hint: 'A pop-up alert your phone or app shows to get your attention', difficulty: 'easy' },

  // --- medium: BTech 1st-year students would likely know these -------------
  { word: 'Array',      hint: 'A data structure that stores elements in order using an index', difficulty: 'medium' },
  { word: 'Binary',     hint: 'The base-2 number system used by computers, using only 0s and 1s', difficulty: 'medium' },
  { word: 'Python',     hint: 'A popular beginner-friendly programming language named after a snake', difficulty: 'medium' },
  { word: 'GitHub',     hint: 'A cloud platform for hosting and collaborating on Git repositories', difficulty: 'medium' },
  { word: 'Server',     hint: 'A powerful computer that provides data or services to other computers', difficulty: 'medium' },
  { word: 'Syntax',     hint: 'The set of rules that defines how code must be written in a language', difficulty: 'medium' },
  { word: 'Router',     hint: 'A device that sends internet data packets between networks', difficulty: 'medium' },
  { word: 'Debug',      hint: 'The process of finding and fixing errors in your code', difficulty: 'medium' },
  { word: 'Domain',     hint: 'The human-readable address of a website, like google.com', difficulty: 'medium' },
  { word: 'Buffer',     hint: 'A temporary memory area used to hold data while it is being transferred', difficulty: 'medium' },
  { word: 'Cache',      hint: 'A small fast memory that stores frequently used data for quick access', difficulty: 'medium' },
  { word: 'Firewall',   hint: 'A security system that monitors and controls incoming and outgoing network traffic', difficulty: 'medium' },
  { word: 'Protocol',   hint: 'A set of rules that defines how data is transmitted between devices', difficulty: 'medium' },
  { word: 'Recursion',  hint: 'When a function calls itself repeatedly until a base condition is met', difficulty: 'medium' },
  { word: 'Metadata',   hint: 'Data that describes other data — like a file\'s size, type, or creation date', difficulty: 'medium' },
  { word: 'Bandwidth',  hint: 'The maximum rate at which data can be transferred over a network connection', difficulty: 'medium' },
  { word: 'Framework',  hint: 'A pre-built structure of libraries and tools that speeds up software development', difficulty: 'medium' },
  { word: 'Localhost',  hint: 'A hostname that refers to your own computer, usually at IP 127.0.0.1', difficulty: 'medium' },
  { word: 'Compiler',   hint: 'A program that translates your entire source code into machine code before running', difficulty: 'medium' },
  { word: 'Database',   hint: 'An organised collection of structured data, usually accessed with SQL', difficulty: 'medium' },

  // --- hard: deeper CS concepts usually taught in later semesters ----------
  { word: 'Polymorphism',   hint: 'An OOP concept where one interface can represent different underlying data types', difficulty: 'hard' },
  { word: 'Cryptography',   hint: 'The science of securing information using codes, ciphers, and keys', difficulty: 'hard' },
  { word: 'Asynchronous',   hint: 'Code that does not wait for a task to finish before moving to the next one', difficulty: 'hard' },
  { word: 'Encapsulation',  hint: 'Bundling data and the methods that operate on it inside a single class', difficulty: 'hard' },
  { word: 'Microservices',  hint: 'An architecture where an app is built as small independent services that communicate over APIs', difficulty: 'hard' },
  { word: 'Multithreading', hint: 'Running multiple threads of execution simultaneously within a single process', difficulty: 'hard' },
  { word: 'Authentication', hint: 'Verifying that a user is who they claim to be, usually via a password or token', difficulty: 'hard' },
  { word: 'Abstraction',    hint: 'Hiding complex implementation details and showing only the essential features to the user', difficulty: 'hard' },
  { word: 'Inheritance',    hint: 'An OOP feature where a child class acquires properties and methods from a parent', difficulty: 'hard' },
  { word: 'Concurrency',    hint: 'The ability of a system to run multiple tasks in overlapping time periods', difficulty: 'hard' },
];
