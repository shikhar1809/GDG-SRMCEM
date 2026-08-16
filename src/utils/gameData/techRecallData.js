// Tech Recall word bank.
//
// New gameplay: player sees a hint + partial letters (first letter revealed,
// then one more every 30s up to 3 reveals). More hints used = fewer points.
//
// Difficulty is based on how familiar the word is to a BTech 1st-year student.
//   easy   → everyday tech terms any 1st-year student would know
//   medium → CS concepts usually taught in 1st/2nd semester
//   hard   → deeper or more specialised concepts

export const TECH_RECALL_WORDS = [
  // --- easy ------------------------------------------------------------------
  { word: 'Python',     hint: 'A popular beginner-friendly programming language named after a snake', difficulty: 'easy' },
  { word: 'Array',      hint: 'A data structure that stores elements in order using an index', difficulty: 'easy' },
  { word: 'Binary',     hint: 'The base-2 number system used by computers, using only 0s and 1s', difficulty: 'easy' },
  { word: 'Browser',    hint: 'Software you use to visit websites, like Chrome or Firefox', difficulty: 'easy' },
  { word: 'Cursor',     hint: 'The blinking symbol on your screen that shows where you are typing', difficulty: 'easy' },
  { word: 'Domain',     hint: 'The human-readable address of a website, like google.com', difficulty: 'easy' },
  { word: 'Debug',      hint: 'The process of finding and fixing errors in your code', difficulty: 'easy' },
  { word: 'Linux',      hint: 'An open-source operating system commonly used on servers', difficulty: 'easy' },
  { word: 'Cache',      hint: 'A small fast memory that stores frequently used data for quick access', difficulty: 'easy' },
  { word: 'Router',     hint: 'A device that sends internet data packets between networks', difficulty: 'easy' },
  { word: 'Syntax',     hint: 'The set of rules that defines how code must be written in a language', difficulty: 'easy' },
  { word: 'Server',     hint: 'A powerful computer that provides data or services to other computers', difficulty: 'easy' },
  { word: 'Backup',     hint: 'A copy of data stored safely so it can be restored if lost', difficulty: 'easy' },
  { word: 'Laptop',     hint: 'A portable personal computer you can use on your lap', difficulty: 'easy' },
  { word: 'Pixel',      hint: 'The smallest unit of a digital image or screen display', difficulty: 'easy' },
  { word: 'Cookie',     hint: 'A small file stored by a website in your browser to remember you', difficulty: 'easy' },
  { word: 'GitHub',     hint: 'A cloud platform for hosting and collaborating on Git repositories', difficulty: 'easy' },
  { word: 'Ubuntu',     hint: 'A popular free Linux distribution used by developers worldwide', difficulty: 'easy' },
  { word: 'Buffer',     hint: 'A temporary memory area used to hold data while it is being transferred', difficulty: 'easy' },
  { word: 'Compiler',   hint: 'A program that translates your entire source code into machine code before running', difficulty: 'easy' },
  { word: 'Database',   hint: 'An organised collection of structured data, usually accessed with SQL', difficulty: 'easy' },
  { word: 'Function',   hint: 'A reusable block of code that performs a specific task when called', difficulty: 'easy' },
  { word: 'Algorithm',  hint: 'A step-by-step set of instructions for solving a problem or completing a task', difficulty: 'easy' },
  { word: 'Variable',   hint: 'A named container in your code that stores a value which can change', difficulty: 'easy' },
  { word: 'Internet',   hint: 'The global network connecting billions of computers and devices worldwide', difficulty: 'easy' },
  { word: 'Password',   hint: 'A secret word or phrase used to verify your identity when logging in', difficulty: 'easy' },
  { word: 'Download',   hint: 'The process of transferring data from a remote server to your device', difficulty: 'easy' },
  { word: 'Software',   hint: 'Programs and operating information used by a computer, as opposed to hardware', difficulty: 'easy' },
  { word: 'Hardware',   hint: 'The physical components of a computer system you can touch and see', difficulty: 'easy' },
  { word: 'Keyboard',   hint: 'An input device with keys used to type text and commands into a computer', difficulty: 'easy' },

  // --- medium ----------------------------------------------------------------
  { word: 'Firewall',   hint: 'A security system that monitors and controls incoming and outgoing network traffic', difficulty: 'medium' },
  { word: 'Protocol',   hint: 'A set of rules that defines how data is transmitted between devices', difficulty: 'medium' },
  { word: 'Recursion',  hint: 'When a function calls itself repeatedly until a base condition is met', difficulty: 'medium' },
  { word: 'Runtime',    hint: 'The period when a program is actually executing on the computer', difficulty: 'medium' },
  { word: 'Metadata',   hint: 'Data that describes other data — like a file\'s size, type, or creation date', difficulty: 'medium' },
  { word: 'Encoding',   hint: 'The process of converting data into a specific format for storage or transmission', difficulty: 'medium' },
  { word: 'Iterator',   hint: 'An object that lets you traverse through a collection one element at a time', difficulty: 'medium' },
  { word: 'Bandwidth',  hint: 'The maximum rate at which data can be transferred over a network connection', difficulty: 'medium' },
  { word: 'Framework',  hint: 'A pre-built structure of libraries and tools that speeds up software development', difficulty: 'medium' },
  { word: 'Interface',  hint: 'A boundary or contract that defines how different software components interact', difficulty: 'medium' },
  { word: 'Localhost',  hint: 'A hostname that refers to your own computer, usually at IP 127.0.0.1', difficulty: 'medium' },
  { word: 'Container',  hint: 'A lightweight isolated environment for running applications with their dependencies', difficulty: 'medium' },
  { word: 'Encrypted',  hint: 'Data that has been scrambled using a key so only authorised parties can read it', difficulty: 'medium' },
  { word: 'Bootstrap',  hint: 'A popular CSS framework for quickly building responsive web pages', difficulty: 'medium' },
  { word: 'JavaScript', hint: 'The scripting language that makes web pages interactive in the browser', difficulty: 'medium' },
  { word: 'Inheritance', hint: 'An OOP feature where a child class acquires properties and methods from a parent', difficulty: 'medium' },
  { word: 'Concurrency', hint: 'The ability of a system to run multiple tasks in overlapping time periods', difficulty: 'medium' },
  { word: 'Compression', hint: 'Reducing the size of data by removing redundancies so it takes less space', difficulty: 'medium' },
  { word: 'Deployment',  hint: 'The process of releasing a finished application to a live production environment', difficulty: 'medium' },
  { word: 'Abstraction', hint: 'Hiding complex implementation details and showing only essential features to the user', difficulty: 'medium' },

  // --- hard ------------------------------------------------------------------
  { word: 'Polymorphism',    hint: 'An OOP concept where one interface can represent different underlying data types', difficulty: 'hard' },
  { word: 'Cryptography',    hint: 'The science of securing information using codes, ciphers, and keys', difficulty: 'hard' },
  { word: 'Asynchronous',    hint: 'Code that does not wait for a task to finish before moving to the next one', difficulty: 'hard' },
  { word: 'Architecture',    hint: 'The high-level design and structure of a software or computer system', difficulty: 'hard' },
  { word: 'Optimization',    hint: 'The process of making code or a system faster, smaller, or more efficient', difficulty: 'hard' },
  { word: 'Authentication',  hint: 'Verifying that a user is who they claim to be, usually via a password or token', difficulty: 'hard' },
  { word: 'Encapsulation',   hint: 'Bundling data and the methods that operate on it inside a single class', difficulty: 'hard' },
  { word: 'Microservices',   hint: 'An architecture where an app is built as small independent services that communicate over APIs', difficulty: 'hard' },
  { word: 'Cybersecurity',   hint: 'The practice of protecting computers, networks, and data from digital attacks', difficulty: 'hard' },
  { word: 'Multithreading',  hint: 'Running multiple threads of execution simultaneously within a single process', difficulty: 'hard' },
];
