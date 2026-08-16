# GDG Arcade Point System

This document describes how winners are decided and how arcade leaderboard points are allotted.

## Global Leaderboard Rule

- `updateArcadeScore` stores each player's best score per game.
- Replaying a game only increases `totalScore` if the new score is higher than the player's previous best for that game.
- The shared score updater no longer caps every game at 100, because Mystery Hunt is cumulative.
- Most arcade games still use the GitHub fairness scorer and stay on a 0-100 scale.

## GitHub Fairness Scorer

Most games use `src/utils/scoring.js`.

The score combines:

- Accuracy: up to 85 points
- Speed: up to 15 points, scaled by accuracy

Players below the configured pass mark receive 0 points for that game. This prevents participation-only tapping from reaching the leaderboard.

Pass marks:

- Tech-O-Fire: 50%
- Guess The Impostor: 50%
- Tech Recall: 50%
- Prompt Wars: 50%
- AI Eye: 40% net score, because wrong AI Eye guesses are penalized

## Tech Recall

Winning criteria:

- The player must type the target technical term closely enough.
- Matching is case-insensitive and ignores spaces, dots, and dashes.
- Longer words allow small typo tolerance through `isCloseEnough`.
- The game draws a graded set of words so each player receives a fair difficulty mix.

Point allotment:

- Uses `arcadePoints`.
- Below pass mark: 0 points
- Passing score: accuracy plus speed bonus
- Maximum score: 100 points

## Prompt Wars

Winning criteria:

- The player sees AI-generated images and submits prompt guesses.
- Prompt similarity is calculated from meaningful content words.
- Stopwords and filler words do not help.
- Overly long guesses are reduced by a precision guard.

Point allotment:

- Uses `arcadePointsFromRatio`.
- Below pass mark: 0 points
- Passing score: similarity ratio plus speed bonus
- Maximum score: 100 points

## Mystery Hunt

Winning criteria:

- There are 9 normal levels and 1 Mega Level.
- Normal levels are independent and can be solved in any order.
- Each level has only one winner: the first signed-in player to enter the correct code.
- The Mega Level unlocks only after all 9 normal levels have been claimed.

Point allotment:

- Normal levels 1-9: 75 points per claimed level
- Mega Level 10: 150 points
- The leaderboard receives the player's cumulative Mystery Hunt score after every successful claim.
- Maximum theoretical Mystery Hunt score: 825 points

## Guess The Impostor

Winning criteria:

- The player must identify the item that does not belong in the category.
- Options are shuffled at runtime so answer positions cannot be memorized.
- Questions are drawn from a graded difficulty profile.

Point allotment:

- Uses `arcadePoints`.
- Below pass mark: 0 points
- Passing score: accuracy plus speed bonus
- Maximum score: 100 points

## AI Eye

Winning criteria:

- The player decides whether each image is real or AI-generated.
- Wrong answers are penalized because it is a two-option game.

Point allotment:

- Uses `arcadePoints` with `wrongPenalty: 1`.
- Below AI Eye's net pass mark: 0 points
- Passing score: net accuracy plus speed bonus
- Maximum score: 100 points

## Tech-O-Fire

Winning criteria:

- The player answers rapid-fire multiple-choice technical questions.
- Options are shuffled at runtime.
- Questions are drawn from a graded difficulty profile.

Point allotment:

- Uses `arcadePoints`.
- Below pass mark: 0 points
- Passing score: accuracy plus speed bonus
- Maximum score: 100 points

## Current Maximum Arcade Total

If a player gets the best possible score in every arcade game, the maximum total is:

- Tech Recall: 100
- Prompt Wars: 100
- Mystery Hunt: 825
- Guess The Impostor: 100
- AI Eye: 100
- Tech-O-Fire: 100

Total possible arcade score: 1325 points.
