import { z } from "zod";

// Image URLs we accept, mirroring the database's private.is_media_url / is_avatar_url checks.
const MEDIA_URL = /^https:\/\/[A-Za-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/media\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+$/;
const GOOGLE_PHOTO = /^https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9/_=.-]+$/;
const DEMO_MEDIA = /^\/api\/demo-media\/[A-Za-z0-9._-]+$/;

/** An image uploaded to dogear. (or, for avatars, the Google profile photo). */
export const imageUrl = (opts: { allowGoogle?: boolean } = {}) =>
  z
    .string()
    .max(500)
    .nullable()
    .refine((v) => !v || MEDIA_URL.test(v) || DEMO_MEDIA.test(v) || (Boolean(opts.allowGoogle) && GOOGLE_PHOTO.test(v)), "Upload the image here instead.");
