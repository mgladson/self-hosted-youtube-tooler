---
name: docs-check
description: "Audits Claude Code reference documentation for freshness. Checks Anthropic's official sources (docs, blog, GitHub, PDFs) against local reference material, performs content diffs, and reports what needs updating. Invoke with /docs-check, /docs-check --full, or /docs-check --save."
---

# Documentation Freshness Audit

You are executing the `/docs-check` skill. Follow these steps precisely to audit the local reference material against upstream Anthropic sources and produce a freshness report.

## Step 0: Parse Arguments & Determine Mode

Extract the mode from the user's arguments:

- **No arguments** or `--quick` → **Quick Mode**: Check Tier 1 (living/web-only) sources + discovery search. Fastest, covers highest-drift topics.
- `--full` → **Full Mode**: Check all three tiers + template consistency + discovery search. Comprehensive but slower.
- `--topic <name>` → **Topic Mode**: Check only sources matching the given topic (e.g., `--topic hooks`, `--topic skills`, `--topic agents`). Works across all tiers.

**Optional flags (combinable with any mode):**
- `--save` → Persist the report to `.claude/skills/docs-check/reports/YYYY-MM-DD.md` and update verified dates in the source registry.
- `--diff` → Compare against the most recent saved report (requires a prior `--save` run).

Default to **Quick Mode** if no arguments are provided.

---

## Step 1: Run Inventory Script

Execute the inventory script to catalog the current state of local reference documents:

```
python .claude/skills/docs-check/scripts/inventory_docs.py
```

This outputs JSON with:
- Master guide path, generation date, and size
- Each reference doc's filename, modification date, detected publication date, topics, and line count
- PDF originals with sizes
- Summary statistics (total counts, date range)

Parse and store the JSON result. You will cross-reference it in later steps.

---

## Step 2: Load Source Registry & Previous Report

Read the source registry:

```
.claude/skills/docs-check/templates/source-registry.json
```

This contains all known upstream sources organized into three tiers:

| Tier | Contents | Check Frequency |
|------|----------|-----------------|
| **Tier 1 — Living** | Web-only docs (hooks, agent teams, skills, prompting, best practices, Agent SDK) | Monthly |
| **Tier 2 — Stable** | Downloadable PDFs (skills guide, case studies, trends report, modernization playbook) | Quarterly |
| **Tier 3 — Foundational** | Core references (constitution, system card, enterprise guides) | Semi-annually |

**In Quick Mode**: Only process Tier 1 sources.
**In Full Mode**: Process all three tiers.
**In Topic Mode**: Filter all tiers to sources whose `topics` array includes the requested topic.

**Load snapshot baselines**: Check `.claude/skills/docs-check/baselines/` for existing baseline files. These are lightweight summaries of web-only sources captured during previous `--save` runs. They serve as the "local ref" for sources that have no local copy in `claude-code/refs/`.

**If `--diff` flag is set**: Check `.claude/skills/docs-check/reports/` for the most recent saved report. Read it and use as the baseline for identifying what changed since last audit.

---

## Step 3: Check Living Web Sources (Tier 1) with Content Diff

For each Tier 1 source in scope, perform a content-level comparison.

**IMPORTANT: Issue multiple WebFetch calls in parallel where possible.** Group sources into batches of 3-4 concurrent fetches to minimize total check time.

### 3a. Read the Local Reference or Baseline

