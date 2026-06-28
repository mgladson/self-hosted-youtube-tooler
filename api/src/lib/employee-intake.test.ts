import { describe, expect, it } from 'vitest';
import {
  classifyIntakeUpload,
  mapIntakeToEmployee,
  resolveIntakeImages,
  splitBilingual,
  type IntakeAnswers,
} from './employee-intake.js';

// Question titles + answer strings copied verbatim from the live form
// (docs.google.com/forms/d/e/1FAIpQLSfbb0DtO3q3ays6NEIJ4FGq2CXaKfph_H5Sq3RrUN0vpHJ8WA).
const SAMPLE: IntakeAnswers = {
  'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'Aung Aung',
  'နစ်နာမည် / Nick Name': 'Mg Mg',
  'ကျား၊ / Gender': 'အမျိုးသမီး / Female',
  'လက်ရှိမှာ ကိုယ်ဝန်ရှိပါသလား။ / Are you currently pregnant?': 'မဟုတ်ဘူး / No',
  'အသက် / Age': '30',
  'မွေးနေ့ / Birthday': '1995-04-12',
  'အမြင့် (စင်တီမီတာ) / Height (cm)': '160',
  'အလေးချိန် (ကီလိုဂရမ်) / Weight (kg)': '55',
  'ဘာသာတရား / Religion': 'ဗုဒ္ဓဘာသာ / Buddhism',
  'အိမ်ထောင်ရေးအခြေအနေ / Marital Status': 'အိမ်ထောင်သည် / Married',
  'ကလေးအရေအတွက် / Number of Children': '2',
  'ကလေးရှိရင် အသက်ဘယ်လောက်ရှိပြီလဲ။ / If you have children, how old are they?': '7, 5',
  'မွေးချင်းအရေအတွက် / Number of Siblings': '3',
  'ဓာတ်မတည့်ခြင်း။ / Allergies': 'None',
  'အစားအသောက်ကန့်သတ်ချက်များ / Dietary Restrictions': [
    'ဝက်သားမစားနိုင်ဘူး။ / I cannot eat pork',
    'အမဲသားမစားနိုင်ဘူး။ / I cannot eat beef',
  ],
  'ယခင်လုပ်ငန်းအတွေ့အကြုံ / Previous Work Experience Level':
    'ကျွန်တော် စင်ကာပူမှာ အတွေ့အကြုံ 4 နှစ်ကျော်ရှိတယ်။ / I have more than 4 years of experience in Singapore',
  'ယခင်လုပ်ငန်းအတွေ့အကြုံ / Describe your Previous Work Experience if you have any':
    'Cared for an elderly couple in Singapore for 4 years.',
  'သင်သည် ... / Are you willing to be a caretaker of infant(s) (younger than 2 years old)?': 'ဟုတ်တယ် / Yes',
  'ကလေး(များ) ... / Are you willing to be a caretaker of children(s) (older than 2 years old)?': 'ဟုတ်တယ် / Yes',
  'အရွယ်ရောက်ပြီးသူ ... / Are you willing to be a caretaker of adults (18 - 65 year old)?': 'မဟုတ်ဘူး / No',
  'သက်ကြီးရွယ်အို ... / Are you willing to be a caretaker of elderly (older than 65 year old)?': 'ဟုတ်တယ် / Yes',
  'မသန်စွမ်းသူ ... / Are you willing to be a caretaker of disabled (physically and/or mentally challenged)?': 'မဟုတ်ဘူး / No',
  'အောက်ပါ ... / Are you willing to cook the following foods?': ['တရုတ် / Chinese', 'မလေးရှား / Malaysian'],
  'အစားအသောက် ကိုင်တွယ်ခြင်း / Food Handling Preferences': ['ဝက်သားမရှိပါ။ / No Pork'],
  'အတိတ်နှင့် ... / Past and Existing Diseases and Illnesses': ['ပန်းနာရင်ကျပ် / Asthma'],
  'ရုပ်ပိုင်းဆိုင်ရာ ... / Physical disabilities (if none, write none)': 'none',
  'တစ်လလျှင် ... / Preference for rest days per month (Example: 2)': '4',
  'ဟင်းချက်အတွေ့အကြုံ / Cooking Experience': ['တရုတ် / Chinese', 'အိန္ဒိယ / Indian'],
  'ပညာရေးအဆင့် / Education Level': 'အထက်တန်းကျောင်း ပြီးတယ်။ / Completed highschool',
  'အင်္ဂလိပ်စာကျွမ်းကျင်မှု / English Proficiency':
    'ကျွန်တော်က အင်္ဂလိပ်လို ရေးတတ်၊ ဖတ်တတ်၊ ကျွမ်းကျင်တယ်။ / I am fluent reading, writing, speaking in English',
  'တရုတ်ကျွမ်းကျင်မှု / Chinese Proficiency':
    'တရုတ်စကား မပြောတတ်ဘူး။ / I cannot speak any Chinese',
  'သက်ဆိုင်ရာ အသိအမှတ်ပြုလက်မှတ်များစာရင်း / List any Relevant Certifications (active or expired)':
    'First Aid 2021',
  'လက်ရှိ မြန်မာနိုင်ငံတွင် နေထိုင်လျက်ရှိပါသည်။ / Currently Residing in Country': 'Singapore',
  'သင့်လက်ရှိဗီဇာ / When does your current visa expire in the country you are currently residing?':
    '2026-12-31',
  'မင်းရဲ့လက်ရှိနိုင်ငံကူးလက်မှတ်က ဘယ်အချိန်မှာ သက်တမ်းကုန်ဆုံးမလဲ။ / When does your current passport expiry?':
    '2026-06-27',
  'Do you have visible tattoos?': 'မဟုတ်ဘူး / No',
  'မင်း ငါတို့နဲ့ ဘန်ကောက်မှာနေဖို့ အစီအစဉ်ရှိလား။ / Will you be planning on staying with us in Bangkok?':
    'ဟုတ်တယ် / Yes',
  'WhatsApp ဆက်သွယ်မှု / WhatsApp Contact': '+65 8123 4567',
  'အခြားမှတ်ချက်များ / Other comments': 'Available immediately.',
};

