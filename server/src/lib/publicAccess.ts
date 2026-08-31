import { prisma } from "../db.js";

/** Resolves a team from its public share token. Returns null for an unset/unknown token. */
export async function findTeamByShareToken(shareToken: string) {
  if (!shareToken) return null;
  return prisma.team.findUnique({ where: { shareToken } });
}

/** Returns the session if it exists and belongs to the team behind this share token. */
export async function findSessionByShareToken(shareToken: string, sessionId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, team: { shareToken } },
  });
}

/** Returns the player if it exists and belongs to the team behind this share token. */
export async function findPlayerByShareToken(shareToken: string, playerId: string) {
  return prisma.player.findFirst({
    where: { id: playerId, team: { shareToken } },
  });
}
