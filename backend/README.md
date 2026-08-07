# Dr Laundry Cloudflare Worker

The Worker authenticates mobile requests with Supabase, stores profile photos
in a private Cloudflare R2 bucket, serves those photos through its public media
route, and writes the resulting URL to `public.profiles.avatar_url`.

## First deployment

From this `backend` directory:

```powershell
.\node_modules\.bin\wrangler.cmd login
.\node_modules\.bin\wrangler.cmd r2 bucket create dr-laundry-profile-images
.\node_modules\.bin\wrangler.cmd secret put SUPABASE_URL
.\node_modules\.bin\wrangler.cmd secret put SUPABASE_ANON_KEY
.\node_modules\.bin\wrangler.cmd secret put PAYSTACK_SECRET_KEY
npm run deploy
```

After deployment, set `EXPO_PUBLIC_API_BASE_URL` in the mobile app's `.env` to
the deployed Worker URL. For an existing Supabase project, also run
`supabase_profile_avatar.sql` in the Supabase SQL Editor.

For local development, keep the same three values in `backend/.dev.vars` and
run `npm start` from this directory. Wrangler provides local R2 storage.
