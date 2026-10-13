import { createHash, randomBytes } from "crypto";
import { readdir, rm, statfs, chmod } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/admin-users";
import { buildExportZip, exportDir, uploadsSizeBytes, type ExportKind } from "@/lib/export/build";

export const EXPORT_LIMITS = { perAdminPerHour: 6 };
/** Finished zips are deleted this long after they are built. */
export const FILE_TTL_MS = 60 * 60 * 1000;
/** A download link works once and for at most this long (never past the file's expiry). */
export const LINK_TTL_MS = 60 * 60 * 1000;
const STALE_RUNNING_MS = 30 * 60 * 1000;
export const MIN_FREE_BYTES = 512 * 1024 * 1024;

export class ExportError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ExportError";
    this.status = status;
  }
}

const running = new Set<string>();
/** Serializes the check-then-create in startExport (one server process). */
let starting = false;

export function hashToken(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export type ExportJobDTO = {
  id: string;
  kind: string;
  targetUserId: string | null;
  status: string;
  progress: string | null;
  encrypted: boolean;
  fileName: string | null;
  sizeBytes: number | null;
  manifestSha256: string | null;
  error: string | null;
  downloadCount: number;
  expiresAt: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export function toJobDTO(j: Awaited<ReturnType<typeof prisma.exportJob.findFirst>> & object): ExportJobDTO {
  return {
    id: j.id,
    kind: j.kind,
    targetUserId: j.targetUserId,
    status: j.status,
    progress: j.progress,
    encrypted: j.encrypted,
    fileName: j.fileName,
    sizeBytes: j.sizeBytes,
    manifestSha256: j.manifestSha256,
    error: j.error,
    downloadCount: j.downloadCount,
    expiresAt: j.expiresAt?.toISOString() ?? null,
    createdAt: j.createdAt.toISOString(),
    finishedAt: j.finishedAt?.toISOString() ?? null,
  };
}

/** Delete expired zips, fail builds that died with a restart, remove orphan work dirs. */
export async function sweepExports(now = new Date()) {
  const expired = await prisma.exportJob.findMany({ where: { status: "done", expiresAt: { lt: now } } });
  for (const j of expired) {
    await rm(path.join(exportDir(), `${j.id}.zip`), { force: true });
    await prisma.exportJob.update({ where: { id: j.id }, data: { status: "expired", linkTokenHash: null, linkExpiresAt: null } });
  }
  const stuck = await prisma.exportJob.findMany({ where: { status: { in: ["queued", "running"] } } });
  for (const j of stuck) {
    if (running.has(j.id) && now.getTime() - j.createdAt.getTime() < STALE_RUNNING_MS) continue;
    if (!running.has(j.id)) {
      await prisma.exportJob.update({ where: { id: j.id }, data: { status: "failed", error: "Interrupted (server restarted)", finishedAt: now } });
    }
  }
  try {
    const live = new Set((await prisma.exportJob.findMany({ where: { status: "done" }, select: { id: true } })).map((j) => j.id));
    for (const f of await readdir(exportDir())) {
      const id = f.replace(/^\.work-/, "").replace(/\.zip$/, "");
      if ((f.endsWith(".zip") && !live.has(id)) || (f.startsWith(".work-") && !running.has(id))) {
        await rm(path.join(exportDir(), f), { recursive: true, force: true });
      }
    }
  } catch {
    /* dir not created yet */
  }
}

let sweeper: NodeJS.Timeout | null = null;
function ensureSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => void sweepExports().catch(() => {}), 5 * 60 * 1000);
  sweeper.unref?.();
}

export async function diskInfo() {
  const { mkdir } = await import("fs/promises");
  await mkdir(exportDir(), { recursive: true, mode: 0o700 });
  await chmod(exportDir(), 0o700).catch(() => {});
  const s = await statfs(exportDir());
  const free = Number(s.bavail) * Number(s.bsize);
  const total = Number(s.blocks) * Number(s.bsize);
  let dbBytes = 0;
  try {
    const r = (await prisma.$queryRawUnsafe(`SELECT pg_database_size(current_database())::bigint AS n`)) as { n: bigint }[];
    dbBytes = Number(r[0]?.n ?? 0);
  } catch {
    /* ignore */
  }
  const uploads = await uploadsSizeBytes();
  // Full export ≈ dump (smaller than on-disk DB) + uploads + CSV/JSON copies.
  const estimateFullBytes = dbBytes * 2 + uploads;
  return { freeBytes: free, totalBytes: total, dbBytes, uploadsBytes: uploads, estimateFullBytes };
}

export async function startExport(opts: {
  actorId: string;
  kind: ExportKind;
  targetUserId?: string | null;
  password?: string | null;
}) {
  if (starting || running.size > 0) {
    throw new ExportError("Another export is still building. Try again when it finishes.", 429);
  }
  starting = true;
  try {
    return await startExportLocked(opts);
  } finally {
    starting = false;
  }
}

