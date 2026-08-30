import { prisma } from "../db.js";

/** Returns the team if it exists and is owned by userId, otherwise null. */
export async function findOwnedTeam(teamId: string, userId: string) {
  return prisma.team.findFirst({ where: { id: teamId, ownerId: userId } });
}

/** Returns the player if it exists and belongs to a team owned by userId, otherwise null. */
export async function findOwnedPlayer(playerId: string, userId: string) {
  return prisma.player.findFirst({
    where: { id: playerId, team: { ownerId: userId } },
  });
}

/** Returns the session if it exists and belongs to a team owned by userId, otherwise null. */
export async function findOwnedSession(sessionId: string, userId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, team: { ownerId: userId } },
  });
}
