import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, type PDFImage, type PDFPage } from 'pdf-lib';

// Fill the official MOM "Bio-Data of FDW" form by overlaying the employee's
// admin-entered data onto the (flat, non-fillable) blank PDF. Coordinates are
// in PDF user space (bottom-left origin), measured from the blank form with
// pdfjs — fields sit just past their printed labels. The agency fills the
// "overseas training centre / EA" half (page 3), matching the hand-filled PDFs.
const BLANK_FORM_PATH = path.resolve(process.cwd(), 'assets', 'bio-data', 'blank-bio-data.pdf');
const AGENCY_NAME = 'Find Care Helper';

type Loc = { en?: string; my?: string };
type Field = { label?: Loc; value?: Loc };
type Skill = {
  area?: Loc;
  areaNote?: Loc;
  willingness?: Loc;
  experience?: Loc;
  experienceDetail?: Loc;
  assessment?: Loc;
  proficiency?: 1 | 2 | 3 | 4 | 5 | 'na';
};
type Language = { name?: Loc; listening?: Loc; speaking?: Loc };
type PastExp = { role?: Loc; date?: Loc; numYears?: Loc; country?: Loc; family?: Loc; duties?: Loc };

export type BioDataEmployee = {
  name?: string;
  personal?: Field[];
  availability?: Field[];
  caretakerSkills?: Skill[];
  householdSkills?: Skill[];
  languages?: Language[];
  pastExperiences?: PastExp[];
  // Which interview modes the FDW is reachable for — drives section (D) on
  // page 4. Absent on legacy records, where it defaults to phone + video.
  interviewAvailability?: InterviewMode[];
  [k: string]: unknown;
};

type InterviewMode = 'not-available' | 'phone' | 'video' | 'in-person';

// ---- value lookups ----------------------------------------------------------
function personalValue(emp: BioDataEmployee, keyword: string): string {
  const kw = keyword.toLowerCase();
  const row = (emp.personal ?? []).find((r) => (r?.label?.en ?? '').toLowerCase().includes(kw));
  return (row?.value?.en ?? '').trim();
}
function availabilityValue(emp: BioDataEmployee, keyword: string): string {
  const kw = keyword.toLowerCase();
  const row = (emp.availability ?? []).find((r) => (r?.label?.en ?? '').toLowerCase().includes(kw));
  return (row?.value?.en ?? '').trim();
}
function findSkill(skills: Skill[] | undefined, ...keywords: string[]): Skill | undefined {
  return (skills ?? []).find((s) => {
    const a = (s?.area?.en ?? '').toLowerCase();
    return keywords.some((k) => a.includes(k));
  });
}
function numberOnly(s: string): string {
  const m = /[\d.]+/.exec(s);
  return m ? m[0] : '';
}
// "Kids back home" may carry each child's age inline as "<count> (ages: a, b)"
// (written by the admin's KidsBackHomeField). Split the count from the joined
// ages so they land on the form's "13. Number of children" and "Age(s) of
// children" lines respectively. A value without the suffix (incl. the legacy
// "1 (age 10)" free-text form) parses to no ages and is left on line 13 as-is.
function parseKids(en: string): { count: string; ages: string } {
  const m = /^(.*?)\s*\(ages:\s*([^)]*)\)\s*$/i.exec(en ?? '');
  if (m) {
    const ages = m[2].split(',').map((a) => a.trim()).filter(Boolean).join(', ');
    return { count: m[1].trim(), ages };
  }
  return { count: (en ?? '').trim(), ages: '' };
}
function isNone(s: string): boolean {
  const t = s.toLowerCase();
  return !t || t.includes('none') || t.includes('n.a') || t.includes('not specified');
}
// "Yes"/"No"/"" from a localized willingness/experience value.
function yesNo(loc?: Loc): string {
  const v = (loc?.en ?? '').toLowerCase();
  if (v.includes('yes')) return 'Yes';
  if (!v || v.includes('none') || v === 'no' || v.includes('n.a')) return 'No';
  return 'Yes';
}
// Item 18 "Food handling preferences": the admin stores "Willing to handle
// pork/beef" as checkboxes inside the "Open to work:" Cooking group, serialised
// into that row's EN value ("... | Cooking: Willing to handle pork, Chinese | ...").
// When a meat isn't in the willing list the helper won't handle it, so the form's
// "No pork" / "No beef" box gets ticked. Mirrors the admin's parseOpenToChecked:
// a grouped value matches the exact label; a legacy free-text value falls back to
// a keyword substring (so the PDF always agrees with what the admin displays).
function willingToHandle(openTo: string, label: string, keyword: string): boolean {
  const grouped = /\b(?:Caretaker|Cooking|Housework):/.test(openTo);
  return grouped ? openTo.includes(label) : openTo.toLowerCase().includes(keyword);
}
// Strip a "Cuisines: " / "Age range: " style prefix off an areaNote.
function noteValue(loc?: Loc): string {
  const v = (loc?.en ?? '').trim();
  const i = v.indexOf(':');
  return i >= 0 ? v.slice(i + 1).trim() : v;
}
// Admin rates each skill 1–5 (or N.A.) for proficiency. The MOM form has no
// rating scale we can reliably tick, so we lead the Assessment/Observation cell
// with it as text: "Proficiency 3, <observation>". Empty when the skill is
// unrated (proficiency not set in the admin).
function proficiencyPrefix(p?: 1 | 2 | 3 | 4 | 5 | 'na'): string {
  if (p === undefined) return '';
  if (p === 'na') return 'Proficiency N.A.';
  return `Proficiency ${p}`;
}