async function startExportLocked(opts: {
  actorId: string;
  kind: ExportKind;
  targetUserId?: string | null;
  password?: string | null;
}) {
  ensureSweeper();
  await sweepExports();
  if (opts.kind === "user") {
    const u = opts.targetUserId ? await prisma.user.findUnique({ where: { id: opts.targetUserId }, select: { id: true } }) : null;
    if (!u) throw new ExportError("User not found", 404);
  }
  const active = await prisma.exportJob.count({ where: { status: { in: ["queued", "running"] } } });
  if (active > 0) throw new ExportError("Another export is still building. Try again when it finishes.", 429);
  const recent = await prisma.exportJob.count({
    where: { createdById: opts.actorId, createdAt: { gte: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= EXPORT_LIMITS.perAdminPerHour) {
    throw new ExportError(`Limit reached: ${EXPORT_LIMITS.perAdminPerHour} exports per hour.`, 429);
  }
  const disk = await diskInfo();
  const need = (opts.kind === "full" ? disk.estimateFullBytes : disk.estimateFullBytes / 4) + MIN_FREE_BYTES;
  if (disk.freeBytes < need) throw new ExportError("Not enough free disk space for this export.", 507);

  const job = await prisma.exportJob.create({
    data: {
      kind: opts.kind,
      targetUserId: opts.kind === "user" ? opts.targetUserId! : null,
      status: "running",
      progress: "Starting",
      encrypted: Boolean(opts.password),
      createdById: opts.actorId,
    },
  });
  running.add(job.id);
  const password = opts.password || null;
  // Build in the background; the page polls the job status.
  void (async () => {
    try {
      const r = await buildExportZip({
        jobId: job.id,
        kind: opts.kind,
        targetUserId: job.targetUserId,
        password,
        onProgress: async (m) => {
          await prisma.exportJob.update({ where: { id: job.id }, data: { progress: m } });
        },
      });
      await chmod(r.file, 0o600);
      const finishedAt = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.exportJob.update({
          where: { id: job.id },
          data: {
            status: "done",
            progress: null,
            fileName: r.fileName,
            sizeBytes: r.sizeBytes,
            manifestSha256: r.manifestSha256,
            finishedAt,
            expiresAt: new Date(finishedAt.getTime() + FILE_TTL_MS),
          },
        });
        await writeAudit(tx, {
          actorId: opts.actorId,
          targetUserId: job.targetUserId,
          action: "export.create",
          details: {
            jobId: job.id,
            kind: opts.kind,
            targetUserId: job.targetUserId,
            encrypted: Boolean(password),
            sizeBytes: r.sizeBytes,
            manifestSha256: r.manifestSha256,
            fileName: r.fileName,
            createdAt: finishedAt.toISOString(),
          },
        });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 300) : "Export failed";
      console.error("export build failed", job.id, msg);
      await prisma.exportJob.update({ where: { id: job.id }, data: { status: "failed", error: msg, progress: null, finishedAt: new Date() } }).catch(() => {});
      await writeAudit(prisma, {
        actorId: opts.actorId,
        targetUserId: job.targetUserId,
        action: "export.failed",
        details: { jobId: job.id, kind: opts.kind, targetUserId: job.targetUserId, error: msg },
      }).catch(() => {});
    } finally {
      running.delete(job.id);
    }
  })();
  return job;
}

/** New one-time link; replaces any previous unused link for this job. */
export async function issueDownloadLink(jobId: string) {
  await sweepExports();
  const j = await prisma.exportJob.findUnique({ where: { id: jobId } });
  if (!j || j.status !== "done" || !j.expiresAt) throw new ExportError("Export is not available", 404);
  const token = randomBytes(32).toString("base64url");
  const linkExpiresAt = new Date(Math.min(Date.now() + LINK_TTL_MS, j.expiresAt.getTime()));
  await prisma.exportJob.update({ where: { id: jobId }, data: { linkTokenHash: hashToken(token), linkExpiresAt } });
  return { token, linkExpiresAt };
}

/** Consume a link token exactly once. Returns the job when valid. */
export async function consumeDownloadToken(token: string) {
  await sweepExports();
  if (!/^[A-Za-z0-9_-]{30,100}$/.test(token)) return null;
  const h = hashToken(token);
  const now = new Date();
  const j = await prisma.exportJob.findUnique({ where: { linkTokenHash: h } });
  if (!j) return null;
  const r = await prisma.exportJob.updateMany({
    where: { id: j.id, linkTokenHash: h, linkExpiresAt: { gt: now }, status: "done" },
    data: { linkTokenHash: null, linkExpiresAt: null, downloadCount: { increment: 1 } },
  });
  return r.count === 1 ? j : null;
}
