export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem", fontFamily: "monospace" }}>
      <h1>OsVault</h1>
      <p>Open-source vulnerability intelligence for developers.</p>
      <ul>
        <li><a href="/checker">→ Check your dependencies</a></li>
        <li><a href="/npm/lodash">→ Example: lodash vulnerabilities</a></li>
        <li><a href="/cve/CVE-2026-5619">→ Example: CVE-2026-5619</a></li>
      </ul>
    </main>
  );
}
