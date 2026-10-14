import { z } from "zod";

export const postInputSchema = z.object({
  title: z.string().max(300).optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  coverUrl: z.string().max(300).nullable().optional(),
  bodyHtml: z.string().max(200_000).optional(),
  tags: z.array(z.string().max(60)).max(30).optional(),
  relatedRecipeIds: z.array(z.string().max(40)).max(30).optional(),
  kind: z.string().max(20).optional(),
  sponsorLabel: z.string().max(20).nullable().optional(),
  profileId: z.string().max(40).nullable().optional(),
}).strict();

export const profileInputSchema = z.object({
  name: z.string().max(200).optional(),
  bio: z.string().max(4000).nullable().optional(),
  photoUrl: z.string().max(300).nullable().optional(),
  credentials: z.array(z.string().max(200)).max(20).optional(),
  links: z.array(z.object({ label: z.string().max(100).optional(), url: z.string().max(500) })).max(12).optional(),
  youtubeUrl: z.string().max(300).nullable().optional(),
}).strict();
