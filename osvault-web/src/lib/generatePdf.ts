import type { CheckResult } from "@/app/api/check/route";

export async function generatePdf(result: CheckResult, email: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  const line = (text: string, size = 11, color = "#111111") => {
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(text, 48, y);
    y += size * 1.6;
  };

  const rule = () => {
    doc.setDrawColor("#e5e7eb");
    doc.line(48, y, W - 48, y);
    y += 12;
  };

  // Header
  doc.setFillColor("#111827");
  doc.rect(0, 0, W, 56, "F");
  doc.setFontSize(20);
  doc.setTextColor("#ffffff");
  doc.text("OsVault Security Report", 48, 36);
  y = 80;

  // Meta
  line(`Generated: ${new Date().toUTCString()}`, 9, "#6b7280");
  line(`Recipient: ${email}`, 9, "#6b7280");
  y += 8;
  rule();

  // Summary
  line("Summary", 15);
  line(`Security Grade: ${result.grade}   Score: ${result.score}/100`, 12);
  line(`Packages scanned: ${result.total_packages}`, 11);
  line(`Vulnerable: ${result.vulnerable_count}   Critical: ${result.critical_count}   High: ${result.high_count}`, 11);
  y += 8;
  rule();

  // Vulnerability table
  line("Vulnerability Details", 15);
  y += 4;

  if (result.vulns.length === 0) {
    line("No known vulnerabilities found.", 11, "#16a34a");
  } else {
    const SEVERITY_COLOR: Record<string, string> = {
      CRITICAL: "#dc2626", HIGH: "#ea580c", MEDIUM: "#ca8a04", LOW: "#16a34a",
    };

    for (const v of result.vulns) {
      if (y > 760) { doc.addPage(); y = 48; }

      const id = v.cve_id ?? v.osv_id ?? "—";
      const sev = v.cvss_severity ?? "—";
      const color = SEVERITY_COLOR[sev] ?? "#111111";

      doc.setFontSize(11);
      doc.setTextColor(color);
      doc.text(`[${sev}]`, 48, y);
      doc.setTextColor("#111111");
      doc.text(`${v.package}@${v.version}  —  ${id}  —  CVSS: ${v.cvss_score ?? "N/A"}  Risk: ${v.combined_risk_score ?? "N/A"}`, 110, y);
      y += 16;

      if (v.summary) {
        const wrapped = doc.splitTextToSize(`  ${v.summary}`, W - 96);
        doc.setFontSize(9);
        doc.setTextColor("#6b7280");
        doc.text(wrapped, 48, y);
        y += wrapped.length * 13;
      }

      if (v.affected_versions?.length) {
        doc.setFontSize(9);
        doc.setTextColor("#6b7280");
        doc.text(`  Affected versions: ${v.affected_versions.slice(0, 6).join(", ")}`, 48, y);
        y += 13;
      }

      y += 6;
    }
  }

  // Footer
  rule();
  line("Automate this check in your CI/CD pipeline — osvault.dev", 9, "#6b7280");

  doc.save(`osvault-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
