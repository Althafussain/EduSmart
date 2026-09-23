# EduSmart Sri Lanka

EduSmart is a responsive Next.js App Router experience for Sri Lankan students. The first vertical slice is the student workspace and timed examination flow: personalized learning cards, upcoming exams, subject progress, an AI insight panel, and a usable exam modal with a live countdown and question navigation.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run lint
npm run build
```

## Product architecture

- `src/app/page.tsx` currently owns the interactive student workspace prototype and exam attempt state.
- `src/app/globals.css` contains the responsive visual system and mobile layout rules.
- The next production slice should move exam state into server actions/API routes backed by MongoDB and Prisma, with server-side deadline validation on every save and submit request.
- Authentication uses MongoDB-backed hashed credentials, signed HTTP-only sessions, role checks, and protected admin access.
- Google sign-in uses Google Identity Services in the browser and server-side ID-token verification. Set both Google client ID variables from `.env.example` before enabling it.
- Recommendation logic should be an injectable service: profile signals -> candidate resources -> ranking -> explanation. YouTube ingestion belongs behind a server-side API route so keys never reach the browser.
- AI marking should be asynchronous for short answers and essays, store rubric evidence and model version, and expose a teacher/admin review state before finalising disputed marks.

## Data model

The initial MongoDB contract is captured in `prisma/schema.prisma`. It covers users, student profiles, academic taxonomy, exams, questions, attempts, answers, results, recommendations, learning history, and performance analytics. The schema intentionally keeps AI evaluation metadata separate from the student answer so model output can be reviewed and re-run.

## Planned production modules

1. Password reset and account recovery flow.
2. Student onboarding/profile APIs and eligibility queries.
3. Admin exam/question management with secure uploads.
4. Server-backed autosave, attempt locking, and deadline enforcement.
5. Objective grading, rubric-based AI evaluation, result feedback, and performance recommendations.
