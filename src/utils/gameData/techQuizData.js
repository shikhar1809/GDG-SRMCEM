// TECH-O-FIRE question bank.
//
// Audience is B.Tech FIRST YEAR, so the tiers are pitched at what they have
// actually met by semester 1-2:
//   easy    general tech literacy - phones, browsers, big tech, acronyms
//   medium  intro programming / CS fundamentals from first-year coursework
//   hard    stretch questions; only ONE per game so nobody is buried by them
//
// correctIndex here is only the answer's position in this file - options are
// shuffled at runtime (see TechQuiz.jsx), so the queue behind a player cannot
// memorise "it's always the third one".

export const TECH_QUIZ_QUESTIONS = [
  // --- easy -----------------------------------------------------------------
  {
    question: 'What does HTML stand for?',
    options: ['Hyper Text Markup Language', 'High Text Machine Language', 'Hyper Tabular Markup Language', 'Home Tool Markup Language'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does CPU stand for?',
    options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Process Utility', 'Core Processing Unit'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does RAM stand for?',
    options: ['Random Access Memory', 'Rapid Access Memory', 'Readable Active Memory', 'Remote Access Module'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which company created the Android operating system?',
    options: ['Google', 'Apple', 'Samsung', 'Microsoft'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does "www" stand for in a website address?',
    options: ['World Wide Web', 'Web World Wide', 'Wide Web World', 'World Web Wide'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which of these is a search engine?',
    options: ['Bing', 'Photoshop', 'Excel', 'Blender'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Who is the co-founder of Microsoft alongside Bill Gates?',
    options: ['Paul Allen', 'Steve Jobs', 'Steve Ballmer', 'Larry Page'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does GPU stand for?',
    options: ['Graphics Processing Unit', 'General Processing Unit', 'Graphical Peripheral Unit', 'Game Processing Unit'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which company owns YouTube?',
    options: ['Google', 'Meta', 'Amazon', 'Netflix'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does URL stand for?',
    options: ['Uniform Resource Locator', 'Universal Resource Link', 'Uniform Reference Locator', 'United Resource Locator'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which of these is an operating system?',
    options: ['Linux', 'Firefox', 'Oracle', 'Python'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'In computing, what is a "bug"?',
    options: ['An error or flaw in software', 'A type of virus', 'A hardware upgrade', 'A network cable'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does VPN stand for?',
    options: ['Virtual Private Network', 'Verified Public Network', 'Virtual Public Node', 'Variable Private Network'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which programming language shares its name with a type of coffee?',
    options: ['Java', 'Python', 'Ruby', 'Swift'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does the "G" in 5G stand for?',
    options: ['Generation', 'Gigabyte', 'Global', 'Gateway'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which company makes the iPhone?',
    options: ['Apple', 'Samsung', 'Xiaomi', 'Nokia'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does PDF stand for?',
    options: ['Portable Document Format', 'Printed Document File', 'Personal Data File', 'Public Document Format'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which of these is NOT a web browser?',
    options: ['Photoshop', 'Chrome', 'Safari', 'Edge'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Who is often called the world\'s first computer programmer?',
    options: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Charles Babbage'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does Wi-Fi primarily let a device do?',
    options: ['Connect to a network wirelessly', 'Increase storage space', 'Cool the processor', 'Charge the battery'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'Which social media platform is known for short videos and was made by ByteDance?',
    options: ['TikTok', 'LinkedIn', 'Pinterest', 'Reddit'],
    correctIndex: 0,
    difficulty: 'easy',
  },
  {
    question: 'What does "AI" stand for?',
    options: ['Artificial Intelligence', 'Automated Interface', 'Advanced Integration', 'Applied Informatics'],
    correctIndex: 0,
    difficulty: 'easy',
  },

  // --- medium ---------------------------------------------------------------
  {
    question: 'What does CSS stand for?',
    options: ['Cascading Style Sheets', 'Computer Style Sheets', 'Creative Style System', 'Coded Style Sheets'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which data structure works on LIFO (Last In, First Out)?',
    options: ['Stack', 'Queue', 'Linked List', 'Tree'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which data structure works on FIFO (First In, First Out)?',
    options: ['Queue', 'Stack', 'Graph', 'Heap'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'In most programming languages, what is the index of the first element of an array?',
    options: ['0', '1', '-1', 'It depends on the array size'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What does SQL stand for?',
    options: ['Structured Query Language', 'Sequential Query Language', 'Standard Question Language', 'System Query Logic'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What is the decimal value of the binary number 1010?',
    options: ['10', '8', '12', '20'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Who created the Git version control system?',
    options: ['Linus Torvalds', 'Dennis Ritchie', 'Guido van Rossum', 'James Gosling'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What does IDE stand for in software development?',
    options: ['Integrated Development Environment', 'Internal Data Engine', 'Interactive Design Editor', 'Integrated Debugging Extension'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which company developed the Java programming language?',
    options: ['Sun Microsystems', 'Microsoft', 'IBM', 'Apple'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which JavaScript library for building user interfaces was created at Facebook?',
    options: ['React', 'Angular', 'Vue', 'Svelte'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What does API stand for?',
    options: ['Application Programming Interface', 'Applied Program Instruction', 'Automated Process Integration', 'Application Process Identifier'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What does JSON stand for?',
    options: ['JavaScript Object Notation', 'Java Standard Output Name', 'JavaScript Ordered Nodes', 'Joined Simple Object Notation'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which command downloads a copy of a remote Git repository to your machine?',
    options: ['git clone', 'git push', 'git branch', 'git commit'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What is the largest value an 8-bit unsigned integer can hold?',
    options: ['255', '256', '128', '512'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which company acquired GitHub in 2018?',
    options: ['Microsoft', 'Google', 'Amazon', 'Oracle'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which of these languages is NOT object-oriented?',
    options: ['C', 'C++', 'Java', 'Python'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What does DOM stand for in web development?',
    options: ['Document Object Model', 'Data Object Mapping', 'Domain Oriented Markup', 'Dynamic Output Method'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which language is mainly used for building native iOS apps today?',
    options: ['Swift', 'Kotlin', 'Dart', 'Go'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which cross-platform app framework was created by Google?',
    options: ['Flutter', 'React Native', 'Ionic', 'Xamarin'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What is the main job of a firewall?',
    options: ['Monitor and control network traffic', 'Speed up the processor', 'Back up files automatically', 'Compress large images'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'Which of these is a NoSQL database?',
    options: ['MongoDB', 'PostgreSQL', 'MySQL', 'SQLite'],
    correctIndex: 0,
    difficulty: 'medium',
  },
  {
    question: 'What does an operating system\'s "kernel" do?',
    options: ['Manages hardware and core system resources', 'Renders the desktop wallpaper', 'Stores user documents', 'Compiles source code'],
    correctIndex: 0,
    difficulty: 'medium',
  },

  // --- hard -----------------------------------------------------------------
  {
    question: 'What is the time complexity of binary search on a sorted array?',
    options: ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which port does HTTPS use by default?',
    options: ['443', '80', '22', '8080'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which port does SSH use by default?',
    options: ['22', '21', '443', '3306'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which design pattern restricts a class to a single instance?',
    options: ['Singleton', 'Factory', 'Observer', 'Adapter'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'What is the main purpose of a Docker container?',
    options: ['Package an app with its dependencies so it runs anywhere', 'Encrypt network traffic', 'Speed up database queries', 'Replace the operating system kernel'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'What does JWT stand for?',
    options: ['JSON Web Token', 'Java Web Toolkit', 'JavaScript Web Transfer', 'Joined Web Ticket'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which AWS service provides scalable object storage?',
    options: ['S3', 'EC2', 'Lambda', 'Route 53'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'What is Redux primarily used for in a React application?',
    options: ['State management', 'Routing between pages', 'Styling components', 'Running unit tests'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which HTTP method is normally used to create a new resource?',
    options: ['POST', 'GET', 'DELETE', 'HEAD'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which company created the Kotlin programming language?',
    options: ['JetBrains', 'Google', 'Oracle', 'Microsoft'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which of these is a CSS preprocessor?',
    options: ['SASS', 'Babel', 'Webpack', 'ESLint'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'What does SaaS stand for?',
    options: ['Software as a Service', 'Storage as a Service', 'System as a Service', 'Security as a Service'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'In Big-O terms, what is the average time complexity of quicksort?',
    options: ['O(n log n)', 'O(n)', 'O(n squared)', 'O(log n)'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'What does a "404" HTTP status code mean?',
    options: ['Not Found', 'Server Error', 'Unauthorized', 'Request Timeout'],
    correctIndex: 0,
    difficulty: 'hard',
  },
  {
    question: 'Which protocol translates domain names into IP addresses?',
    options: ['DNS', 'DHCP', 'FTP', 'SMTP'],
    correctIndex: 0,
    difficulty: 'hard',
  },
];
