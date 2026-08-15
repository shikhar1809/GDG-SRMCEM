const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  `    function isAdmin() {
      return request.auth != null;
    }`,
  `    function isAdmin() {
      return request.auth != null && 
        request.auth.token.email in get(/databases/$(database)/documents/huntConfig/global).data.adminEmails;
    }`
);

rules = rules.replace(
  `    match /huntPlayers/{playerId} {
      allow read, write: if true;
    }`,
  `    match /huntPlayers/{playerId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == playerId;
    }`
);

rules = rules.replace(
  `    match /techSharajScores/{docId} {
      allow read, write: if true;
    }`,
  `    match /techSharajScores/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == docId;
    }`
);

rules = rules.replace(
  `    match /aiEyeScores/{docId} {
      allow read, write: if true;
    }`,
  `    match /aiEyeScores/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == docId;
    }`
);

rules = rules.replace(
  `    match /techQuizScores/{docId} {
      allow read, write: if true;
    }`,
  `    match /techQuizScores/{docId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == docId;
    }`
);

rules = rules.replace(
  `    match /gameRequests/{docId} {
      allow read, write: if true;
    }`,
  `    match /gameRequests/{docId} {
      allow read: if true;
      allow write: if request.auth != null && (docId.matches(request.auth.uid + '.*') || isAdmin());
    }`
);

fs.writeFileSync('firestore.rules', rules);
console.log("Updated firestore.rules");