If the source has a `local_ref` value (not null), read that file from `claude-code/refs/`. Extract key structural elements:
- Section headings (## and ### level)
- Feature lists and tables (especially event names, field names, configuration keys)
- Code examples and configuration patterns

If `local_ref` is null, check for a **snapshot baseline** at `.claude/skills/docs-check/baselines/<source.id>.md`. If a baseline exists, use it as the comparison target. If no baseline exists either, this source can only be checked for existence and compared against `diff_anchors`.

### 3b. Fetch the Upstream Page

Use **WebFetch** for each source URL:

```
WebFetch url=<source.url> prompt="Extract the following from this documentation page:
1. All section headings (H2 and H3 level)
2. Any feature lists, event names, or configuration fields mentioned
3. Any 'last updated' or version indicators
4. Any new sections or features not present in this list of known sections: <source.diff_anchors>
5. Any deprecation notices or breaking changes
Return a structured summary."
```

### 3c. Compare and Identify Differences

For each source, compare the upstream content against local:
- **New sections/headings** not present in local ref → flag as "NEW CONTENT"
- **Changed feature lists** (e.g., new hook events, new subagent fields, new settings) → flag as "UPDATED"
- **Removed/deprecated content** → flag as "DEPRECATED"
- **No meaningful changes detected** → mark as "CURRENT"
- **No local ref AND no baseline** → mark as "NO BASELINE" (first run — everything is new)

If the source has `alt_urls`, check those too for additional context.

Record a structured diff summary for each source:
```
{
  "source_id": "hooks-reference",
  "status": "UPDATED",  // CURRENT | UPDATED | NEW_CONTENT | STALE | UNREACHABLE
  "changes": [
    "New hook event: ExampleEvent added",
    "Updated: PreToolUse now supports new matcher syntax"
  ],
  "upstream_date": "2026-02-15",  // if detectable
  "local_date": "2026-02-13"
}
```

---

## Step 4: Check Stable PDF Sources (Tier 2) — Full Mode Only

Skip this step in Quick Mode and Topic Mode (unless the topic matches a Tier 2 source).

For each Tier 2 source:

### 4a. Check URL Availability

Use **WebFetch** to check if the PDF landing page or direct URL still resolves:

```
WebFetch url=<source.url> prompt="Does this PDF still exist? Extract any version number, publication date, or update indicators. If this is a landing page, look for download links and their dates."
```

### 4b. Compare Dates

Compare the upstream publication date against `last_known_date` in the registry:
- If upstream date is newer → flag as "NEWER VERSION AVAILABLE"
- If dates match → mark as "CURRENT"
- If URL is broken → flag as "URL BROKEN"

---

## Step 5: Check for New Content (All Modes)

Search for recently published Anthropic content not yet in the registry.

### 5a. Run Discovery Searches

Use **WebSearch** for each query in the registry's `discovery_searches.queries` array. **Replace `2026` in each query with the current year** (e.g., 2026).

```
WebSearch query="<query with 2026 replaced>"
```

**In Quick Mode**: Use the first 3 queries only.
**In Full Mode**: Use all queries.

### 5b. Filter and Classify Results

For each search result:
1. Check if the URL is already in the source registry → skip if known
2. Assess relevance to Claude Code reference material
3. If relevant and new, add to the "New Content Discovered" section of the report

### 5c. Check the Anthropic Engineering Blog

Use **WebSearch** to find recent engineering blog posts:

```
WebSearch query="site:anthropic.com/engineering 2026"
```

(Replace `2026` with the current year.)

Compare results against known blog-sourced entries in the registry (building-effective-agents-blog, claude-code-best-practices, writing-effective-tools). Flag any new posts relevant to Claude Code.

---

## Step 6: Analyze Master Guide Staleness

Using the inventory data from Step 1 and the diff results from Steps 3-5:

### 6a. Date Gap Analysis

Compare the master guide's `generated_date` against:
- The newest upstream change found in Steps 3-4
- Today's date (how old is the guide?)

If the guide is more than 30 days older than the newest upstream change, flag it for regeneration.

### 6b. Source Index Completeness

Search the master guide for the section heading `## Appendix F: Source Material Index` and read that section. Check if any new sources discovered in Step 5 should be added to this index.

### 6c. Documentation Currency Table

Search the master guide for the section heading `### Documentation Currency` and read that section. Verify the "Living (Web Only)" vs "Stable (PDF/Guide)" classifications still match reality based on what was found in Steps 3-4.

---

## Step 7: Check Template Consistency — Full Mode Only

Skip this step in Quick Mode.

### 7a. Hook Event Consistency

Read the hook templates in `.claude/skills/bootstrap/templates/hooks/` and compare hook event names against the current list found in Step 3 (hooks-reference source).

Flag any:
- Hook events referenced in templates that no longer exist upstream
- New hook events upstream that could enhance existing templates

### 7b. Settings Pattern Consistency

Read the settings templates in `.claude/skills/bootstrap/templates/settings/` and check:
- Are permission patterns (`Bash(...)`, tool names) still valid?
- Are there new tools or permission modes not reflected in templates?

### 7c. CLAUDE.md Template Consistency

Read `.claude/skills/bootstrap/templates/claude-md/base.md` and check:
- Are guardrail patterns still aligned with current best practices?
- Are any new recommended sections missing?

---

## Step 8: Generate Freshness Report

Compile all findings into a structured report. Output this directly in the conversation.

Use this exact format:

```markdown
## Documentation Freshness Report — YYYY-MM-DD

**Mode:** Quick | Full | Topic (topic-name)
**Master Guide Generated:** YYYY-MM-DD (N days ago)
**Sources Checked:** X of Y total
**Previous Report:** YYYY-MM-DD (or "None — first run")
**Baselines Available:** N of M web-only sources

---

### Summary

| Status | Count |
|--------|-------|
| Current | N |
| Updated (changes found) | N |
| New content available | N |
| Stale (needs refresh) | N |
| No baseline (first check) | N |
| Unreachable | N |

---

### Needs Attention (Priority Order)

| # | Source | Local Date | Status | What Changed |
|---|--------|-----------|--------|-------------|
| 1 | Source Name | YYYY-MM-DD | UPDATED | Brief description of changes |
| 2 | ... | ... | ... | ... |

---

### New Content Discovered

| Source | URL | Relevance |
|--------|-----|-----------|
| Title | URL | Why it matters for our reference material |

---

### Up to Date

| Source | Last Verified | Tier |
|--------|-------------|------|
| Source Name | YYYY-MM-DD | 1 |

---

### Recommendations

1. **[HIGH]** Specific action item with source reference
2. **[MEDIUM]** ...
3. **[LOW]** ...

### Master Guide Status

- **Generated:** YYYY-MM-DD
- **Days since generation:** N
- **Appendix F completeness:** X/Y sources indexed
- **Regeneration recommended:** Yes/No (reason)
```

---

## Step 9: Update Registry & Save Report (if --save flag)

Skip this step unless the user passed `--save`.

### 9a. Update Verified Dates

For every source confirmed as **CURRENT** in Step 3/4, update the `last_known_date` field in `.claude/skills/docs-check/templates/source-registry.json` to today's date (YYYY-MM-DD).

Also update the top-level `last_updated` field to today's date.

### 9b. Add Newly Discovered Sources

For each relevant new source found in Step 5, propose and add a new entry to the appropriate tier in the source registry. Use this format:

```json
{
  "id": "<kebab-case-id>",
  "name": "<Human-readable name>",
  "url": "<upstream URL>",
  "local_ref": null,
  "topics": ["<topic1>", "<topic2>"],
  "last_known_date": "<today YYYY-MM-DD>",
  "appendix_f_num": null,
  "diff_anchors": ["<key section 1>", "<key section 2>"]
}
```

### 9c. Save Snapshot Baselines for Web-Only Sources

For each Tier 1 source where `local_ref` is null, write a lightweight baseline file to:

```
.claude/skills/docs-check/baselines/<source.id>.md
```

Create the `baselines/` directory if it doesn't exist. Each baseline file should contain:

```markdown
# Baseline: <source.name>
<!-- Source: <source.url> -->
<!-- Captured: YYYY-MM-DD -->

## Sections Found
- <list of H2/H3 headings found in Step 3b>

## Key Features/Fields
- <list of feature names, commands, events, config keys found>

## Version
<Claude Code version if detected, else "Not detected">
```

These baselines provide a diffable local reference for future runs, solving the "nothing to compare against" problem for web-only sources.

### 9d. Persist the Report

Write the full report (from Step 8) to:

```
.claude/skills/docs-check/reports/YYYY-MM-DD.md
```

Create the `reports/` directory if it doesn't exist. This enables future `--diff` runs to compare against this baseline.

---

## Notes

- This skill is **read-only by default** — it never modifies files in `claude-code/refs/` or anywhere else
- The `--save` flag is the only mode that writes: it updates the source registry dates, saves snapshot baselines for web-only sources, and persists a report to the `reports/` directory
- The source registry can also be updated manually by editing `.claude/skills/docs-check/templates/source-registry.json`
- If a WebFetch call fails or times out, mark that source as "UNREACHABLE" and continue with the next source
- Prioritize the report by actionability: things that need immediate attention first, informational items last
- Discovery search queries use `2026` as a placeholder — always substitute with the current year at runtime
