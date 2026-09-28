-- Story media (photos + YouTube links) for the "Story behind this food" section.
-- JSON array string, same convention as tags/origins. Non-destructive: existing rows get '[]'.
ALTER TABLE "Recipe" ADD COLUMN "originStoryMedia" TEXT NOT NULL DEFAULT '[]';
