import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { findOwnedTeam, findOwnedTeamStrict } from "../lib/ownership.js";
import { askClaude, handleLLMError } from "../lib/llm.js";
import { summarizeTeamForLLM } from "../lib/llmContext.js";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

teamsRouter.get("/", async (req: AuthedRequest, res) => {
  const teams = await prisma.team.findMany({
    where: { OR: [{ ownerId: req.userId }, { members: { some: { userId: req.userId } } }] },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { players: true, sessions: true } } },
  });
  res.json(teams);
});

const teamSchema = z.object({
  name: z.string().min(1),
  season: z.string().optional(),
});

teamsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const team = await prisma.team.create({
    data: { ...parsed.data, ownerId: req.userId! },
  });
  res.status(201).json(team);
});

// Redeems a coach invite link: adds the current (logged-in) user as an assistant coach on that team.
teamsRouter.post("/join", async (req: AuthedRequest, res) => {
  const inviteToken = req.body?.inviteToken as string | undefined;
  if (!inviteToken) return res.status(400).json({ error: "inviteToken is required" });

  const team = await prisma.team.findUnique({ where: { inviteToken } });
  if (!team) return res.status(404).json({ error: "Invalid or expired invite link" });

  if (team.ownerId !== req.userId) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: team.id, userId: req.userId! } },
      update: {},
      create: { teamId: team.id, userId: req.userId! },
    });
  }
  res.json(team);
});

teamsRouter.get("/:teamId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });
  res.json(team);
});

teamsRouter.patch("/:teamId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });
  const parsed = teamSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }
  const updated = await prisma.team.update({ where: { id: team.id }, data: parsed.data });
  res.json(updated);
});

// Deleting a team is owner-only — assistant coaches can't destroy shared data.
teamsRouter.delete("/:teamId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeamStrict(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found, or you're not its owner" });
  await prisma.team.delete({ where: { id: team.id } });
  res.status(204).end();
});

// Returns the team's read-only share link token, generating one on first use.
teamsRouter.get("/:teamId/share", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  if (team.shareToken) return res.json({ shareToken: team.shareToken });

  const shareToken = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.team.update({ where: { id: team.id }, data: { shareToken } });
  res.json({ shareToken: updated.shareToken });
});

// Generates a brand-new share token, invalidating the old link (e.g. if it leaked).
teamsRouter.post("/:teamId/share/rotate", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const shareToken = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.team.update({ where: { id: team.id }, data: { shareToken } });
  res.json({ shareToken: updated.shareToken });
});

// Owner-only: returns the coach invite link token, generating one on first use.
teamsRouter.get("/:teamId/invite", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeamStrict(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found, or you're not its owner" });

  if (team.inviteToken) return res.json({ inviteToken: team.inviteToken });

  const inviteToken = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.team.update({ where: { id: team.id }, data: { inviteToken } });
  res.json({ inviteToken: updated.inviteToken });
});

// Owner-only: generates a brand-new invite token, invalidating the old one.
teamsRouter.post("/:teamId/invite/rotate", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeamStrict(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found, or you're not its owner" });

  const inviteToken = crypto.randomBytes(18).toString("base64url");
  const updated = await prisma.team.update({ where: { id: team.id }, data: { inviteToken } });
  res.json({ inviteToken: updated.inviteToken });
});

// Lists the owner plus every assistant coach on the team.
teamsRouter.get("/:teamId/members", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const [owner, members] = await Promise.all([
    prisma.user.findUnique({ where: { id: team.ownerId }, select: { id: true, name: true, email: true } }),
    prisma.teamMember.findMany({
      where: { teamId: team.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  res.json({ owner, members });
});

const addMemberSchema = z.object({ email: z.string().email() });

// Owner-only: adds an existing user as an assistant coach directly by email (no invite link needed).
teamsRouter.post("/:teamId/members", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeamStrict(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found, or you're not its owner" });

  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return res.status(404).json({
      error: "No coach account found with that email. Ask them to sign up, or send them the invite link instead.",
    });
  }
  if (user.id === team.ownerId) {
    return res.status(400).json({ error: "That's you — you're already the head coach on this team." });
  }

  const member = await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: team.id, userId: user.id } },
    update: {},
    create: { teamId: team.id, userId: user.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json(member);
});

// Owner-only: removes an assistant coach's edit access.
teamsRouter.delete("/:teamId/members/:memberId", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeamStrict(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found, or you're not its owner" });

  const member = await prisma.teamMember.findFirst({
    where: { id: req.params.memberId, teamId: team.id },
  });
  if (!member) return res.status(404).json({ error: "Coach not found on this team" });

  await prisma.teamMember.delete({ where: { id: member.id } });
  res.status(204).end();
});

const askSchema = z.object({ question: z.string().min(1).max(500) });

// Freeform Q&A over this team's season stats — not cached, each call is a fresh (billed) request.
teamsRouter.post("/:teamId/ask", async (req: AuthedRequest, res) => {
  const team = await findOwnedTeam(req.params.teamId, req.userId!);
  if (!team) return res.status(404).json({ error: "Team not found" });

  const parsed = askSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
  }

  try {
    const summary = await summarizeTeamForLLM(team.id);
    const answer = await askClaude(
      "You are an assistant analyzing volleyball stats for a coach. Answer the coach's question using ONLY the " +
        "season data given below. If the data doesn't contain the answer, say so plainly rather than guessing. " +
        "Be concise — a few sentences, not an essay.\n\n" +
        summary,
      parsed.data.question,
      500,
    );
    res.json({ answer });
  } catch (err) {
    handleLLMError(err, res);
  }
});
