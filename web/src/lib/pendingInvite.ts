const PENDING_INVITE_KEY = "vbcoach.pendingInvite";

export function setPendingInvite(inviteToken: string) {
  localStorage.setItem(PENDING_INVITE_KEY, inviteToken);
}

export function takePendingInvite(): string | null {
  const token = localStorage.getItem(PENDING_INVITE_KEY);
  if (token) localStorage.removeItem(PENDING_INVITE_KEY);
  return token;
}
