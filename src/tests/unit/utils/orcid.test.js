import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  extractOrcidId,
  isValidOrcid,
  normalizeDoi,
  normalizeIssn,
  normalizeOpenAlexId,
  normalizeOrcid,
  stripMarkup,
} from "../../../utils/orcid.js";

describe("ORCID normalization utilities", () => {
  test("accepts raw and URL ORCID iDs with a valid checksum", () => {
    assert.equal(
      extractOrcidId("https://orcid.org/0000-0002-1825-0097/"),
      "0000-0002-1825-0097",
    );
    assert.equal(isValidOrcid("0000-0002-1825-0097"), true);
    assert.equal(
      normalizeOrcid("http://www.orcid.org/0000-0002-1825-0097"),
      "https://orcid.org/0000-0002-1825-0097",
    );
  });

  test("rejects an invalid ORCID checksum", () => {
    assert.equal(isValidOrcid("0000-0002-1825-0098"), false);
    assert.equal(normalizeOrcid("0000-0002-1825-0098"), null);
  });

  test("normalizes DOI and OpenAlex identifiers", () => {
    assert.equal(
      normalizeDoi(" DOI: https://doi.org/10.1000/ABC "),
      "10.1000/abc",
    );
    assert.equal(
      normalizeDoi("https://doi.org/10.1000/ABC"),
      "10.1000/abc",
    );
    assert.equal(
      normalizeOpenAlexId("https://openalex.org/W123", "W"),
      "https://openalex.org/W123",
    );
    assert.equal(
      normalizeOpenAlexId("https://openalex.org/I456", "I"),
      "https://openalex.org/I456",
    );
    assert.equal(normalizeOpenAlexId("W123", "A"), null);
  });

  test("normalizes ISSN and rejects malformed identifiers", () => {
    assert.equal(normalizeIssn("1234-567X"), "1234567X");
    assert.equal(normalizeIssn("1859378x"), "1859378X");
    assert.equal(normalizeIssn("1859-378x"), "1859378X");
    assert.equal(normalizeIssn(" 1859-3526 "), "18593526");
    assert.equal(normalizeIssn("not-an-issn"), null);
  });

  test("removes markup from external metadata", () => {
    assert.equal(stripMarkup("<jats:p>Hello   world</jats:p>"), "Hello world");
  });
});
