/**
 * Generate a URL-safe slug from a title. Spanish-aware (strips accents).
 * Falls back to a short random token if the title is non-alphanumeric.
 */
export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || randomSlug();
}

function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8);
}
