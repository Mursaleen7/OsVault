/**
 * Extended Import Patterns for Go, Java/Kotlin, and Rust
 *
 * These patterns extend OsVault's reachability analysis beyond JS/TS/Python
 * to support polyglot enterprise repositories.
 */

/**
 * Build Go import patterns.
 * Matches: import "github.com/org/pkg"  or  import ( "github.com/org/pkg" )
 */
export function buildGoImportPatterns(escaped: string): RegExp[] {
  return [
    // Go single import
    new RegExp(`import\\s+"${escaped}(?:/[^"]*)?(?:\\s|")`, "m"),
    // Go grouped import block
    new RegExp(`import\\s*\\([^)]*"${escaped}(?:/[^"]*)?(?:\\s|")`, "ms"),
  ];
}

/**
 * Build Java/Kotlin import patterns.
 * Matches: import com.example.pkg.Class  or  import static com.example.pkg.Class.method
 */
export function buildJavaImportPatterns(escaped: string): RegExp[] {
  return [
    // Java standard import
    new RegExp(`^\\s*import\\s+(?:static\\s+)?${escaped}[.;]`, "m"),
    // Kotlin import (same syntax)
    new RegExp(`^\\s*import\\s+${escaped}\\.`, "m"),
  ];
}

/**
 * Build Rust import patterns.
 * Matches: use pkg::module::item  or  extern crate pkg
 */
export function buildRustImportPatterns(escaped: string): RegExp[] {
  // Rust crate names use underscores, but Cargo.toml uses hyphens.
  // Convert hyphens to underscores for matching in source code.
  const rustEscaped = escaped.replace(/-/g, "_");
  return [
    // use pkg::module::item
    new RegExp(`^\\s*use\\s+${rustEscaped}::`, "m"),
    // extern crate pkg
    new RegExp(`^\\s*extern\\s+crate\\s+${rustEscaped}\\b`, "m"),
    // Also match the hyphenated form in case it appears in string literals
    new RegExp(`^\\s*use\\s+${escaped}::`, "m"),
  ];
}
