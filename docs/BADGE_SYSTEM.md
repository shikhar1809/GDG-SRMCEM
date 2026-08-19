# GDG Arcade Badge System

This document explains the digital badge system at `/credential/mybadges`.

## Purpose

Players sign in with Gmail, claim earned GDG Arcade badges, and see them later at:

`https://gdgsrmcem.web.app/credential/mybadges`

The badge page is protected by Google sign-in. Badges are linked to the player's Firebase Auth UID and Gmail address.

Admins manage reusable badge templates and Gmail-based badge awards from:

`https://gdgsrmcem.web.app/admin`

## Data Sources

Eligibility is calculated from:

- Collection: `arcadeScores`
- Document ID: Firebase Auth UID
- Important fields:
  - `totalScore`
  - `score_tech-recall`
  - `score_prompt-wars`
  - `score_guess-impostor`
  - `score_ai-eye`
  - `score_tech-quiz`
  - `score_mystery-hunt`
  - `played_*` flags

The app does not scan all players to render one player's badges. It reads only:

- `arcadeScores/{uid}`
- `credentialBadges/{uid}/badges/*`

This keeps the page cheap and stable for thousands of players over multiple years.

## Badge Claim Storage

Claimed badges are stored in:

`credentialBadges/{uid}/badges/{badgeId}`

Each badge document stores:

- `badgeId`
- `title`
- `tier`
- `claimedName`
- `userId`
- `recipientEmail`
- `recipientDisplayName`
- `permanentUrl`
- `issuer`
- `rulesVersion`
- `scoreSnapshot`
- `claimedAt`
- `updatedAt`

There is also a lightweight profile document:

`credentialBadges/{uid}`

It stores:

- `userId`
- `email`
- `displayName`
- `updatedAt`

## Current Badge Types

### Arcade Participant

Eligibility:

- The player has participated in at least one GDG Arcade game.

Participation is detected when the player's `arcadeScores/{uid}` document has a `played_*` flag or a score field for any game.

### Multi-Game Winner

Eligibility:

- The player has won more than 3 games.

Current implementation:

- Non-Mystery games count as won when their best score is greater than or equal to `1`.
- Mystery Hunt counts as won when `score_mystery-hunt >= 75`, meaning the player has claimed at least one hunt level.
- The badge unlocks when the player has 4 or more wins.

### Welcome Badge

Eligibility:

- Awarded to everyone who visits the stall or joins the platform.

Current implementation:

- Claimable by any user.

## Rule Versioning

Badge rules are versioned in:

`src/utils/badgeRules.js`

Current version:

`2026-08-15.badges.v1`

When changing badge logic in the future:

1. Update `BADGE_RULES_VERSION`.
2. Update badge definitions or win thresholds.
3. Update this document.
4. Test `/credential/mybadges` with players who have no badges, some badges, and all badges.

## Firestore Rules

Security rules allow players to read and write only their own credential documents:

- `credentialBadges/{uid}`
- `credentialBadges/{uid}/badges/{badgeId}`

Rules also require:

- `userId` matches the signed-in UID.
- `recipientEmail` matches the signed-in Gmail address.
- `claimedName` is between 2 and 60 characters.
- Badge deletion is blocked from the client.

Admins can read credential badge records.

## Badge Rendering

Badges are rendered as SVG in:

`src/pages/MyBadges.jsx`

The SVG embeds:

- Claimed name
- Gmail address
- Badge title
- Badge tier
- Issued date
- Issuer text

The player can download the badge as an SVG, but the durable source of truth remains the Firestore claim and the permanent credential page.

## Future Event Badge Admin

The `/admin` panel has a Credentials tab for non-arcade event badges.

Admins can:

- Create reusable badge templates.
- Choose a color preset and badge text.
- Issue one template to one or many student Gmail addresses.
- Let students claim those badges later from `/credential/mybadges`.

### Badge Templates

Templates are stored in:

`badgeTemplates/{templateId}`

Important fields:

- `title`
- `shortTitle`
- `eventName`
- `subtitle`
- `description`
- `tier`
- `accent`
- `glow`
- `ribbon`
- `text`
- `issuer`
- `active`
- `createdBy`
- `createdAt`
- `updatedAt`

Templates are reusable. Creating a template does not award it to anyone by itself.

### Manual Gmail Awards

Manual awards are stored under the recipient email:

`manualCredentialBadges/{lowercaseEmail}/badges/{badgeId}`

This layout avoids scanning all awards when a student opens their badge page. For 1000-2000+ students over years, each student reads only their own Gmail bucket.

Important fields:

- `badgeId`
- `source: "manual"`
- `templateId`
- Template snapshot fields such as `title`, `eventName`, `tier`, and colors
- `recipientEmail`
- `permanentUrl`
- `issuedBy`
- `issuedAt`
- `updatedAt`

When a student claims a manual award, the personalized claim is written to:

`credentialBadges/{uid}/badges/{badgeId}`

The claim stores the entered display name and a snapshot of the badge styling/text.

### Admin Rules

Firestore rules allow:

- Admins to create/update/delete `badgeTemplates`.
- Admins to create/update/delete `manualCredentialBadges/{email}/badges/{badgeId}`.
- Students to read only manual awards where the document email matches their signed-in Gmail.
- Students to claim only manual awards that exist for their signed-in Gmail.

### Adding Future Badge Types

For event badges, prefer using `/admin` instead of editing code:

1. Open `/admin`.
2. Go to Credentials.
3. Create a badge template for the event.
4. Paste student Gmail addresses.
5. Issue the badge.
6. Tell students to visit `/credential/mybadges`, sign in, click Claim Badge, and enter the name to print.
