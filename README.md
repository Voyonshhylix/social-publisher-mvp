# Social Publisher MVP

One composer, one Ayrshare API call, and platform-level publishing results. Link the social accounts you want to use inside Ayrshare before publishing.

## Local setup

1. Copy `.env.example` to `.env.local` and set `SOCIAL_API_KEY` to the Ayrshare Primary Profile API key.
2. Run `npm install` then `npm run dev`.

Vercel serves `api/publish.js` as the server-side endpoint. Set the same `SOCIAL_API_KEY` in the Vercel project environment variables before deploying.
