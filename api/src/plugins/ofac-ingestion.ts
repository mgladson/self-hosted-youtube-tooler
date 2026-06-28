import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

/*
 * AML-1 — OFAC / UN / EU sanctions list ingestion (STUB — NOT REGISTERED)
 * ------------------------------------------------------------------------
 * This plugin is intentionally not wired into the Fastify app yet. It documents
 * the planned ingestion pipeline so engineers can see where to plug in a real
 * implementation. See docs/COMPLIANCE.md (KYC/AML coverage) for the operational
 * narrative.
 *
 * Sources:
 *   - OFAC SDN: https://www.treasury.gov/ofac/downloads/sdn.xml (or sdn.csv)
 *   - OFAC Consolidated: https://www.treasury.gov/ofac/downloads/consolidated/
 *   - UN Consolidated: https://scsanctions.un.org/resources/xml/en/consolidated.xml
 *   - EU Consolidated: https://webgate.ec.europa.eu/fsd/fsf/public/files/xmlFullSanctionsList_1_1/content
 *
 * Cadence:
 *   - Daily full ingest at 02:00 UTC into a `sanctions_list_entries` table
 *     (id, source, list_version, name, alt_names[], dob, address, ingested_at).
 *   - Hourly diff refresh into the in-memory bloom filter / hash set used by
 *     `sanctions.isBlocked` so newly added designations propagate within an hour.
 *
 * Matching:
 *   - Email + email-domain matching is insufficient on its own; full SDN match
 *     should also fuzzy-match billing name (Jaro-Winkler ≥ 0.92) once name fields
 *     are collected at checkout. Until then, OFAC entries map only to email +
 *     domain hits like the existing manual blocklist.
 *
 * TODO:
 *   1. Implement fetch + parser per source (ETag/last-modified for diffing).
 *   2. Persist to `sanctions_list_entries` (new migration).
 *   3. Replace the file-backed sanctions.ts blocklist with a union view of
 *      manual entries + ingested OFAC/UN/EU entries.
 *   4. Re-screen historical orders nightly (see api/src/scripts/sanctions-rescreen.ts).
 *   5. Wire to alerting: any new SDN match against an existing customer must
 *      file a SAR within regulatory deadline.
 */
async function ofacIngestion(_fastify: FastifyInstance) {
  // Intentionally empty — see docblock above. Do NOT register this plugin until
  // the implementation is complete and reviewed by compliance.
}

export const ofacIngestionPlugin = fp(ofacIngestion, {
  name: 'ofac-ingestion',
  dependencies: ['postgres', 'sanctions'],
});
