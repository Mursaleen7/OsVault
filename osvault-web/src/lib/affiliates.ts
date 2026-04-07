/**
 * Affiliate links — replace href values with your actual affiliate URLs
 * once approved. Placeholders used until then.
 */
export const AFFILIATES = {
  snyk: {
    name: "Snyk",
    href: "https://snyk.io/?utm_source=osvault&utm_medium=referral",
    cta_critical: (count: number) =>
      `Found ${count} critical vulnerabilit${count === 1 ? "y" : "ies"}? Automate this check in your CI/CD pipeline with Snyk.`,
    cta_general:
      "Automate dependency scanning on every pull request with Snyk.",
  },
  socket: {
    name: "Socket.dev",
    href: "https://socket.dev/?utm_source=osvault&utm_medium=referral",
    cta_critical: (count: number) =>
      `${count} vulnerable package${count === 1 ? "" : "s"} detected. Socket catches supply-chain attacks before they hit production.`,
    cta_general:
      "Protect your supply chain from malicious packages with Socket.",
  },
  sonarqube: {
    name: "SonarQube",
    href: "https://www.sonarsource.com/products/sonarqube/?utm_source=osvault&utm_medium=referral",
    cta_critical: (_count: number) =>
      "Pair vulnerability scanning with static code analysis — SonarQube covers both.",
    cta_general:
      "Add SAST to your pipeline alongside dependency scanning with SonarQube.",
  },
};
