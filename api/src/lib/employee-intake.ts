// Maps a Google Form ("အလုပ်သမားမေးခွန်းလွှာ / Worker Questionnaire") submission
// into a draft `CurrentEmployee` whose shape is IDENTICAL to what the admin
// "New employee" form (/admin/employees/new) produces — the same canonical
// personal / availability / caretaker-skills / household-skills / language
// sections, in the same order — with the survey answers filled into the matching
// rows and /new's defaults everywhere else. This keeps intake-created profiles and
// hand-created ones on a single format.
//
// The canonical labels + defaults below MIRROR `NEW_EMPLOYEE_DEFAULTS` and the
// `CANONICAL_*` constants in admin/src/pages/EmployeeEditor.tsx — keep them in
// sync. The form is bilingual ("<Burmese> / <English>"), so `splitBilingual`
// recovers the {en, my} pair without a translation API. Keep this module pure
// (no Fastify/PG/Date) so it stays unit-testable; the route layer adds the runtime
// bits (slug, photo, id-docs, timestamps).

export type Loc = { en: string; my: string };
type Field = { label: Loc; value: Loc; fullWidth?: boolean; divider?: boolean };
type Language = {
  name: Loc;
  listening?: Loc;
  speaking?: Loc;
  reading?: Loc;
  writing?: Loc;
};
type AreaOfWork = {
  area: Loc;
  areaNote?: Loc;
  willingness?: Loc;
  experience?: Loc;
  experienceDetail?: Loc;
  assessment?: Loc;
  proficiency?: 1 | 2 | 3 | 4 | 5 | 'na';
};
type PastExp = {
  role: Loc;
  date: Loc;
  numYears: Loc;
  country: Loc;
  family?: Loc;
  duties: Loc;
};

// Non-public contact / screening answers. Lives in a single `intake` block on the
// record (stripped from the public payload by redactEmployee) so the reviewer can
// contact/verify the applicant without any of it leaking to the storefront.
export type IntakeMeta = {
  nickName?: string;
  gender?: string;
  pregnant?: string;
  tattoos?: string;
  whatsapp?: string;
  visaExpiry?: string;
  // Passport expiry date (ISO yyyy-mm-dd) from the survey; admin can correct it.
  passportExpiry?: string;
  certifications?: string;
  experienceLevel?: string;
  residingCountry?: string;
  // Is the applicant staying with us in Bangkok? Seeded from the survey, admin can
  // adjust during review. 'yes' | 'no' | '' (unset).
  stayingInBangkok?: string;
  // Added by the route, not the mapper:
  email?: string;
  responseId?: string;
  submittedAt?: string;
  photoNote?: string;
  // Private-bucket object keys for the sensitive ID-document scans (passport
  // page / visa stamp / entry stamp). Stored in the gated `product-files` bucket
  // and served only through the admin-gated id-doc route — never public.
  passportImage?: string;
  visaStampImage?: string;
  entryStampImage?: string;
};

export type MappedIntakeProfile = {
  name: string;
  role: Loc;
  personal: Field[];
  availability: Field[];
  languages: Language[];
  caretakerSkills: AreaOfWork[];
  householdSkills: AreaOfWork[];
  pastExperiences: PastExp[];
  intake: IntakeMeta;
};

// Apps Script `getResponse()` returns a string for text/choice/date items and a
// string[] for checkbox items.
export type IntakeAnswers = Record<string, string | string[]>;

// ---- intake file uploads (photo + ID-document scans) ------------------------
// Normalises whatever the Apps Script posts into the four image slots. The script
// keyword-classifies each upload and posts the matching photoBase64 / passportBase64
// / visaStampBase64 / entryStampBase64 field; this layer ALSO accepts a generic
// `uploads: [{title, base64}]` array (classified here, by title) so the script can
// be a dumb forwarder in future without an API change. Either way the classifier
// is keyword-based — the old Apps Script used exact-substring matches with no
// fallback for the ID scans, so any wording drift silently dropped passport/visa/
// entry while the headshot (which had a catch-all fallback) still landed.

export type IntakeUpload = { title?: string; base64?: string };
export type IntakeUploadKind = 'photo' | 'passport' | 'visa-stamp' | 'entry-stamp';

