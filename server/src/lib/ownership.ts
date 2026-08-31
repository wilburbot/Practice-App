import { prisma } from "../db.js";

/** Matches a team the user can edit — either the owner, or an assistant coach added via invite link. */
const accessibleTeamWhere = (userId: string) => ({
  OR: [{ ownerId: userId }, { members: { some: { userId } } }],
});

/** Returns the team if the user can access it (owner or assistant coach), otherwise null. */
export async function findOwnedTeam(teamId: string, userId: string) {
  return prisma.team.findFirst({ where: { id: teamId, ...accessibleTeamWhere(userId) } });
}

/** Returns the team only if the user is its owner — for destructive/admin actions assistant coaches shouldn't do. */
export async function findOwnedTeamStrict(teamId: string, userId: string) {
  return prisma.team.findFirst({ where: { id: teamId, ownerId: userId } });
}

/** Returns the player if it exists and belongs to a team the user can access, otherwise null. */
export async function findOwnedPlayer(playerId: string, userId: string) {
  return prisma.player.findFirst({
    where: { id: playerId, team: accessibleTeamWhere(userId) },
  });
}

/** Returns the session if it exists and belongs to a team the user can access, otherwise null. */
export async function findOwnedSession(sessionId: string, userId: string) {
  return prisma.session.findFirst({
    where: { id: sessionId, team: accessibleTeamWhere(userId) },
  });
}

/** Returns the stat event if it exists and belongs to a team the user can access, otherwise null. */
export async function findOwnedStatEvent(eventId: string, userId: string) {
  return prisma.statEvent.findFirst({
    where: { id: eventId, session: { team: accessibleTeamWhere(userId) } },
  });
}
