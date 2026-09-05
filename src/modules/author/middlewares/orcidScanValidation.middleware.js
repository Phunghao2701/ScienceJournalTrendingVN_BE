import {
  extractOrcidId,
  normalizeOrcid,
} from "../../../utils/orcid.js";

export const ORCID_SCAN_CODES = {
  INVALID: "ORCID_INVALID",
  COMPLETED: "ORCID_SCAN_COMPLETED",
  PARTIAL: "ORCID_SCAN_PARTIAL",
  SOURCES_UNAVAILABLE: "EXTERNAL_SOURCES_UNAVAILABLE",
  AUTHOR_DELETED: "ORCID_AUTHOR_DELETED",
  QUEUED: "ORCID_SCAN_QUEUED",
  ALREADY_RUNNING: "ORCID_SCAN_ALREADY_RUNNING",
  JOB_INVALID: "ORCID_SCAN_JOB_INVALID",
  JOB_NOT_FOUND: "ORCID_SCAN_JOB_NOT_FOUND",
  SERVER_ERROR: "ORCID_SCAN_SERVER_ERROR",
};

export const validateOrcidScan = (req, res, next) => {
  const normalizedOrcid = normalizeOrcid(req.body?.orcid);

  if (!normalizedOrcid) {
    return res.status(400).json({
      success: false,
      code: ORCID_SCAN_CODES.INVALID,
      message: "ORCID khÃ´ng há»£p lá»‡",
    });
  }

  req.orcid = normalizedOrcid;
  req.orcidId = extractOrcidId(normalizedOrcid);
  next();
};

