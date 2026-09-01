-- 1. Create the new SessionVideo table first (nothing references it yet).
CREATE TABLE "SessionVideo" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT,
    "durationSec" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionVideo_pkey" PRIMARY KEY ("id")
);

-- 2. Add the new nullable columns that data migration below needs to populate.
ALTER TABLE "Session" ADD COLUMN     "activeVideoClipId" TEXT;
ALTER TABLE "StatEvent" ADD COLUMN     "videoClipId" TEXT;

-- 3. DATA MIGRATION — preserve every existing session video and re-link its tagged stat events.
--    Each pre-migration Session had at most one video, so every one of its StatEvent rows with a
--    videoTimestampSec unambiguously belongs to that same video.

-- 3a. One SessionVideo row per Session that already has a video. Portable unique id (no extension
--     dependency): random + high-precision clock + session id as salt, hashed.
INSERT INTO "SessionVideo" ("id", "sessionId", "url", "durationSec", "startedAt", "createdAt")
SELECT
    'sv_' || substr(md5(random()::text || clock_timestamp()::text || s."id"), 1, 24),
    s."id",
    s."videoUrl",
    s."videoDurationSec",
    COALESCE(s."videoStartedAt", s."date", s."createdAt"),
    now()
FROM "Session" s
WHERE s."videoUrl" IS NOT NULL;

-- 3b. Link every tagged stat event to its session's (now-created) video clip.
UPDATE "StatEvent" se
SET "videoClipId" = sv."id"
FROM "SessionVideo" sv
WHERE sv."sessionId" = se."sessionId"
  AND se."videoTimestampSec" IS NOT NULL;

-- 4. Now safe to drop the old single-video columns from Session — their data has been copied out.
ALTER TABLE "Session" DROP COLUMN "videoDurationSec",
DROP COLUMN "videoStartedAt",
DROP COLUMN "videoUrl";

-- 5. Indexes + foreign keys (added last, after backfill, so they validate cleanly against real data).
CREATE INDEX "SessionVideo_sessionId_idx" ON "SessionVideo"("sessionId");

CREATE INDEX "StatEvent_videoClipId_idx" ON "StatEvent"("videoClipId");

ALTER TABLE "SessionVideo" ADD CONSTRAINT "SessionVideo_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StatEvent" ADD CONSTRAINT "StatEvent_videoClipId_fkey" FOREIGN KEY ("videoClipId") REFERENCES "SessionVideo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