function personalValue(p: { label: { en: string }; value: { en: string; my: string } }[], kw: string) {
  return p.find((r) => r.label.en.toLowerCase().includes(kw))?.value;
}

describe('splitBilingual', () => {
  it('splits "<Burmese> / <English>" on the first separator', () => {
    expect(splitBilingual('ဗုဒ္ဓဘာသာ / Buddhism')).toEqual({ en: 'Buddhism', my: 'ဗုဒ္ဓဘာသာ' });
  });

  it('keeps a slash inside the English half (does not over-split)', () => {
    const s =
      'ကျွန်ုပ်တွင် အထောက်အကူ/စောင့်ရှောက်ပေးသူ/အိမ်သန့်ရှင်းရေးအဖြစ် အတွေ့အကြုံမရှိပါ။ / I have no experience as a helper / care taker / house cleaning';
    const { en, my } = splitBilingual(s);
    expect(en).toBe('I have no experience as a helper / care taker / house cleaning');
    expect(my).toContain('မရှိပါ။');
  });

  it('treats a string with no separator as EN-only', () => {
    expect(splitBilingual('First Aid 2021')).toEqual({ en: 'First Aid 2021', my: '' });
  });
});

describe('mapIntakeToEmployee', () => {
  const p = mapIntakeToEmployee(SAMPLE);

  it('pulls the full name and the default role (same as /new)', () => {
    expect(p.name).toBe('Aung Aung');
    expect(p.role.en).toBe('Home Care Taker');
  });

  it('matches the canonical personal label set used by /new', () => {
    expect(p.personal.map((f) => f.label.en)).toEqual([
      '🎂 Age',
      '📅 Date of birth',
      '📏 Height',
      '⚖️ Weight',
      '💍 Marital status',
      '👶 Kids back home',
      '👨‍👩‍👧 Siblings',
      '🙏 Religion',
      '📍 Hometown',
      '🎓 Education',
      '🏥 Medical certificate',
      '🩺 Past & existing illnesses',
      '🩼 Physical disabilities',
      '🤧 Allergies',
      '🍽️ Dietary restrictions',
      '📝 Other remarks',
    ]);
  });

  it('maps the survey Sikhism option to the Sikh preset', () => {
    const r = mapIntakeToEmployee({
      'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'T',
      'ဘာသာတရား / Religion': 'ဆစ်ခ်ဘာသာ / Sikhism',
    });
    expect(r.personal.find((f) => f.label.en === '🙏 Religion')?.value.en).toBe('Sikh');
  });

  it('normalizes choice fields to the canonical preset values (not raw survey text)', () => {
    // survey "Buddhism" → canonical "Buddhist"
    expect(personalValue(p.personal, 'religion')).toEqual({ en: 'Buddhist', my: 'ဗုဒ္ဓဘာသာ' });
    expect(personalValue(p.personal, 'marital')).toEqual({ en: 'Married', my: 'အိမ်ထောင်ရှိ' });
    // survey "Completed highschool" → canonical "Highschool diploma (12yrs)"
    expect(personalValue(p.personal, 'education')?.en).toBe('Highschool diploma (12yrs)');
  });

  it('renders numeric rows with Burmese numerals on the MY side', () => {
    expect(personalValue(p.personal, 'age')).toEqual({ en: '30', my: '၃၀' });
    expect(personalValue(p.personal, 'height')).toEqual({ en: '160 cm', my: '၁၆၀ စင်တီမီတာ' });
    expect(personalValue(p.personal, 'siblings')?.en).toBe('3');
  });

  it('wires children count + ages into the kids-back-home value', () => {
    expect(personalValue(p.personal, 'kids')?.en).toBe('2 (ages: 7, 5)');
  });

  it('defaults hometown to Yangon and never uses the residing-country answer', () => {
    expect(personalValue(p.personal, 'hometown')?.en).toBe('Yangon, Myanmar');
    // "Currently residing" is captured separately (intake), not as hometown.
    expect(p.intake.residingCountry).toBe('Singapore');
  });

  it('stores the birthday as ISO for the bio-data PDF', () => {
    expect(personalValue(p.personal, 'birth')?.en).toBe('1995-04-12');
  });

  it('joins dietary checkbox selections', () => {
    const diet = personalValue(p.personal, 'dietary')!;
    expect(diet.en).toContain('pork');
    expect(diet.en).toContain('beef');
  });

  it('builds a Cooking household skill with cuisines in areaNote', () => {
    const cooking = p.householdSkills.find((s) => s.area.en === 'Cooking')!;
    expect(cooking.experience?.en).toBe('Yes');
    expect(cooking.areaNote?.en).toContain('Chinese');
    expect(cooking.areaNote?.en).toContain('Indian');
  });

  it('maps English fluency to an editor preset and keeps a Chinese row', () => {
    const english = p.languages.find((l) => l.name.en === 'English')!;
    expect(english.speaking?.en).toBe('Advanced');
    expect(english.reading?.en).toBe('Advanced');
    // "cannot speak any Chinese" → the row is still present (matches /new) but the
    // skills are left unassessed.
    const chinese = p.languages.find((l) => l.name.en === 'Chinese')!;
    expect(chinese).toBeTruthy();
    expect(chinese.speaking?.en).toBe('—');
  });

  it('emits the full canonical availability set (no orphan "work experience" row)', () => {
    expect(p.availability.map((f) => f.label.en)).toEqual([
      '✅ Open to work:',
      '🐾 Pet friendly',
      "🚫 No-go's",
      '⏰ Earliest start',
      '🛌 Days off every month',
      '🗓️ Interview',
      '📄 Work permit',
    ]);
  });

  it('builds Open to work from the caretaker / cooking answers', () => {
    const openTo = p.availability.find((f) => f.label.en === '✅ Open to work:')!.value.en;
    expect(openTo).toContain('Caretaker: infants (0-2yrs), children (2-17ys), elderly (65ys+)');
    expect(openTo).not.toContain('adults'); // answered No
    expect(openTo).not.toContain('disabled'); // answered No
    // "No Pork" → pork excluded, beef kept; cuisines mapped (Malaysian → Malay).
    expect(openTo).toContain('Willing to handle beef');
    expect(openTo).not.toContain('Willing to handle pork');
    expect(openTo).toContain('Malay');
    expect(openTo).toContain('Housework: Maid (Cleaning)');
  });

  it('maps rest days into the Days-off availability row', () => {
    expect(p.availability.find((f) => f.label.en === '🛌 Days off every month')?.value.en).toBe('4');
  });

  it('emits the 3 canonical caretaker areas with willingness from the survey', () => {
    expect(p.caretakerSkills.map((s) => s.area.en)).toEqual([
      'Care of infants/children',
      'Care of elderly',
      'Care of disabled',
    ]);
    const byArea = (en: string) => p.caretakerSkills.find((s) => s.area.en === en)!;
    expect(byArea('Care of infants/children').willingness?.en).toBe('Yes');
    expect(byArea('Care of elderly').willingness?.en).toBe('Yes');
    expect(byArea('Care of disabled').willingness?.en).toBe(''); // answered No
  });

  it('emits the 3 canonical household areas', () => {
    expect(p.householdSkills.map((s) => s.area.en)).toEqual([
      'Housekeeping & Cleaning',
      'Cooking',
      'Other',
    ]);
  });

  it('maps past & existing illnesses into the checkbox field', () => {
    expect(personalValue(p.personal, 'illness')?.en).toContain('Asthma');
  });

  it('seeds an employment-history row from the free-text describe answer', () => {
    expect(p.pastExperiences).toHaveLength(1);
    expect(p.pastExperiences[0].duties.en).toContain('elderly couple');
    expect(p.pastExperiences[0].country.en).toBe('Singapore');
    expect(p.pastExperiences[0].numYears.en).toBe('4+');
  });

  it('seeds a Singapore experience row from the "if yes" details', () => {
    const r = mapIntakeToEmployee({
      'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'Test',
      'စင်ကာပူတွင် ... / Previous Working Experience in Singapore?': 'ဟုတ်တယ် / Yes',
      'အကယ်၍ ... / If yes to the previous question, list the dates, and responsibilities you had, along with if you completed your contract. If you did not complete your contract, why.':
        'Apr 2024 – Mar 2026, full household',
      'ယခင်လုပ်ငန်းအတွေ့အကြုံ / Previous Work Experience Level':
        '... / I have more than 4 years of experience in Singapore',
    });
    expect(r.pastExperiences).toHaveLength(1);
    expect(r.pastExperiences[0].country.en).toBe('Singapore');
    expect(r.pastExperiences[0].duties.en).toContain('full household');
    expect(r.pastExperiences[0].numYears.en).toBe('4+');
  });

  it('wires the Singapore employer nationality into the Singapore block', () => {
    const r = mapIntakeToEmployee({
      'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'Test',
      'စင်ကာပူတွင် ... / Previous Working Experience in Singapore?': 'ဟုတ်တယ် / Yes',
      "ယခင်မေးခွန်းအတွက် ... / If yes to the previous question, what was your employer's nationality":
        'တရုတ် / Chinese',
    });
    expect(r.pastExperiences).toHaveLength(1);
    expect(r.pastExperiences[0].country.en).toBe('Singapore');
    expect(r.pastExperiences[0].family?.en).toBe('Chinese');
    expect(r.pastExperiences[0].family?.my).toBe('တရုတ်');
  });

  it('routes each employer nationality to its own block when both sections apply', () => {
    // Both "employer's nationality" questions carry an IDENTICAL English title
    // ("If yes to the previous question, …"); they're told apart by position.
    const r = mapIntakeToEmployee({
      'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'Test',
      'စင်ကာပူတွင် ... / Previous Working Experience in Singapore?': 'ဟုတ်တယ် / Yes',
      "ယခင်မေးခွန်းအတွက် ... / If yes to the previous question, what was your employer's nationality":
        'တရုတ် / Chinese',
      'နိုင်ငံခြား ... / Previous Working Experience Overseas excluding Singapore?': 'ဟုတ်တယ် / Yes',
      "အခြားနိုင်ငံ ... / If yes to the previous question, what was your employer's nationality":
        'အရှေ့အလယ်ပိုင်း / Middle Eastern',
    });
    expect(r.pastExperiences).toHaveLength(2);
    const sg = r.pastExperiences.find((e) => e.country.en === 'Singapore')!;
    expect(sg.family?.en).toBe('Chinese');
    const os = r.pastExperiences.find((e) => e.country.en !== 'Singapore')!;
    expect(os.family?.en).toBe('Middle Eastern');
  });

  it('wires the overseas employer nationality when only the overseas section applies', () => {
    const r = mapIntakeToEmployee({
      'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'Test',
      'စင်ကာပူတွင် ... / Previous Working Experience in Singapore?': 'မဟုတ်ဘူး / No',
      'နိုင်ငံခြား ... / Previous Working Experience Overseas excluding Singapore?': 'ဟုတ်တယ် / Yes',
      "အခြားနိုင်ငံ ... / If yes to the previous question, what was your employer's nationality":
        'ဂျပန် / Japanese',
    });
    expect(r.pastExperiences).toHaveLength(1);
    expect(r.pastExperiences[0].country.en).not.toBe('Singapore');
    expect(r.pastExperiences[0].family?.en).toBe('Japanese');
  });

  it('does not borrow the overseas nationality for the Singapore block when the Singapore one is unanswered', () => {
    const r = mapIntakeToEmployee({
      'အလုပ်သမားမေးခွန်းလွှာ / Full Name': 'Test',
      'စင်ကာပူတွင် ... / Previous Working Experience in Singapore?': 'ဟုတ်တယ် / Yes',
      // (Singapore employer-nationality question left unanswered — omitted here.)
      'နိုင်ငံခြား ... / Previous Working Experience Overseas excluding Singapore?': 'ဟုတ်တယ် / Yes',
      "အခြားနိုင်ငံ ... / If yes to the previous question, what was your employer's nationality":
        'ဥရောပ / European',
    });
    const sg = r.pastExperiences.find((e) => e.country.en === 'Singapore')!;
    const os = r.pastExperiences.find((e) => e.country.en !== 'Singapore')!;
    expect(sg.family).toBeUndefined();
    expect(os.family?.en).toBe('European');
  });

  it('routes contact/screening answers into the intake block', () => {
    expect(p.intake.whatsapp).toBe('+65 8123 4567');
    expect(p.intake.gender).toBe('Female');
    expect(p.intake.pregnant).toBe('No');
    expect(p.intake.tattoos).toBe('No');
    expect(p.intake.visaExpiry).toBe('2026-12-31');
    expect(p.intake.passportExpiry).toBe('2026-06-27');
    expect(p.intake.stayingInBangkok).toBe('yes');
    expect(p.intake.certifications).toBe('First Aid 2021');
    expect(p.intake.experienceLevel).toContain('more than 4 years');
  });
});

