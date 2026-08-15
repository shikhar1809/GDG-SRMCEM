// Tech Recall word bank.
//
// This is a MEMORY test, not a knowledge test - a player does not need to know
// what "Polymorphism" means, only to hold it for a few seconds and retype it.
// So difficulty is driven by length and how predictable the letters are, which
// is also what the flash timer scales on.
//
//   easy    5-7 chars,  everyday tech words
//   medium  8-11 chars, familiar but longer
//   hard    12+ chars,  long or awkward to spell
//
// Every game draws a fixed mix (see TechRecall.jsx), so no player gets a lucky
// run of short words while the next one gets a wall of long ones.

export const TECH_RECALL_WORDS = [
  // --- easy -----------------------------------------------------------------
  { word: 'Python', difficulty: 'easy' },
  { word: 'GitHub', difficulty: 'easy' },
  { word: 'Chrome', difficulty: 'easy' },
  { word: 'Server', difficulty: 'easy' },
  { word: 'Binary', difficulty: 'easy' },
  { word: 'Kernel', difficulty: 'easy' },
  { word: 'Cookie', difficulty: 'easy' },
  { word: 'Router', difficulty: 'easy' },
  { word: 'Pixels', difficulty: 'easy' },
  { word: 'Docker', difficulty: 'easy' },
  { word: 'Laptop', difficulty: 'easy' },
  { word: 'Widget', difficulty: 'easy' },
  { word: 'Buffer', difficulty: 'easy' },
  { word: 'Syntax', difficulty: 'easy' },
  { word: 'Vector', difficulty: 'easy' },
  { word: 'Backup', difficulty: 'easy' },
  { word: 'Domain', difficulty: 'easy' },
  { word: 'Kotlin', difficulty: 'easy' },
  { word: 'Applet', difficulty: 'easy' },
  { word: 'Bitmap', difficulty: 'easy' },
  { word: 'Cursor', difficulty: 'easy' },
  { word: 'Nvidia', difficulty: 'easy' },
  { word: 'Ubuntu', difficulty: 'easy' },
  { word: 'Gadget', difficulty: 'easy' },
  { word: 'Modem', difficulty: 'easy' },
  { word: 'Cache', difficulty: 'easy' },
  { word: 'Linux', difficulty: 'easy' },
  { word: 'Array', difficulty: 'easy' },
  { word: 'Debug', difficulty: 'easy' },
  { word: 'Pixel', difficulty: 'easy' },

  // --- medium ---------------------------------------------------------------
  { word: 'Firebase', difficulty: 'medium' },
  { word: 'Compiler', difficulty: 'medium' },
  { word: 'Database', difficulty: 'medium' },
  { word: 'Protocol', difficulty: 'medium' },
  { word: 'Metadata', difficulty: 'medium' },
  { word: 'Firewall', difficulty: 'medium' },
  { word: 'Encoding', difficulty: 'medium' },
  { word: 'Function', difficulty: 'medium' },
  { word: 'Iterator', difficulty: 'medium' },
  { word: 'Debugger', difficulty: 'medium' },
  { word: 'Runtime', difficulty: 'medium' },
  { word: 'Package', difficulty: 'medium' },
  { word: 'Bandwidth', difficulty: 'medium' },
  { word: 'Algorithm', difficulty: 'medium' },
  { word: 'Framework', difficulty: 'medium' },
  { word: 'Interface', difficulty: 'medium' },
  { word: 'Recursion', difficulty: 'medium' },
  { word: 'Bootstrap', difficulty: 'medium' },
  { word: 'Encrypted', difficulty: 'medium' },
  { word: 'Localhost', difficulty: 'medium' },
  { word: 'Namespace', difficulty: 'medium' },
  { word: 'Refactor', difficulty: 'medium' },
  { word: 'Container', difficulty: 'medium' },
  { word: 'JavaScript', difficulty: 'medium' },
  { word: 'Kubernetes', difficulty: 'medium' },
  { word: 'Middleware', difficulty: 'medium' },
  { word: 'Repository', difficulty: 'medium' },
  { word: 'Encryption', difficulty: 'medium' },
  { word: 'Blockchain', difficulty: 'medium' },
  { word: 'Serverless', difficulty: 'medium' },

  // --- hard -----------------------------------------------------------------
  { word: 'Polymorphism', difficulty: 'hard' },
  { word: 'Inheritance', difficulty: 'hard' },
  { word: 'Concurrency', difficulty: 'hard' },
  { word: 'Abstraction', difficulty: 'hard' },
  { word: 'Persistence', difficulty: 'hard' },
  { word: 'Cryptography', difficulty: 'hard' },
  { word: 'Asynchronous', difficulty: 'hard' },
  { word: 'Architecture', difficulty: 'hard' },
  { word: 'Optimization', difficulty: 'hard' },
  { word: 'Compression', difficulty: 'hard' },
  { word: 'Deployment', difficulty: 'hard' },
  { word: 'Virtualization', difficulty: 'hard' },
  { word: 'Authentication', difficulty: 'hard' },
  { word: 'Authorization', difficulty: 'hard' },
  { word: 'Encapsulation', difficulty: 'hard' },
  { word: 'Normalization', difficulty: 'hard' },
  { word: 'Microservices', difficulty: 'hard' },
  { word: 'Cybersecurity', difficulty: 'hard' },
  { word: 'Interpolation', difficulty: 'hard' },
  { word: 'Multithreading', difficulty: 'hard' },
  { word: 'Backpropagation', difficulty: 'hard' },
  { word: 'Instantiation', difficulty: 'hard' },
  { word: 'Synchronization', difficulty: 'hard' },
  { word: 'Interoperability', difficulty: 'hard' },
  { word: 'Decentralization', difficulty: 'hard' },
];
