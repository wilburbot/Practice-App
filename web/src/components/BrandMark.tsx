export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-lg bg-court text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      V
    </span>
  );
}
