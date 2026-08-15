# Decision Log: GDG SRMCEM Website

This document tracks all major technical and design decisions made during the development of this project, along with the rationale behind them.

## 1. Technical Stack (v2 - Modern React)
**Decision**: Use React, Tailwind CSS, Shadcn UI (inspired components), and Framer Motion (for light, standard interactions).
**Rationale**: React + Tailwind provides a robust foundation for building a high-quality modern web application.

## 2. Styling and Layout (v3 - Clean Standard Design)
**Decision**: Abandon complex sticky parallax in favor of a clean, standard vertical scrolling layout featuring a modern Bento Grid.
**Rationale**: The complex sticky parallax proved to be disjointed, buggy, and unprofessional. A standard layout with crisp typography, ample whitespace, and a bento grid is the industry standard for modern tech landing pages (e.g., Stripe, Vercel, Apple) and provides a much better user experience.

## 3. Backend (Firebase)
**Decision**: Initialize the Firebase App shell, but hardcode the team data in React for now.
**Rationale**: Hardcoding the team data allows for faster prototyping. Firebase can be hooked up later when dynamic updates are needed.

## 4. Design Language (Authentic Google Vibe)
**Decision**: Strictly adopt Material Design 3 (M3) principles utilizing exact Google Brand Hex codes (`#4285F4`, `#EA4335`, `#FBBC04`, `#34A853`).
**Rationale**: The user provided the official logo and requested a premium Google feel. We will use the provided logo and exact colors.