// Map a file-upload question title onto the slot its image belongs in. Keyword-
// based and order-sensitive: the visa/entry questions also say "...in your
// passport" / "...from your passport", so match `visa`/`entry` BEFORE `passport`
// so they aren't misfiled. An unrecognised title returns null (the caller treats
// it as the headshot when no headshot has been picked yet).
export function classifyIntakeUpload(title: string): IntakeUploadKind | null {
  const t = (title ?? '').toLowerCase();
  if (t.includes('visa')) return 'visa-stamp';
  if (t.includes('entry')) return 'entry-stamp';
  if (t.includes('passport')) return 'passport';
  if (/profile|picture|photo|headshot|portrait|selfie|\bface\b/.test(t)) return 'photo';
  return null;
}

export type ResolvedIntakeImages = {
  photoBase64?: string;
  passportBase64?: string;
  visaStampBase64?: string;
  entryStampBase64?: string;
};

// Normalise the intake webhook body into the four canonical image slots. Prefers
// the generic `uploads` array (classified by title above); an unrecognised upload
// becomes the headshot when one hasn't been chosen yet, mirroring the old Apps
// Script fallback so a headshot is never dropped. Falls back to the legacy
// explicit *Base64 fields for any slot the array didn't fill, so an un-updated
// Apps Script that still posts the classified fields keeps working unchanged.
export function resolveIntakeImages(body: {
  uploads?: unknown;
  photoBase64?: unknown;
  passportBase64?: unknown;
  visaStampBase64?: unknown;
  entryStampBase64?: unknown;
}): ResolvedIntakeImages {
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const out: ResolvedIntakeImages = {};
  if (Array.isArray(body.uploads)) {
    for (const up of body.uploads as IntakeUpload[]) {
      const b64 = str(up?.base64);
      if (!b64) continue;
      const kind = classifyIntakeUpload(up?.title ?? '');
      if (kind === 'passport') out.passportBase64 ??= b64;
      else if (kind === 'visa-stamp') out.visaStampBase64 ??= b64;
      else if (kind === 'entry-stamp') out.entryStampBase64 ??= b64;
      else out.photoBase64 ??= b64; // 'photo' or unrecognised → headshot
    }
  }
  out.photoBase64 ??= str(body.photoBase64);
  out.passportBase64 ??= str(body.passportBase64);
  out.visaStampBase64 ??= str(body.visaStampBase64);
  out.entryStampBase64 ??= str(body.entryStampBase64);
  return out;
}

// ---- value helpers ----------------------------------------------------------

// The English half of a question title (titles are "<Burmese> / <English>";
// some, like "Do you have visible tattoos?", are English-only). Used only for
// keyword-matching question keys, never for splitting answers.
function englishHalf(title: string): string {
  const i = title.indexOf(' / ');
  return i >= 0 ? title.slice(i + 3) : title;
}

function findRaw(answers: IntakeAnswers, keywords: string[]): string | string[] | undefined {
  for (const [key, value] of Object.entries(answers)) {
    const hay = englishHalf(key).toLowerCase();
    if (keywords.some((kw) => hay.includes(kw))) return value;
  }
  return undefined;
}

function findStr(answers: IntakeAnswers, ...keywords: string[]): string {
  const v = findRaw(answers, keywords);
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join(', ');
  return typeof v === 'string' ? v.trim() : '';
}

function findArr(answers: IntakeAnswers, ...keywords: string[]): string[] {
  const v = findRaw(answers, keywords);
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return typeof v === 'string' && v.trim() ? [v.trim()] : [];
}

// Recover {en, my} from a bilingual choice option "<Burmese> / <English>". The
// separator is the FIRST " / " (spaces both sides); a Burmese half's own slashes
// are written without spaces ("အကူ/စောင့်"), and an English half may legitimately
// contain " / " ("helper / care taker"), so split on the first occurrence only and
// keep the remainder as English. A string with no separator (free text / "Other")
// is treated as EN-only.
export function splitBilingual(s: string): Loc {
  const t = (s ?? '').trim();
  const i = t.indexOf(' / ');
  if (i < 0) return { en: t, my: '' };
  return { my: t.slice(0, i).trim(), en: t.slice(i + 3).trim() };
}