describe('classifyIntakeUpload', () => {
  // Exact bilingual titles copied from the live form's three ID-document upload
  // questions (and a representative headshot question).
  it('classifies each live form upload title to the right slot', () => {
    expect(
      classifyIntakeUpload('သင့်ပတ်စပို့စာမျက်နှာကို တင်ပါ။ / Upload your passport page'),
    ).toBe('passport');
    expect(
      classifyIntakeUpload(
        'သင့်နိုင်ငံကူးလက်မှတ်တွင် ... / Upload your current active visa stamp in your passport',
      ),
    ).toBe('visa-stamp');
    expect(
      classifyIntakeUpload(
        'သင့်နိုင်ငံကူးလက်မှတ်မှ ... / Upload your entry stamp in your current country from your passport',
      ),
    ).toBe('entry-stamp');
    expect(classifyIntakeUpload('ပရိုဖိုင်ဓာတ်ပုံ / Upload your profile picture')).toBe('photo');
  });

  it('matches visa/entry before passport even though their titles also say "passport"', () => {
    // The visa/entry titles contain "passport" ("...in your passport"); keyword
    // order must not misfile them as the passport scan.
    expect(classifyIntakeUpload('visa stamp in your passport')).toBe('visa-stamp');
    expect(classifyIntakeUpload('entry stamp ... from your passport')).toBe('entry-stamp');
  });

  it('is resilient to wording drift (the old exact-substring matcher was not)', () => {
    expect(classifyIntakeUpload('Upload a clear scan of your passport bio page')).toBe('passport');
    expect(classifyIntakeUpload('Photo of your current visa')).toBe('visa-stamp');
    expect(classifyIntakeUpload('Your most recent entry stamp')).toBe('entry-stamp');
    expect(classifyIntakeUpload('Upload a recent headshot')).toBe('photo');
  });

  it('returns null for an unrecognised title', () => {
    expect(classifyIntakeUpload('How many years of experience?')).toBeNull();
    expect(classifyIntakeUpload('')).toBeNull();
  });
});