// ---- coordinate maps --------------------------------------------------------
const PHOTO_BOX = { x: 388, y: 490, w: 180, h: 158 } as const;

// Page-1 illness Yes/No grid: keyword in "Past & existing illnesses", row y,
// and which half holds the checkbox columns.
const ILLNESS_ROWS: { keyword: string; y: number; col: 'L' | 'R' }[] = [
  { keyword: 'mental illness', y: 211, col: 'L' },
  { keyword: 'epilepsy', y: 198.8, col: 'L' },
  { keyword: 'asthma', y: 186.7, col: 'L' },
  { keyword: 'diabetes', y: 174.4, col: 'L' },
  { keyword: 'hypertension', y: 162.2, col: 'L' },
  { keyword: 'tuberculosis', y: 211, col: 'R' },
  { keyword: 'heart disease', y: 198.8, col: 'R' },
  { keyword: 'malaria', y: 186.7, col: 'R' },
  { keyword: 'operations', y: 174.4, col: 'R' },
];
const ILLNESS_X = { L: { yes: 192.5, no: 264.5 }, R: { yes: 445.2, no: 517.2 } } as const;

// Page-1 item 18 food-handling checkbox tick positions (X baseline). Centers the
// X inside the printed ☐ glyphs: "No pork" box spans x 164.4–173.3, "No beef"
// box x 284.3–293.1, both bl-y 90.1–100.1.
const FOOD_HANDLING_X = { pork: { x: 165.5, y: 91.5 }, beef: { x: 285.4, y: 91.5 } } as const;

// Page-3 skills table column x's and the assessment-column wrap width.
const SKILL_COL = { willing: 216, exp: 276, assess: 331, assessW: 246 } as const;

// Page-4 section (D) interview-availability checkbox tick positions (X baseline
// at each box's bottom edge; x just inside the box). Boxes top→bottom.
const INTERVIEW_BOX: Record<InterviewMode, { x: number; y: number }> = {
  'not-available': { x: 37, y: 474.1 },
  phone: { x: 37, y: 462.0 },
  video: { x: 37, y: 449.8 },
  'in-person': { x: 37, y: 437.5 },
};
// Legacy records have no stored value — an overseas helper is reachable by
// phone or video, so tick both (the form's long-standing default).
const DEFAULT_INTERVIEW_AVAILABILITY: InterviewMode[] = ['phone', 'video'];

