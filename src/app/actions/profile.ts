"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/auth";
import { run } from "@/lib/server-action";
import { USERNAME_RE } from "@/lib/utils";
import { ValidationError } from "@/lib/data/store";
import { isSupabaseConfigured } from "@/lib/env";

const username = z.string().trim().toLowerCase().regex(USERNAME_RE, "3–24 characters: lowercase letters, numbers, dots and underscores.");

export async function checkUsernameAction(value: string) {
  return run(async () => {
    const u = username.parse(value);
    const store = await getStore();
    return { available: await store.isUsernameAvailable(u) };
  });
}

const onboardingSchema = z.object({
  username,
  displayName: z.string().trim().min(1, "Tell us what to call you.").max(60),
  bio: z.string().trim().max(280).default(""),
  genres: z.array(z.string().max(40)).max(15),
  authors: z.array(z.string().trim().min(1).max(80)).max(12),
  readingGoal: z.number().int().min(1).max(1000).nullable(),
});

export async function saveOnboardingProfileAction(input: z.input<typeof onboardingSchema>) {
  return run(async () => {
    const data = onboardingSchema.parse(input);
    const store = await getStore();
    if (!(await store.isUsernameAvailable(data.username))) throw new ValidationError("That username is taken.");
    await store.updateProfile({
      username: data.username, displayName: data.displayName, bio: data.bio, favouriteGenres: data.genres,
      favouriteAuthors: data.authors, readingGoal: data.readingGoal,
    });
    return store.suggestedReaders(9);
  });
}

export async function finishOnboardingAction(followIds: string[]) {
  return run(async () => {
    const store = await getStore();
    for (const id of z.array(z.string()).max(50).parse(followIds)) await store.follow(id);
    await store.updateProfile({ onboarded: true });
    revalidatePath("/", "layout");
  });
}

const profileSchema = z.object({
  username,
  displayName: z.string().trim().min(1).max(60),
  bio: z.string().trim().max(280),
  pronouns: z.string().trim().max(30).transform((v) => v || null),
  location: z.string().trim().max(60).transform((v) => v || null),
  website: z.string().trim().max(200).refine((v) => !v || /^https?:\/\//.test(v), "Websites should start with https://").transform((v) => v || null),
  accent: z.enum(["burgundy", "sage", "rose", "butter", "ink"]),
  motif: z.enum(["dogear", "stars", "botanical", "stripes", "none"]),
  favouriteGenres: z.array(z.string().max(40)).max(15),
  favouriteAuthors: z.array(z.string().trim().min(1).max(80)).max(12),
  readingGoal: z.number().int().min(1).max(1000).nullable(),
  avatarUrl: z.string().max(500).nullable(),
  coverUrl: z.string().max(500).nullable(),
});

export async function updateProfileAction(input: z.input<typeof profileSchema>) {
  return run(async () => {
    const data = profileSchema.parse(input);
    const store = await getStore();
    const profile = await store.updateProfile(data);
    revalidatePath("/", "layout");
    return profile;
  });
}

const MAX_UPLOAD = 2 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

/** Upload an avatar, profile cover or list image. Returns a public URL. */
export async function uploadImageAction(form: FormData) {
  return run(async () => {
    const file = form.get("file");
    const kind = z.enum(["avatar", "cover", "list"]).parse(form.get("kind"));
    if (!(file instanceof File)) throw new ValidationError("Choose an image first.");
    if (!TYPES[file.type]) throw new ValidationError("Use a JPG, PNG, WebP or GIF.");
    if (file.size > MAX_UPLOAD) throw new ValidationError("Images can be up to 2 MB.");
    const store = await getStore();
    if (!store.viewerId) throw new ValidationError("Sign in to upload.");
    const name = `${kind}-${Date.now()}.${TYPES[file.type]}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    if (isSupabaseConfigured) {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const sb = await createSupabaseServerClient();
      const path = `${store.viewerId}/${name}`;
      const { error } = await sb.storage.from("media").upload(path, bytes, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
    }
    const { saveDemoUpload } = await import("@/lib/data/demo/uploads");
    return saveDemoUpload(store.viewerId, name, bytes);
  });
}
