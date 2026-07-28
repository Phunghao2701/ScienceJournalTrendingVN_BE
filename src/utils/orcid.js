const ORCID_ID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

/**
 * Extract the canonical 16-character ORCID iD (with hyphens) from either an
 * ORCID iD or an orcid.org URL.
 */
export const extractOrcidId = (value) => {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, "")
    .replace(/\/+$/, "")
    .toUpperCase();

  return ORCID_ID_PATTERN.test(normalized) ? normalized : null;
};

/**
 * Validate an ORCID iD using the ISO 7064 MOD 11-2 checksum.
 */
export const isValidOrcid = (value) => {
  const orcidId = extractOrcidId(value);
  if (!orcidId) return false;

  const compact = orcidId.replaceAll("-", "");
  let total = 0;

  for (const character of compact.slice(0, 15)) {
    total = (total + Number(character)) * 2;
  }

  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expectedCheckDigit = result === 10 ? "X" : String(result);

  return compact.at(-1) === expectedCheckDigit;
};

export const normalizeOrcid = (value) => {
  const orcidId = extractOrcidId(value);
  if (!orcidId || !isValidOrcid(orcidId)) return null;
  return `https://orcid.org/${orcidId}`;
};

export const normalizeDoi = (value) => {
  if (typeof value !== "string") return null;

  const normalized = value
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .trim()
    .toLowerCase();

  return normalized || null;
};

export const normalizeIssn = (value) => {
  if (typeof value !== "string") return null;
  const compact = value.trim().replace(/[^0-9X]/gi, "").toUpperCase();
  return /^[0-9]{7}[0-9X]$/.test(compact) ? compact : null;
};

export const normalizeOpenAlexId = (value, entityPrefix = null) => {
  if (typeof value !== "string") return null;

  const compact = value
    .trim()
    .replace(/^https?:\/\/openalex\.org\//i, "")
    .toUpperCase();

  if (!/^[A-Z]\d+$/.test(compact)) return null;
  if (entityPrefix && !compact.startsWith(entityPrefix.toUpperCase())) {
    return null;
  }

  return `https://openalex.org/${compact}`;
};

export const stripMarkup = (value) => {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped || null;
};