describe('resolveIntakeImages', () => {
  it('classifies the forwarded uploads[] into the four slots by title', () => {
    const r = resolveIntakeImages({
      uploads: [
        { title: '... / Upload your profile picture', base64: 'PHOTO' },
        { title: '... / Upload your passport page', base64: 'PASS' },
        { title: '... / Upload your current active visa stamp in your passport', base64: 'VISA' },
        { title: '... / Upload your entry stamp in your current country from your passport', base64: 'ENTRY' },
      ],
    });
    expect(r).toEqual({
      photoBase64: 'PHOTO',
      passportBase64: 'PASS',
      visaStampBase64: 'VISA',
      entryStampBase64: 'ENTRY',
    });
  });

  it('treats an unrecognised upload as the headshot when none was picked', () => {
    const r = resolveIntakeImages({
      uploads: [{ title: 'Upload a clear photo of yourself please', base64: 'X' }],
    });
    // "photo" keyword → headshot; even a fully unrecognised title would too.
    expect(r.photoBase64).toBe('X');
    expect(r.passportBase64).toBeUndefined();
  });

  it('does not let a stray upload clobber an already-resolved headshot', () => {
    const r = resolveIntakeImages({
      uploads: [
        { title: 'profile picture', base64: 'REAL' },
        { title: 'totally unlabelled thing', base64: 'STRAY' },
      ],
    });
    expect(r.photoBase64).toBe('REAL');
  });

  it('falls back to the legacy explicit *Base64 fields (older Apps Script)', () => {
    const r = resolveIntakeImages({
      photoBase64: 'P',
      passportBase64: 'PP',
      visaStampBase64: 'VV',
      entryStampBase64: 'EE',
    });
    expect(r).toEqual({
      photoBase64: 'P',
      passportBase64: 'PP',
      visaStampBase64: 'VV',
      entryStampBase64: 'EE',
    });
  });

  it('prefers a classified upload but backfills missing slots from legacy fields', () => {
    const r = resolveIntakeImages({
      uploads: [{ title: 'Upload your passport page', base64: 'PASS' }],
      photoBase64: 'LEGACYPHOTO',
    });
    expect(r.passportBase64).toBe('PASS');
    expect(r.photoBase64).toBe('LEGACYPHOTO');
    expect(r.visaStampBase64).toBeUndefined();
  });

  it('ignores empty/whitespace-free-of-content upload entries', () => {
    const r = resolveIntakeImages({
      uploads: [
        { title: 'Upload your passport page', base64: '' },
        { title: 'Upload your passport page' },
      ],
    });
    expect(r.passportBase64).toBeUndefined();
  });
});
