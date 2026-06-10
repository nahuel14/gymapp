import { ImageResponse } from "next/og";

export const runtime = "edge";

const paths = [
  "M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z",
  "M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z",
  "m9.6 14.4 4.8-4.8",
];

function DumbbellIcon({ maskable }: { maskable: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#09090B",
        width: 512,
        height: 512,
        borderRadius: maskable ? 0 : 90,
      }}
    >
      <svg
        width="360"
        height="360"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FACC15"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
    </div>
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const maskable = searchParams.get("maskable") === "1";

  return new ImageResponse(<DumbbellIcon maskable={maskable} />, {
    width: 512,
    height: 512,
  });
}