export async function generateBioDataPdf(emp: BioDataEmployee, photo?: Buffer): Promise<Buffer> {
  const blankBytes = await fs.readFile(BLANK_FORM_PATH);
  const pdf = await PDFDocument.load(blankBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const [p1, p2, p3, p4] = pages;

  // Every non-comb-box field is drawn +1pt over its base size; centralised here
  // so put / tick / wrap stay in step. The comb fields (date of birth / age /
  // height / weight) go through putBoxed with their own size, so they're left as-is.
  const FIELD_BUMP = 1;
  const put = (page: PDFPage, text: string, x: number, y: number, size = 9) => {
    const t = (text ?? '').trim();
    if (t) page.drawText(t, { x, y, size: size + FIELD_BUMP, font });
  };
  const tick = (page: PDFPage, x: number, y: number) => put(page, 'X', x, y, 9);
  // Comb fields (age / height / weight): the form prints one box per digit, so
  // center each digit on its own box rather than drawing the whole number at a
  // single x (which crams every digit into the first box). `firstCenter`/`pitch`
  // are the box centers measured off the blank form; surplus digits keep
  // advancing by the same pitch.
  const putBoxed = (
    page: PDFPage,
    value: string,
    firstCenter: number,
    pitch: number,
    y: number,
    size = 11,
  ) => {
    const digits = (value ?? '').replace(/\D/g, '');
    const half = font.widthOfTextAtSize('0', size) / 2;
    for (let k = 0; k < digits.length; k++) {
      page.drawText(digits[k], { x: firstCenter + k * pitch - half, y, size, font });
    }
  };
  // Break text into the lines that each fit within width w at the given size.
  const wrapLines = (text: string, w: number, size: number): string[] => {
    const t = (text ?? '').trim();
    if (!t) return [];
    const words = t.split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, size + FIELD_BUMP) <= w) cur = test;
      else {
        if (cur) lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  // Word-wrapped block drawn downward from baseline y.
  const wrap = (page: PDFPage, text: string, x: number, y: number, w: number, size = 8, maxLines = 4) => {
    wrapLines(text, w, size)
      .slice(0, maxLines)
      .forEach((line, i) => put(page, line, x, y - i * (size + FIELD_BUMP + 1.5), size));
  };

  // ===== PAGE 1 — A1 Personal + A2 Medical =====
  put(p1, emp.name ?? '', 77, 653.8);
  // Date of birth is stored ISO (YYYY-MM-DD); the form prints it as DD MM YY
  // across three 2-box groups (day / month / 2-digit year).
  const dob = /^(\d{4})-(\d{2})-(\d{2})/.exec(personalValue(emp, 'birth'));
  if (dob) {
    putBoxed(p1, dob[3], 112.1, 18.6, 629.4);
    putBoxed(p1, dob[2], 155.2, 18.2, 629.4);
    putBoxed(p1, dob[1].slice(2), 197.4, 18.4, 629.4);
  }
  putBoxed(p1, personalValue(emp, 'age'), 283.2, 18.2, 629.4);
  putBoxed(p1, personalValue(emp, 'height'), 124.7, 18.6, 580.8);
  putBoxed(p1, personalValue(emp, 'weight'), 233.7, 19.1, 580.8);
  put(p1, personalValue(emp, 'religion'), 85, 434.9);
  put(p1, personalValue(emp, 'education'), 120, 410.6);
  put(p1, personalValue(emp, 'sibling'), 134, 386.3);
  put(p1, personalValue(emp, 'marital'), 114, 362.0);
  const { count: kidsCount, ages: kidsAges } = parseKids(personalValue(emp, 'kids'));
  put(p1, isNone(kidsCount) ? '' : kidsCount, 137, 337.7);
  // "- Age(s) of children (if any):" sub-line, just below line 13. x/y measured
  // off the blank form (the answer sits a fixed offset before the label+rule's
  // end, matching the count/allergies lines); empty ages draw nothing.
  put(p1, kidsAges, 158, 313.4);
  put(p1, personalValue(emp, 'allergies'), 123, 260.8);
  put(p1, personalValue(emp, 'physical disab'), 135, 138.8);
  put(p1, personalValue(emp, 'dietary'), 135, 114.5);
  // 18. Food handling preferences — tick "No pork" / "No beef" when the helper is
  // not willing to handle that meat (admin Cooking checkbox unchecked).
  const openTo = availabilityValue(emp, 'open to');
  if (!willingToHandle(openTo, 'Willing to handle pork', 'pork'))
    tick(p1, FOOD_HANDLING_X.pork.x, FOOD_HANDLING_X.pork.y);
  if (!willingToHandle(openTo, 'Willing to handle beef', 'beef'))
    tick(p1, FOOD_HANDLING_X.beef.x, FOOD_HANDLING_X.beef.y);
  const illnesses = personalValue(emp, 'illnesses').toLowerCase();
  const healthy = isNone(illnesses);
  for (const row of ILLNESS_ROWS) {
    const has = !healthy && illnesses.includes(row.keyword);
    tick(p1, has ? ILLNESS_X[row.col].yes : ILLNESS_X[row.col].no, row.y);
  }

  // ===== PAGE 2 — A3 Others =====
  if (p2) {
    const restDay = numberOnly(availabilityValue(emp, 'days off'));
    put(p2, restDay, 152, 718.2);
    // 20. Any other remarks — free text on the line below the rest-day row.
    put(p2, personalValue(emp, 'remark'), 135, 693.8);
  }

  // ===== PAGE 3 — overseas-training-centre skills table + employment history =====
  if (p3) {
    // Method: this agency is the overseas training centre.
    tick(p3, 44, 746.5);
    put(p3, AGENCY_NAME, 446, 746.5, 9);
    tick(p3, 58, 709.9); // via videoconference
    tick(p3, 58, 697.7); // in person

    const drawSkillRow = (s: Skill | undefined, y: number) => {
      if (!s) return;
      const will = yesNo(s.willingness);
      put(p3, will, SKILL_COL.willing, y);
      const exp = yesNo(s.experience);
      const yrs = (s.experienceDetail?.en ?? '').trim();
      put(p3, exp, SKILL_COL.exp, y, 8);
      // Years (when given) go on their own line below the Yes/No.
      if (exp === 'Yes' && yrs) put(p3, yrs, SKILL_COL.exp, y - 10.5, 8);
      // Willing but no experience, with no observation written → default note.
      const observation =
        (s.assessment?.en ?? '').trim() ||
        (will === 'Yes' && exp === 'No' ? 'No Prior experience but willing and eager to learn.' : '');
      // Lead with the admin's 1–5 (or N.A.) proficiency rating, e.g.
      // "Proficiency 3, <observation>". Falls back to just the rating when there's
      // no observation, and to just the observation when unrated.
      const prefix = proficiencyPrefix(s.proficiency);
      const assessment = prefix
        ? observation
          ? `${prefix}, ${observation}`
          : prefix
        : observation;
      // Drop the first line a little below the cell's top border (was y + 2,
      // which left the text touching it).
      wrap(p3, assessment, SKILL_COL.assess, y - 4, SKILL_COL.assessW, 8, 4);
    };

    const infants = findSkill(emp.caretakerSkills, 'infant', 'child');
    drawSkillRow(infants, 599.0);
    put(p3, noteValue(infants?.areaNote), 178, 574.7, 8); // age range
    drawSkillRow(findSkill(emp.caretakerSkills, 'elder'), 549.1);
    drawSkillRow(findSkill(emp.caretakerSkills, 'disab'), 499.8);
    drawSkillRow(findSkill(emp.householdSkills, 'housekeep', 'clean'), 454.3);
    const cooking = findSkill(emp.householdSkills, 'cook');
    drawSkillRow(cooking, 405.0);
    put(p3, noteValue(cooking?.areaNote), 170, 380.5, 8); // cuisines

    // Languages row (willingness column is X-ed out on the form).
    const langs = emp.languages ?? [];
    if (langs.length) {
      const names = langs.map((l) => (l?.name?.en ?? '').trim()).filter(Boolean);
      put(p3, names.join(', '), 135, 331.2, 8); // specify
      put(p3, 'Yes', SKILL_COL.exp, 355.7, 8);
      const summary = langs
        .map((l) => {
          const lvl = (l?.speaking?.en ?? '').trim();
          return `${(l?.name?.en ?? '').trim()}${lvl && lvl !== '—' ? ` (${lvl})` : ''}`;
        })
        .filter(Boolean)
        .join(', ');
      // Baseline dropped below the cell's top border (was 357.7, touching it),
      // matching the drawSkillRow assessment offset.
      wrap(p3, `Spoken: ${summary}`, SKILL_COL.assess, 351.7, SKILL_COL.assessW, 8, 3);
    }

    // C1 Employment History Overseas — first entries (table is short).
    const exps = emp.pastExperiences ?? [];
    // Measured printed top/bottom borders of the two C1 data-row cells. Each row
    // is anchored to a top writing line just below its top ruling so the data
    // reads as a block starting at the top-left of every cell.
    const rowCells = [
      { top: 148.4, bot: 111.4 },
      { top: 111.4, bot: 74.2 },
    ];
    exps.slice(0, rowCells.length).forEach((e, i) => {
      const cell = rowCells[i];
      const topLine = cell.top - 9; // first baseline, clear of the top ruling
      const dateStr = (e?.date?.en ?? '').trim();
      const [from, to] = dateStr.split(/\s*[-–to]+\s*/i);
      put(p3, (from ?? '').trim(), 40, topLine, 8);
      put(p3, (to ?? '').trim(), 92, topLine, 8);
      put(p3, e?.country?.en ?? '', 150, topLine, 8);
      // Employer column holds the employer family's ethnicity (e.g. "Chinese").
      put(p3, e?.family?.en ?? '', 221, topLine, 8);
      // Work Duties is the only multi-line cell: it starts at the top-left and
      // wraps straight down, leaving the lower part of the (tall) cell free for a
      // 2–3 sentence answer. Capped at 3 lines — the ~37pt cell holds no more
      // before the wrapped block would cross the bottom ruling.
      const dutySize = 7;
      const dutyLineH = dutySize + FIELD_BUMP + 1.5;
      const dutyLines = wrapLines(e?.duties?.en ?? '', 150, dutySize).slice(0, 3);
      dutyLines.forEach((line, k) => put(p3, line, 300, topLine - k * dutyLineH, dutySize));
    });
  }

  // ===== PAGE 4 — C2 Singapore history + D availability for interview =====
  if (p4) {
    const inSingapore = (emp.pastExperiences ?? []).some((e) =>
      (e?.country?.en ?? '').toLowerCase().includes('singapore'),
    );
    tick(p4, inSingapore ? 325 : 433, 722.2); // C2 Yes / No
    // Section D — tick the interview modes the admin selected. A record with no
    // stored value (legacy) falls back to phone + video; an empty array means the
    // admin deliberately cleared every option, so nothing is ticked.
    const interviewModes = Array.isArray(emp.interviewAvailability)
      ? emp.interviewAvailability
      : DEFAULT_INTERVIEW_AVAILABILITY;
    for (const mode of interviewModes) {
      const box = INTERVIEW_BOX[mode];
      if (box) tick(p4, box.x, box.y);
    }
  }

  // ===== Photo box (page 1) =====
  if (photo && photo.length) {
    try {
      let img: PDFImage | null = null;
      if (photo[0] === 0x89 && photo[1] === 0x50) img = await pdf.embedPng(photo);
      else if (photo[0] === 0xff && photo[1] === 0xd8) img = await pdf.embedJpg(photo);
      if (img) {
        const scale = Math.min(PHOTO_BOX.w / img.width, PHOTO_BOX.h / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        p1.drawImage(img, {
          x: PHOTO_BOX.x + (PHOTO_BOX.w - w) / 2,
          y: PHOTO_BOX.y + (PHOTO_BOX.h - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch {
      // Unembeddable image (e.g. WebP) — skip it; the rest of the form is fine.
    }
  }

  const out = await pdf.save();
  return Buffer.from(out);
}
