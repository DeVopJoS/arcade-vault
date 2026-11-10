import Link from "next/link";

export default function GameNotFound() {
  return (
    <div
      className="fade-in"
      style={{ textAlign: "center", padding: "80px 24px" }}
    >
      <div
        className="pixel"
        style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
      >
        JUEGO NO ENCONTRADO
      </div>
      <p style={{ color: "var(--ink-faint)", marginBottom: 24 }}>
        Este cartucho no existe en el Vault.
      </p>
      <Link href="/" className="btn">
        VOLVER AL VAULT
      </Link>
    </div>
  );
}
