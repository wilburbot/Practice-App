import { assetUrl } from "../lib/api";

interface AvatarPlayer {
  firstName: string;
  lastName: string;
  photoUrl: string | null;
}

export function PlayerAvatar({ player, size = 40 }: { player: AvatarPlayer; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };

  if (player.photoUrl) {
    return (
      <img
        src={assetUrl(player.photoUrl)}
        alt={`${player.firstName} ${player.lastName}`}
        style={style}
        className="rounded-full object-cover bg-slate-200 shrink-0"
      />
    );
  }

  const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`.toUpperCase();
  return (
    <div
      style={style}
      className="rounded-full bg-court text-white flex items-center justify-center font-semibold shrink-0"
    >
      {initials}
    </div>
  );
}