const BURMESE_DIGITS = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
function toBurmeseDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BURMESE_DIGITS[Number(d)]);
}

// Coerce a date answer to ISO YYYY-MM-DD (the form sends "yyyy-MM-dd" already, but
// be defensive about locale-formatted values). Empty/unparseable → "".
function toIsoDate(s: string): string {
  const t = (s ?? '').trim();
  if (!t) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

const BLANK: Loc = { en: '', my: '' };
const NONE_LOC: Loc = { en: 'None', my: 'မရှိ' };
const YES_LOC: Loc = { en: 'Yes', my: '' };

function field(labelEn: string, labelMy: string, value: Loc): Field {
  return { label: { en: labelEn, my: labelMy }, value };
}

// Numeric value — EN western digits, MY Burmese numerals (matches the hand-entered
// profiles, e.g. "၃၀"). Empty/non-numeric → blank.
function numVal(raw: string, suffixEn = '', suffixMy = ''): Loc {
  const digits = (raw ?? '').replace(/[^0-9.]/g, '');
  return {
    en: digits ? `${digits}${suffixEn}` : '',
    my: digits ? `${toBurmeseDigits(digits)}${suffixMy}` : '',
  };
}

function isYes(v: string): boolean {
  return /^yes$/i.test(splitBilingual(v).en.trim());
}

// ---- language proficiency ---------------------------------------------------

// Language skill levels mirror the editor's LANG_SKILL_PRESETS (Basic / General /
// Advanced / Native / "—"); "Fluent" maps to Advanced, "cannot" leaves every skill
// unassessed ("—"). Each row always carries all four skills so it renders the same
// as a /new language row.
const LANG_DASH: Loc = { en: '—', my: '—' };
const LANG_BASIC: Loc = { en: 'Basic', my: 'အခြေခံ' };
const LANG_ADVANCED: Loc = { en: 'Advanced', my: 'အဆင့်မြင့်' };

function buildLanguage(nameEn: string, nameMy: string, optionEn: string): Language {
  const v = optionEn.toLowerCase();
  let listening = LANG_DASH;
  let speaking = LANG_DASH;
  let reading = LANG_DASH;
  let writing = LANG_DASH;
  if (v.includes('fluent')) {
    listening = speaking = reading = writing = LANG_ADVANCED;
  } else if (v.includes('cannot')) {
    // leave all "—" (not assessed)
  } else {
    listening = LANG_BASIC;
    speaking = LANG_BASIC;
    if (v.includes('read') || v.includes('write')) {
      reading = LANG_BASIC;
      writing = LANG_BASIC;
    }
  }
  return { name: { en: nameEn, my: nameMy }, listening, speaking, reading, writing };
}

// "more than 4 years" → "4+", "more than 2 years" → "2+", "less than 2" → "<2".
function experienceYears(en: string): string {
  const v = en.toLowerCase();
  if (v.includes('more than 4')) return '4+';
  if (v.includes('more than 2')) return '2+';
  if (v.includes('less than 2')) return '<2';
  return '';
}

// The two "what was your employer's nationality" questions each read "If yes to
// THE PREVIOUS QUESTION, …" — they reference the Singapore- / overseas-experience
// Yes/No just above them rather than naming the country, so their English titles
// are identical and can't be told apart by keyword. Match each by POSITION
// instead: scan the questions that fall between its experience question and the
// other section's, and return the first "nationality" answer split into {en, my}.
// Works whichever section comes first, and returns blank for a skipped/unanswered
// question so one section never borrows the other's nationality.
function employerNationality(answers: IntakeAnswers, sectionKw: string, otherKw: string): Loc {
  const entries = Object.entries(answers);
  const idxOf = (kw: string) =>
    entries.findIndex(([key]) => englishHalf(key).toLowerCase().includes(kw));
  const start = idxOf(sectionKw);
  if (start < 0) return { ...BLANK };
  const other = idxOf(otherKw);
  const end = other > start ? other : entries.length;
  for (let i = start + 1; i < end; i++) {
    const [key, value] = entries[i];
    if (!englishHalf(key).toLowerCase().includes('nationality')) continue;
    const raw = Array.isArray(value)
      ? value.map((x) => String(x).trim()).filter(Boolean).join(', ')
      : String(value ?? '').trim();
    return raw ? splitBilingual(raw) : { ...BLANK };
  }
  return { ...BLANK };
}

// ---- closed-enum normalizers -------------------------------------------------
// The survey's choice wording differs from the admin editor's canonical presets
// (e.g. survey "Completed highschool" vs editor "Highschool diploma (12yrs)";
// "Buddhism" vs "Buddhist"). Map each answer onto the EXACT canonical value
// (mirrors PERSONAL_VALUE_PRESETS in EmployeeEditor.tsx) so the detail-page
// dropdown resolves it AND the bio-data PDF prints the canonical text, never the
// raw survey syntax. Unrecognised wording falls back to the raw value so the admin
// can correct it by hand.

function mapEducation(loc: Loc): Loc {
  const v = loc.en.toLowerCase();
  if (v.includes('did not attend')) return { en: 'Did not attend high school (8yrs)', my: '' };
  if (v.includes('university') && (v.includes('did not finish') || v.includes('attended')))
    return { en: 'Attended university but did not finish (14yrs)', my: '' };
  if (v.includes('university') || v.includes('degree'))
    return { en: 'University Degree (16yrs)', my: '' };
  if (v.includes('high') && (v.includes('did not finish') || v.includes('attended')))
    return { en: 'Attended high school but did not finish (10yrs)', my: '' };
  if (v.includes('completed') || v.includes('diploma') || v.includes('high'))
    return { en: 'Highschool diploma (12yrs)', my: '' };
  return loc;
}

function mapReligion(loc: Loc): Loc {
  const v = loc.en.toLowerCase();
  if (v.includes('buddh')) return { en: 'Buddhist', my: 'ဗုဒ္ဓဘာသာ' };
  if (v.includes('christ') || v.includes('catholic')) return { en: 'Christian', my: 'ခရစ်ယာန်' };
  if (v.includes('islam') || v.includes('muslim')) return { en: 'Islam', my: 'အစ္စလမ်' };
  if (v.includes('hindu')) return { en: 'Hindu', my: 'ဟိန္ဒူ' };
  if (v.includes('sikh')) return { en: 'Sikh', my: 'ဆစ်ခ်ဘာသာ' };
  return loc;
}

function mapMarital(loc: Loc): Loc {
  const v = loc.en.toLowerCase();
  if (v.includes('single')) return { en: 'Single', my: 'အပျို/လူပျို' };
  if (v.includes('married')) return { en: 'Married', my: 'အိမ်ထောင်ရှိ' };
  if (v.includes('divorc')) return { en: 'Divorced', my: 'ကွာရှင်းပြီး' };
  if (v.includes('widow')) return { en: 'Widowed', my: 'မုဆိုးမ/မုဆိုးဖို' };
  return loc;
}

// ---- illnesses (mirrors the editor's ILLNESS_OPTIONS / serializeIllnesses) ----

const ILLNESS_OPTIONS: Loc[] = [
  { en: 'Mental illness', my: 'စိတ်ရောဂါ' },
  { en: 'Epilepsy', my: 'ဝက်ရူးပြန်' },
  { en: 'Asthma', my: 'ပန်းနာရင်ကျပ်' },
  { en: 'Diabetes', my: 'ဆီးချို' },
  { en: 'Hypertension', my: 'သွေးတိုး' },
  { en: 'Tuberculosis', my: 'တီဘီ' },
  { en: 'Heart disease', my: 'နှလုံးရောဂါ' },
  { en: 'Malaria', my: 'ငှက်ဖျား' },
  { en: 'Operations', my: 'ခွဲစိတ်မှု' },
];

// Serialise the form's illness selections into the bilingual comma list the
// editor's checkbox field reads (recognised options by EN label; unknowns as a
// trailing "Other: …"). Empty / "none" → None.
function serializeIllnesses(selected: Loc[]): Loc {
  const known: Loc[] = [];
  const other: string[] = [];
  for (const sel of selected) {
    if (!sel.en || /^none$/i.test(sel.en)) continue;
    const match = ILLNESS_OPTIONS.find((o) => o.en.toLowerCase() === sel.en.toLowerCase());
    if (match) known.push(match);
    else other.push(sel.en);
  }
  const enParts = known.map((o) => o.en);
  const myParts = known.map((o) => o.my);
  if (other.length) {
    enParts.push(`Other: ${other.join(', ')}`);
    myParts.push(`အခြား: ${other.join(', ')}`);
  }
  if (!enParts.length) return { ...NONE_LOC };
  return { en: enParts.join(', '), my: myParts.join('၊ ') };
}

// ---- "Open to work" (mirrors the editor's OPEN_TO_GROUPS / serializeOpenTo) ----

// Grouped EN contract the editor re-parses to pre-check boxes and the public page
// renders as grouped chips: "Caretaker: a, b | Cooking: c | Housework: d". The
// option labels MUST match the editor's exactly.
const COOKING_CUISINE_MAP: Record<string, string> = {
  chinese: 'Chinese',
  malay: 'Malay',
  malaysian: 'Malay',
  indian: 'Indian',
  thai: 'Thai',
  italian: 'Italian',
  'middle eastern': 'Middle Eastern',
};

type CaretakerFlags = {
  infant: boolean;
  child: boolean;
  adult: boolean;
  elderly: boolean;
  disabled: boolean;
};

function buildOpenToWork(answers: IntakeAnswers, ct: CaretakerFlags): string {
  const caretaker: string[] = [];
  if (ct.infant) caretaker.push('infants (0-2yrs)');
  if (ct.child) caretaker.push('children (2-17ys)');
  if (ct.adult) caretaker.push('adults (18-64ys)');
  if (ct.elderly) caretaker.push('elderly (65ys+)');
  if (ct.disabled) caretaker.push('disabled');

  // Food handling is phrased as restrictions on the form ("No Pork" / "No Beef"),
  // so willing-to-handle is the inverse of what's selected.
  const cooking: string[] = [];
  const food = findArr(answers, 'food handling').map((s) => splitBilingual(s).en.toLowerCase());
  if (!food.some((s) => s.includes('pork'))) cooking.push('Willing to handle pork');
  if (!food.some((s) => s.includes('beef'))) cooking.push('Willing to handle beef');
  for (const c of findArr(answers, 'willing to cook')) {
    const en = splitBilingual(c).en.toLowerCase().trim();
    const label =
      COOKING_CUISINE_MAP[en] ??
      Object.entries(COOKING_CUISINE_MAP).find(([k]) => en.includes(k))?.[1];
    if (label && !cooking.includes(label)) cooking.push(label);
  }

  // The form has no housework question, so default to all tasks (matches /new).
  const housework = ['Maid (Cleaning)', 'Laundry', 'Organizing the house', 'Grocery Shopping & Errands'];

  const groups: string[] = [];
  if (caretaker.length) groups.push(`Caretaker: ${caretaker.join(', ')}`);
  if (cooking.length) groups.push(`Cooking: ${cooking.join(', ')}`);
  groups.push(`Housework: ${housework.join(', ')}`);
  return groups.join(' | ');
}

// ---- skill rows -------------------------------------------------------------

// Stock skill assessments mirror the editor's DEFAULT_ASSESSMENTS so a profile
// reads the same whether it was created by intake or by /new.
const HOUSEKEEPING_ASSESSMENT =
  'Experienced in general household cleaning including sweeping, mopping, washing, ironing, grocery shopping, and keeping the home clean and well-organised.';
const COOKING_ASSESSMENT =
  'Experienced in cooking Myanmar foods, simple Chinese foods, following recipes, and maintaining cleanliness in the kitchen.';

function areaRow(
  en: string,
  my: string,
  willing: boolean,
  assessment: Loc = BLANK,
  experience: Loc = BLANK,
  areaNote?: Loc,
): AreaOfWork {
  const a: AreaOfWork = {
    area: { en, my },
    willingness: willing ? { ...YES_LOC } : { ...BLANK },
    experience,
    assessment,
  };
  if (areaNote) a.areaNote = areaNote;
  return a;
}

// ---- main mapper ------------------------------------------------------------

export function mapIntakeToEmployee(answers: IntakeAnswers): MappedIntakeProfile {
  // Caretaker willingness (single-choice Yes/No per age group) drives both the
  // caretaker skill rows and the "Open to work" selection.
  const willInfant = isYes(findStr(answers, 'caretaker of infant'));
  const willChild = isYes(findStr(answers, 'caretaker of children'));
  const willAdult = isYes(findStr(answers, 'caretaker of adults'));
  const willElderly = isYes(findStr(answers, 'caretaker of elderly'));
  const willDisabled = isYes(findStr(answers, 'caretaker of disabled'));

  // Kids back home: count from "Number of Children" + per-child ages from the
  // "how old are they?" answer, serialised as "<count> (ages: a, b)" — the format
  // the editor's age boxes and the bio-data PDF read.
  const kidsAges = findStr(answers, 'how old').match(/\d+/g) ?? [];
  const kidsCount0 = findStr(answers, 'number of children').replace(/[^0-9]/g, '');
  const kidsCount =
    kidsAges.length && (!kidsCount0 || Number(kidsCount0) < kidsAges.length)
      ? String(kidsAges.length)
      : kidsCount0;
  const kidsLoc: Loc =
    kidsCount || kidsAges.length
      ? {
          en: kidsAges.length ? `${kidsCount} (ages: ${kidsAges.join(', ')})` : kidsCount,
          my: toBurmeseDigits(kidsCount),
        }
      : { ...BLANK };

  const dob = toIsoDate(findStr(answers, 'birthday'));

  const allergiesRaw = findStr(answers, 'allergies');
  const allergies = allergiesRaw && !/^none$/i.test(allergiesRaw) ? allergiesRaw : '';

  const dietaryOpts = findArr(answers, 'dietary').map(splitBilingual).filter((d) => !/^none$/i.test(d.en));

  const illnesses = serializeIllnesses(findArr(answers, 'disease', 'illness').map(splitBilingual));

  const disabilityRaw = findStr(answers, 'physical disab');
  const disability = disabilityRaw && !/^none$/i.test(disabilityRaw) ? disabilityRaw : '';

  const residing = findStr(answers, 'residing');

  // === Personal — all 16 canonical rows, in canonical order. ================
  const personal: Field[] = [
    field('🎂 Age', '🎂 အသက်', numVal(findStr(answers, 'age'))),
    field('📅 Date of birth', '📅 မွေးသက္ကရာဇ်', dob ? { en: dob, my: dob } : { ...BLANK }),
    field('📏 Height', '📏 အရပ်', numVal(findStr(answers, 'height'), ' cm', ' စင်တီမီတာ')),
    field('⚖️ Weight', '⚖️ ကိုယ်အလေးချိန်', numVal(findStr(answers, 'weight'), ' kg', ' ကီလို')),
    field('💍 Marital status', '💍 အိမ်ထောင် အခြေအနေ', mapMarital(splitBilingual(findStr(answers, 'marital')))),
    field('👶 Kids back home', '👶 အိမ်တွင် ကလေး', kidsLoc),
    field('👨‍👩‍👧 Siblings', '👨‍👩‍👧 မောင်နှမ', numVal(findStr(answers, 'siblings'))),
    field('🙏 Religion', '🙏 ဘာသာ', mapReligion(splitBilingual(findStr(answers, 'religion')))),
    // The survey has no hometown question — default to Yangon (the ~99% case);
    // never derive it from "currently residing" (kept in intake.residingCountry).
    field('📍 Hometown', '📍 ဇာတိ', { en: 'Yangon, Myanmar', my: '' }),
    field('🎓 Education', '🎓 ပညာရေး', mapEducation(splitBilingual(findStr(answers, 'education')))),
    field('🏥 Medical certificate', '🏥 ဆေးစစ်လက်မှတ်', {
      en: '⏳ Pending certification',
      my: '⏳ လက်မှတ် ဆိုင်းငံ့ဆဲ',
    }),
    field('🩺 Past & existing illnesses', '🩺 ယခင်နှင့် လက်ရှိ ရောဂါများ', illnesses),
    field('🩼 Physical disabilities', '🩼 ကိုယ်ခန္ဓာ မသန်စွမ်းမှု', disability ? { en: disability, my: '' } : { ...NONE_LOC }),
    field('🤧 Allergies', '🤧 ဓာတ်မတည့်မှု', allergies ? { en: allergies, my: '' } : { ...NONE_LOC }),
    field(
      '🍽️ Dietary restrictions',
      '🍽️ အစားအသောက် ကန့်သတ်ချက်',
      dietaryOpts.length
        ? { en: dietaryOpts.map((d) => d.en).join(', '), my: dietaryOpts.map((d) => d.my || d.en).join(', ') }
        : { ...NONE_LOC },
    ),
    field('📝 Other remarks', '📝 အခြား မှတ်ချက်', { en: findStr(answers, 'comment'), my: '' }),
  ];

  // === Availability — all 7 canonical rows (Open-to from the survey; the rest
  // take /new's defaults). Flags mirror the editor template. ==================
  const restDays = findStr(answers, 'rest day').replace(/[^0-9]/g, '');
  const availability: Field[] = [
    {
      label: { en: '✅ Open to work:', my: '✅ လုပ်ရန် အသင့်' },
      value: {
        en: buildOpenToWork(answers, {
          infant: willInfant,
          child: willChild,
          adult: willAdult,
          elderly: willElderly,
          disabled: willDisabled,
        }),
        my: '',
      },
      fullWidth: true,
    },
    { label: { en: '🐾 Pet friendly', my: '🐾 အိမ်မွေး တိရစ္ဆာန် နှင့် ဆက်ဆံနိုင်' }, value: { en: 'Yes', my: '' } },
    {
      label: { en: "🚫 No-go's", my: '🚫 လက်မခံသော အရာ' },
      value: { ...NONE_LOC },
      fullWidth: true,
      divider: true,
    },
    { label: { en: '⏰ Earliest start', my: '⏰ စတင်နိုင်သည့် အစောဆုံး' }, value: { en: 'Immediately', my: '' } },
    { label: { en: '🛌 Days off every month', my: '🛌 အလုပ်နားရက်' }, value: { en: restDays || '1', my: '' } },
    {
      label: { en: '🗓️ Interview', my: '🗓️ အင်တာဗျူး' },
      value: { en: 'Available by video conference', my: 'ဗီဒီယိုကွန်ဖရင့်ဖြင့် အင်တာဗျူး ပြုလုပ်နိုင်' },
    },
    {
      label: { en: '📄 Work permit', my: '📄 အလုပ်လုပ်ခွင့်' },
      value: { en: 'Eligible · New', my: 'အရည်အချင်းပြည့်မီ · အသစ်' },
    },
  ];

  // === Caretaker skills — 3 canonical areas; willingness from the survey
  // (re-derived from Open-to when the admin saves). =========================
  const caretakerSkills: AreaOfWork[] = [
    areaRow('Care of infants/children', 'နို့စို့နှင့် ကလေး စောင့်ရှောက်ရေး', willInfant || willChild),
    areaRow('Care of elderly', 'သက်ကြီး စောင့်ရှောက်ရေး', willElderly),
    areaRow('Care of disabled', 'မသန်စွမ်း စောင့်ရှောက်ရေး', willDisabled),
  ];

  // === Household skills — 3 canonical areas. Cooking carries the cuisines (from
  // the "cooking experience" checkboxes) in areaNote. ========================
  const cookingOpts = findArr(answers, 'cooking').map(splitBilingual);
  const cannotCook = cookingOpts.some((c) => /do not know|cannot cook/i.test(c.en));
  const cuisines = cookingOpts.filter((c) => !/do not know|cannot cook/i.test(c.en));
  const cookingAreaNote: Loc | undefined = cuisines.length
    ? {
        en: `Cuisines: ${cuisines.map((c) => c.en).join(', ')}`,
        my: `ဟင်းလျာ: ${cuisines.map((c) => c.my || c.en).join(', ')}`,
      }
    : undefined;
  const householdSkills: AreaOfWork[] = [
    areaRow('Housekeeping & Cleaning', 'အိမ်တွင်း သန့်ရှင်းရေး', true, { en: HOUSEKEEPING_ASSESSMENT, my: '' }),
    areaRow(
      'Cooking',
      'အချက်အပြုတ်',
      cookingOpts.length ? !cannotCook : false,
      { en: COOKING_ASSESSMENT, my: '' },
      cookingOpts.length ? { en: cannotCook ? 'No' : 'Yes', my: cannotCook ? 'မရှိ' : 'ရှိ' } : { ...BLANK },
      cookingAreaNote,
    ),
    areaRow('Other', 'အခြား', false),
  ];

  // === Languages — English + Chinese (matches /new; always both rows). ======
  const languages: Language[] = [
    buildLanguage('English', 'အင်္ဂလိပ်', splitBilingual(findStr(answers, 'english')).en),
    buildLanguage('Chinese', 'တရုတ်', splitBilingual(findStr(answers, 'chinese')).en),
  ];

  // === Past experiences — seed rows from the Singapore / overseas history (the
  // admin fills role/date/`my` at review). Each section's employer-nationality
  // answer feeds the matching block's Family/Employer Nationality field. =======
  const expLevelRaw = findStr(answers, 'experience level');
  const expLevel = expLevelRaw ? splitBilingual(expLevelRaw) : { en: '', my: '' };
  const describe = findStr(answers, 'describe');
  const sgNationality = employerNationality(
    answers,
    'experience in singapore',
    'overseas excluding singapore',
  );
  const osNationality = employerNationality(
    answers,
    'overseas excluding singapore',
    'experience in singapore',
  );
  const pastExperiences: PastExp[] = [];
  if (isYes(findStr(answers, 'experience in singapore'))) {
    const exp: PastExp = {
      role: { ...BLANK },
      date: { ...BLANK },
      numYears: { en: experienceYears(expLevel.en), my: '' },
      country: { en: 'Singapore', my: 'စင်ကာပူ' },
      duties: { en: findStr(answers, 'dates, and responsibilities') || describe, my: '' },
    };
    if (sgNationality.en) exp.family = sgNationality;
    pastExperiences.push(exp);
  }
  if (isYes(findStr(answers, 'overseas excluding singapore'))) {
    const exp: PastExp = {
      role: { ...BLANK },
      date: { ...BLANK },
      numYears: { ...BLANK },
      country: { ...BLANK },
      duties: { en: findStr(answers, 'countries, and responsibilities') || describe, my: '' },
    };
    if (osNationality.en) exp.family = osNationality;
    pastExperiences.push(exp);
  }
  if (!pastExperiences.length && (describe || (expLevel.en && !/no experience/i.test(expLevel.en)))) {
    pastExperiences.push({
      role: { ...BLANK },
      date: { ...BLANK },
      numYears: { en: experienceYears(expLevel.en), my: '' },
      country: expLevel.en.toLowerCase().includes('in singapore')
        ? { en: 'Singapore', my: 'စင်ကာပူ' }
        : { ...BLANK },
      duties: { en: describe, my: '' },
    });
  }

  // === Non-public contact / screening block. ================================
  const intake: IntakeMeta = {};
  const setIf = (k: keyof IntakeMeta, v: string) => {
    if (v) intake[k] = v;
  };
  setIf('nickName', findStr(answers, 'nick'));
  setIf('gender', splitBilingual(findStr(answers, 'gender')).en);
  setIf('pregnant', splitBilingual(findStr(answers, 'pregnant')).en);
  setIf('tattoos', splitBilingual(findStr(answers, 'tattoo')).en);
  setIf('whatsapp', findStr(answers, 'whatsapp'));
  setIf('visaExpiry', toIsoDate(findStr(answers, 'visa')));
  setIf('passportExpiry', toIsoDate(findStr(answers, 'passport')));
  setIf('certifications', findStr(answers, 'certification'));
  setIf('experienceLevel', expLevel.en);
  setIf('residingCountry', residing);
  const bangkok = findStr(answers, 'bangkok');
  setIf('stayingInBangkok', bangkok ? (isYes(bangkok) ? 'yes' : 'no') : '');

  return {
    name: findStr(answers, 'full name'),
    // Same default role as /new; the 'pending' status flags it as a draft.
    role: { en: 'Home Care Taker', my: 'အိမ်တွင်း စောင့်ရှောက်သူ' },
    personal,
    availability,
    languages,
    caretakerSkills,
    householdSkills,
    pastExperiences,
    intake,
  };
}
