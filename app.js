/* ---------- SCAM CHECKER ---------- */
const SCAM_Q = [
  { id:'fee',  q:'Did they ask you to pay any money?', hint:'Registration, training, laptop, document verification, "security deposit" — any amount.', weight: 30 },
  { id:'email', q:'Is the offer coming from a personal email?', hint:'Gmail, Yahoo, Rediffmail instead of a company domain.', weight: 12 },
  { id:'whatsapp', q:'Is the whole process on WhatsApp only?', hint:'No official email, no company portal, no video interview.', weight: 12 },
  { id:'guarantee', q:'Did they "guarantee" a job or salary?', hint:'Real employers never guarantee placement.', weight: 18 },
  { id:'nocall', q:'Do they refuse a video call or office visit?', hint:'Legitimate recruiters are happy to meet on camera.', weight: 14 },
  { id:'urgent', q:'Are they pressuring you to pay "today" or "the seat is closing"?', hint:'Urgency is a pressure tactic, not a hiring process.', weight: 10 },
  { id:'noreg', q:'Is the company not findable on MCA or LinkedIn?', hint:'Search the name on mca.gov.in and LinkedIn before paying anything.', weight: 14 },
];

function buildScamQs(){
  const el = document.getElementById('scamQs');
  el.innerHTML = SCAM_Q.map(q => `
    <div class="q">
      <div class="txt">${q.q}<small>${q.hint}</small></div>
      <div class="switch" data-id="${q.id}">
        <button data-act="pick" data-id="${q.id}" data-val="yes">Yes</button>
        <button data-act="pick" data-id="${q.id}" data-val="no">No</button>
      </div>
    </div>`).join('');
}
const picks = {};
function pick(id, val, btn){
  picks[id] = val;
  const grp = btn.parentElement;
  grp.querySelectorAll('button').forEach(b => b.className = '');
  btn.className = val === 'yes' ? 'on-no' : 'on';
}
function resetScam(){
  Object.keys(picks).forEach(k => delete picks[k]);
  document.querySelectorAll('#scamQs .switch button').forEach(b => b.className = '');
  document.getElementById('scamOut').classList.remove('show');
}
function checkScam(){
  track('tool_scam');
  const answered = Object.keys(picks).length;
  if (answered < 4){ alert('Please answer at least 4 questions.'); return; }
  let score = 0, flags = [];
  SCAM_Q.forEach(q => {
    if (picks[q.id] === 'yes'){
      score += q.weight;
      flags.push({ bad:true, text:q.q.replace(/^Did |^Is |^Are |^Do /,'') });
    }
  });
  const max = SCAM_Q.reduce((a,q)=>a+q.weight,0);
  const pct = Math.round(score / max * 100);
  let cls, label, verdict;
  if (pct >= 45){ cls='risk-high'; label='HIGH RISK'; verdict='Multiple serious red flags. Do not pay anything. Do not share documents. Verify the company independently before going further.'; }
  else if (pct >= 20){ cls='risk-mid'; label='BE CAREFUL'; verdict='Some warning signs. Ask for the company registration number, an official email from the company domain, and a video interview before you commit.'; }
  else { cls='risk-low'; label='LOW RISK'; verdict='Few warning signs found. Still verify the company on MCA and LinkedIn, and never pay for a job.'; }

  const out = document.getElementById('scamOut');
  out.innerHTML = `
    <div class="risk ${cls}">
      <div class="score">${pct}<span style="font-size:.9rem">%</span></div>
      <div><div style="font-weight:800">${label}</div><div class="lbl">${verdict}</div></div>
    </div>
    <ul class="flags">
      ${SCAM_Q.map(q => `<li class="${picks[q.id]==='yes'?'bad':'ok'}">${q.q}</li>`).join('')}
    </ul>
    <p class="note" style="margin-top:14px">This is a warning-sign assessment, not proof of fraud. Report suspected job scams at cybercrime.gov.in or call 1930.</p>`;
  out.classList.add('show');
  showPdfBar('scam');
}

/* ---------- ATS / MATCH ENGINE ---------- */
const STOP = new Set(('a an the and or but if then than that this these those for with without from into onto of in on at to by as is are was were be been being have has had do does did will would can could should may might must not no nor so such own same very just also about above after again against all am any because before below between both during each few further here how i its itself more most my myself once only other out over s t too under until up while who whom why you your yours yourself we our ours they them their theirs he she his her hers it me him us').split(/\s+/));

function words(t){
  return String(t || '').slice(0, 60000).toLowerCase().replace(/[^a-z0-9+#.\s-]/g,' ').split(/\s+/).filter(w => w.length>2 && !STOP.has(w));
}
function kwFreq(list){
  const m = {};
  list.forEach(w => m[w] = (m[w]||0)+1);
  return m;
}

function analyse(resumeText, jdText){
  const rw = words(resumeText), jw = words(jdText);
  if (!rw.length || !jw.length) return null;
  const rset = new Set(rw);
  const jfreq = kwFreq(jw);
  // top JD keywords by frequency, keep meaningful ones
  const jdKeys = Object.keys(jfreq).sort((a,b)=>jfreq[b]-jfreq[a]).slice(0, 40);
  const found = jdKeys.filter(k => rset.has(k));
  const missing = jdKeys.filter(k => !rset.has(k));
  const pct = jdKeys.length ? Math.round(found.length / jdKeys.length * 100) : 0;

  // readability signals
  const raw = (resumeText||'');
  const issues = [];
  if (raw.length < 900) issues.push('Resume looks short — under about 150 words. Add projects, tools and outcomes.');
  if (!/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) issues.push('No email address detected.');
  if (!/(\+91[\s-]?)?[6-9]\d{9}/.test(raw.replace(/[^0-9+]/g,''))) issues.push('No Indian mobile number detected.');
  if (/[│┃┆┊|]/.test(raw)) issues.push('Table or column characters found — many ATS parsers break on tables.');
  if (/\t{2,}/.test(raw)) issues.push('Multiple tabs found — can scramble reading order in parsing.');
  if (!/experience|employment|work history/i.test(raw)) issues.push('No "Experience" heading found. Use a standard label.');
  if (!/education|qualification|academic/i.test(raw)) issues.push('No "Education" heading found.');
  if (!/skill/i.test(raw)) issues.push('No "Skills" heading found.');
  if ((raw.match(/\b(managed|led|built|created|improved|reduced|delivered|launched|designed)\b/gi)||[]).length < 3)
    issues.push('Few action verbs. Start bullets with led, built, improved, delivered.');
  if (/\bresponsible for\b/i.test(raw)) issues.push('"Responsible for" is passive — rewrite as what you actually did.');

  return { pct, found, missing, issues, jdKeys };
}

function renderAnalysis(outId, res){
  const out = document.getElementById(outId);
  if (!res){ out.innerHTML = '<p style="color:#ef4444">Please paste both your resume and the job description.</p>'; out.classList.add('show'); return; }
  const cls = res.pct >= 70 ? 'risk-low' : res.pct >= 45 ? 'risk-mid' : 'risk-high';
  const label = res.pct >= 70 ? 'STRONG MATCH' : res.pct >= 45 ? 'PARTIAL MATCH' : 'WEAK MATCH';
  out.innerHTML = `
    <div class="risk ${cls}">
      <div class="score">${res.pct}<span style="font-size:.9rem">%</span></div>
      <div><div style="font-weight:800">${label}</div><div class="lbl">${res.found.length} of ${res.jdKeys.length} key terms from the job description appear in your resume.</div></div>
    </div>
    ${res.missing.length ? `<div style="margin-top:14px"><strong style="font-size:.85rem">Missing keywords</strong><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${res.missing.slice(0,25).map(k=>`<span style="background:#2a1114;border:1px solid #4d1d22;color:#fca5a5;padding:3px 9px;border-radius:7px;font-size:.76rem">${esc(k)}</span>`).join('')}</div></div>` : ''}
    ${res.found.length ? `<div style="margin-top:14px"><strong style="font-size:.85rem">Already present</strong><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${res.found.slice(0,25).map(k=>`<span style="background:#0f2419;border:1px solid #1c3b2c;color:#86efac;padding:3px 9px;border-radius:7px;font-size:.76rem">${esc(k)}</span>`).join('')}</div></div>` : ''}
    ${res.issues.length ? `<div style="margin-top:16px"><strong style="font-size:.85rem">Parsing and readability issues</strong><ul class="flags" style="margin-top:8px">${res.issues.map(i=>`<li class="bad">${esc(i)}</li>`).join('')}</ul></div>` : '<p class="note" style="margin-top:14px">No structural problems detected.</p>'}
    <p class="note" style="margin-top:14px">Keyword comparison only. This is not an employer's ATS score — no tool can produce that number.</p>`;
  out.classList.add('show');
  showPdfBar(outId === 'atsOut' ? 'ats' : 'match');
}
function runAts(){ track('tool_ats'); renderAnalysis('atsOut', analyse(document.getElementById('atsResume').value, document.getElementById('atsJD').value)); }
function runMatch(){ track('tool_match'); renderAnalysis('matchOut', analyse(document.getElementById('matchResume').value, document.getElementById('matchJD').value)); }

/* ---------- REPAIR (client-side rewrite scaffold; AI call wired later) ---------- */
async function runRepair(){
  const line = document.getElementById('repairIn').value.trim();
  const role = document.getElementById('repairRole').value.trim();
  const out = document.getElementById('repairOut');
  if (!line){ out.innerHTML = '<p style="color:#ef4444">Paste a bullet point first.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'repair', site: 'careershield', lang: 'english',
    bullet: line, role: role
  }, 'repairOut', 'Rewriting your bullet point…');

  if (txt === null){
    out.innerHTML += `<p style="color:var(--muted);margin-top:10px">Meanwhile, these are the rules we apply:</p>
    <ul class="flags" style="margin-top:10px">
      <li class="ok">Start with a strong verb: led, built, delivered, reduced, improved, launched.</li>
      <li class="ok">Say what changed, not what you were "responsible for".</li>
      <li class="ok">Add a number only if you can defend it in an interview.</li>
      <li class="ok">Never invent a company, a title, a date or a metric.</li>
    </ul>`;
    out.classList.add('show');
    return;
  }
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('repair');
}

async function runCover(){
  const role = document.getElementById('clRole').value.trim();
  const company = document.getElementById('clCompany').value.trim();
  const exp = document.getElementById('clExp').value.trim();
  const jd = document.getElementById('clJd').value.trim();
  const lang = document.getElementById('clLang').value;
  const out = document.getElementById('coverOut');
  if (!role || !exp){ out.innerHTML = '<p style="color:#ef4444">Job title and your skills are needed.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'cover-letter', site: 'careershield', lang: lang,
    role: role, company: company, experience: exp, jd: jd
  }, 'coverOut', 'Writing your cover letter…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('cover');
}


/* ---------- AI ACHIEVEMENT WRITER ---------- */
async function runAchieve(){
  const duty = document.getElementById('achDuty').value.trim();
  const role = document.getElementById('achRole').value.trim();
  const numbers = document.getElementById('achNums').value.trim();
  const lang = document.getElementById('achLang').value;
  const out = document.getElementById('achOut');
  if (!duty){ out.innerHTML = '<p style="color:#ef4444">Write what you did first.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'achievement', site: 'careershield', lang: lang,
    duty: duty, role: role, numbers: numbers
  }, 'achOut', 'Turning this into achievement lines…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('achievement');
}

/* ---------- HINDI <-> ENGLISH CONVERTER ---------- */
async function runTranslate(){
  const text = document.getElementById('trText').value.trim();
  const direction = document.getElementById('trDir').value;
  const out = document.getElementById('trOut');
  if (!text){ out.innerHTML = '<p style="color:#ef4444">Paste the text to convert.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'career-translate', site: 'careershield',
    text: text, direction: direction
  }, 'trOut', 'Converting…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('translate');
}

/* ---------- CAREER GAP ASSISTANT ---------- */
async function runGap(){
  const gap = document.getElementById('gapLen').value.trim();
  const reason = document.getElementById('gapReason').value.trim();
  const lastRole = document.getElementById('gapLast').value.trim();
  const targetRole = document.getElementById('gapTarget').value.trim();
  const skills = document.getElementById('gapSkills').value.trim();
  const lang = document.getElementById('gapLang').value;
  const out = document.getElementById('gapOut');
  if (!gap || !reason){ out.innerHTML = '<p style="color:#ef4444">The gap length and the real reason are both needed.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'career-gap', site: 'careershield', lang: lang,
    gap: gap, reason: reason, lastRole: lastRole, targetRole: targetRole, skills: skills
  }, 'gapOut', 'Working out how to say this…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('gap');
}

/* ---------- FRESHER RESUME EXPERT ---------- */
async function runFresher(){
  const degree = document.getElementById('frDegree').value.trim();
  const role = document.getElementById('frRole').value.trim();
  const out = document.getElementById('frOut');
  if (!degree || !role){ out.innerHTML = '<p style="color:#ef4444">Degree and the role you are applying for are both needed.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'fresher-resume', site: 'careershield',
    degree: degree,
    college: document.getElementById('frCollege').value.trim(),
    year: document.getElementById('frYear').value.trim(),
    skills: document.getElementById('frSkills').value.trim(),
    projects: document.getElementById('frProjects').value.trim(),
    internships: document.getElementById('frInterns').value.trim(),
    targetRole: role,
    jd: document.getElementById('frJd').value.trim()
  }, 'frOut', 'Building your fresher resume…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('fresher');
}

/* ---------- MULTIPLE VERSIONS (AI tailor + local storage) ---------- */
const VER_KEY = 'cs_versions_v1';
const VER_MAX = 10;

function getVersions(){
  try {
    const v = JSON.parse(localStorage.getItem(VER_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch(e){ return []; }
}
function setVersions(list){
  try { localStorage.setItem(VER_KEY, JSON.stringify(list.slice(0, VER_MAX))); } catch(e){}
  renderVersions();
}
function renderVersions(){
  const box = document.getElementById('vList');
  if (!box) return;
  const list = getVersions();
  if (!list.length){
    box.innerHTML = '<p style="color:var(--faint);font-size:.8rem">No saved versions yet. Tailor a resume, then press “Save this version”.</p>';
    return;
  }
  box.innerHTML = '<div style="font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-bottom:8px">Saved versions (' + list.length + '/' + VER_MAX + ')</div>'
    + list.map(function(v){
        return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg2);border:1px solid var(--line);border-radius:11px;padding:10px 12px;margin-bottom:8px">'
          + '<div style="flex:1;min-width:150px"><div style="font-size:.86rem;font-weight:600">' + esc(v.label) + '</div>'
          + '<div style="font-size:.74rem;color:var(--faint)">' + esc(v.at) + ' · ' + v.text.length + ' chars</div></div>'
          + '<button class="btn btn-ghost btn-sm" data-act="loadVersion" data-id="' + esc(v.id) + '">Open</button>'
          + '<button class="btn btn-ghost btn-sm" data-act="delVersion" data-id="' + esc(v.id) + '">Delete</button>'
          + '</div>';
      }).join('');
}
function saveVersion(){
  const out = document.getElementById('vOut');
  const text = out ? out.innerText.trim() : '';
  if (!text || text.length < 20){
    out.innerHTML = '<p style="color:#f59e0b">Tailor a resume first, then save it.</p>';
    out.classList.add('show');
    return;
  }
  const role = document.getElementById('vRole').value.trim();
  const list = getVersions();
  list.unshift({
    id: String(Date.now()),
    label: role || 'Version ' + (list.length + 1),
    at: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    text: text.slice(0, 20000)
  });
  setVersions(list);
  out.innerHTML = '<p style="color:#86efac">Saved in this browser.</p>';
  out.classList.add('show');
}
function loadVersion(id){
  const v = getVersions().filter(function(x){ return x.id === id; })[0];
  if (!v) return;
  const out = document.getElementById('vOut');
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(v.text) + '</div>';
  out.classList.add('show');
  document.getElementById('versions').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function delVersion(id){
  setVersions(getVersions().filter(function(x){ return x.id !== id; }));
}

async function runTailor(){
  const resume = document.getElementById('vResume').value.trim();
  const jd = document.getElementById('vJd').value.trim();
  const role = document.getElementById('vRole').value.trim();
  const out = document.getElementById('vOut');
  if (!resume){ out.innerHTML = '<p style="color:#ef4444">Paste your resume text first.</p>'; out.classList.add('show'); return; }
  if (!jd){ out.innerHTML = '<p style="color:#ef4444">Paste the job description you are targeting.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'resume-tailor', site: 'careershield',
    resume: resume, jd: jd, role: role
  }, 'vOut', 'Tailoring your resume for this job…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('versions');
}

/* ---------- WHY NO INTERVIEW ---------- */
async function runNoInterview(){
  const resume = document.getElementById('niResume').value.trim();
  const out = document.getElementById('niOut');
  if (!resume){ out.innerHTML = '<p style="color:#ef4444">Paste your resume text so the diagnosis has something to work on.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'no-interview', site: 'careershield',
    resume: resume,
    role: document.getElementById('niRole').value.trim(),
    applications: document.getElementById('niApps').value.trim(),
    months: document.getElementById('niMonths').value.trim(),
    channels: document.getElementById('niChannels').value.trim(),
    jd: document.getElementById('niJd').value.trim()
  }, 'niOut', 'Reading your resume against your numbers…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('nointerview');
}

/* ---------- CAREER IMPROVEMENT PLAN ---------- */
async function runPlan(){
  const target = document.getElementById('plTarget').value.trim();
  const out = document.getElementById('plOut');
  if (!target){ out.innerHTML = '<p style="color:#ef4444">Which role are you aiming for?</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'career-plan', site: 'careershield',
    targetRole: target,
    currentRole: document.getElementById('plCurrent').value.trim(),
    experience: document.getElementById('plExp').value.trim(),
    skills: document.getElementById('plSkills').value.trim(),
    hours: document.getElementById('plHours').value.trim(),
    city: document.getElementById('plCity').value.trim(),
    lang: document.getElementById('plLang').value
  }, 'plOut', 'Building your 90-day plan…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('plan');
}

/* ---------- LINKEDIN OPTIMIZER ---------- */
async function runLinkedIn(){
  const target = document.getElementById('liTarget').value.trim();
  const exp = document.getElementById('liExp').value.trim();
  const out = document.getElementById('liOut');
  if (!target || !exp){ out.innerHTML = '<p style="color:#ef4444">The target role and your experience are both needed.</p>'; out.classList.add('show'); return; }

  const txt = await aiText({
    mode: 'linkedin-optimize', site: 'careershield',
    targetRole: target,
    headline: document.getElementById('liHeadline').value.trim(),
    about: document.getElementById('liAbout').value.trim(),
    experience: exp,
    skills: document.getElementById('liSkills').value.trim()
  }, 'liOut', 'Rewriting your profile…');

  if (txt === null) return;
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');
  showPdfBar('linkedin');
}

/* ---------- JOB APPLICATION TRACKER (browser only, no AI, no server) ---------- */
const APPS_KEY = 'cs_apps_v1';
const APPS_MAX = 500;
const TK_STATUS = ['Applied', 'No response', 'Callback', 'Interview', 'Offer', 'Rejected'];

function getApps(){
  try {
    const v = JSON.parse(localStorage.getItem(APPS_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch(e){ return []; }
}
function setApps(list){
  try { localStorage.setItem(APPS_KEY, JSON.stringify(list.slice(0, APPS_MAX))); } catch(e){}
  trackerRender();
}
function tkMsg(html, colour){
  const out = document.getElementById('tkOut');
  if (!out) return;
  out.innerHTML = '<p style="color:' + (colour || '#86efac') + '">' + html + '</p>';
  out.classList.add('show');
}

function trackerAdd(){
  track('tool_tracker_add');
  const company = document.getElementById('tkCompany').value.trim();
  const role = document.getElementById('tkRole').value.trim();
  const channel = document.getElementById('tkChannel').value;
  const date = document.getElementById('tkDate').value || new Date().toISOString().slice(0, 10);
  if (!company){ tkMsg('Company name is needed.', '#ef4444'); return; }

  const list = getApps();
  if (list.length >= APPS_MAX){
    tkMsg('That is ' + APPS_MAX + ' applications — export the file and start a fresh list.', '#f59e0b');
    return;
  }
  list.unshift({
    id: String(Date.now()),
    company: company.slice(0, 80),
    role: role.slice(0, 80),
    channel: channel,
    date: date,
    status: 'Applied'
  });
  setApps(list);
  document.getElementById('tkCompany').value = '';
  document.getElementById('tkRole').value = '';
  tkMsg('Added. ' + list.length + ' application' + (list.length === 1 ? '' : 's') + ' logged.');
}

function trackerSetStatus(id, status){
  const list = getApps();
  for (let i = 0; i < list.length; i++) if (list[i].id === id) list[i].status = status;
  setApps(list);
}

function trackerDelete(id){
  setApps(getApps().filter(function(x){ return x.id !== id; }));
  tkMsg('Entry removed.', '#f59e0b');
}

function trackerStats(){
  const list = getApps();
  const total = list.length;
  const replied = list.filter(function(x){ return x.status !== 'Applied' && x.status !== 'No response'; });
  const interviews = list.filter(function(x){ return x.status === 'Interview' || x.status === 'Offer'; });
  const offers = list.filter(function(x){ return x.status === 'Offer'; });

  const byChannel = {};
  list.forEach(function(x){
    const c = x.channel || 'Other';
    if (!byChannel[c]) byChannel[c] = { applied: 0, replied: 0 };
    byChannel[c].applied++;
    if (x.status !== 'Applied' && x.status !== 'No response') byChannel[c].replied++;
  });

  let months = 1;
  const dates = list.map(function(x){ return new Date(x.date).getTime(); }).filter(function(t){ return !isNaN(t); });
  if (dates.length){
    const days = Math.max(1, Math.round((Date.now() - Math.min.apply(null, dates)) / 86400000));
    months = Math.max(1, Math.round(days / 30));
  }

  return { list: list, total: total, replied: replied.length, interviews: interviews.length,
           offers: offers.length, byChannel: byChannel, months: months };
}

function trackerRender(){
  const statsEl = document.getElementById('tkStats');
  const listEl = document.getElementById('tkList');
  if (!statsEl || !listEl) return;

  const s = trackerStats();

  if (!s.total){
    statsEl.innerHTML = '<p style="color:var(--faint);font-size:.8rem">No applications logged yet. Add the first one above.</p>';
    listEl.innerHTML = '';
    return;
  }

  const rate = Math.round(s.replied / s.total * 100);
  const cells = [
    ['Logged', s.total],
    ['Replied', s.replied],
    ['Interviews', s.interviews],
    ['Offers', s.offers],
    ['Response rate', rate + '%']
  ];
  statsEl.innerHTML = '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + cells.map(function(c){
        return '<div style="flex:1;min-width:88px;background:var(--bg2);border:1px solid var(--line);border-radius:11px;padding:10px 12px">'
          + '<div style="font-size:1.25rem;font-weight:800">' + esc(String(c[1])) + '</div>'
          + '<div style="font-size:.72rem;color:var(--faint);text-transform:uppercase;letter-spacing:.1em">' + esc(c[0]) + '</div></div>';
      }).join('') + '</div>';

  const chans = Object.keys(s.byChannel).sort(function(a, b){ return s.byChannel[b].applied - s.byChannel[a].applied; });
  if (chans.length > 1){
    statsEl.innerHTML += '<div style="margin-top:10px;font-size:.8rem;color:var(--muted)">By channel: '
      + chans.map(function(c){
          const v = s.byChannel[c];
          return esc(c) + ' — ' + v.applied + ' sent, ' + v.replied + ' replied';
        }).join(' · ')
      + '</div>';
  }

  listEl.innerHTML = s.list.map(function(x){
    const opts = TK_STATUS.map(function(st){
      return '<option value="' + esc(st) + '"' + (st === x.status ? ' selected' : '') + '>' + esc(st) + '</option>';
    }).join('');
    return '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:var(--bg2);border:1px solid var(--line);border-radius:11px;padding:10px 12px;margin-bottom:8px">'
      + '<div style="flex:1;min-width:140px">'
        + '<div style="font-size:.88rem;font-weight:600">' + esc(x.company) + (x.role ? ' — ' + esc(x.role) : '') + '</div>'
        + '<div style="font-size:.74rem;color:var(--faint)">' + esc(x.channel) + ' · ' + esc(x.date) + '</div>'
      + '</div>'
      + '<select data-act="trackerStatus" data-id="' + esc(x.id) + '" style="max-width:150px;padding:8px 10px;font-size:.8rem">' + opts + '</select>'
      + '<button class="btn btn-ghost btn-sm" data-act="trackerDelete" data-id="' + esc(x.id) + '">Delete</button>'
      + '</div>';
  }).join('');
}

function trackerExport(){
  const s = trackerStats();
  if (!s.total){ tkMsg('Nothing to export yet.', '#f59e0b'); return; }
  const payload = {
    app: 'CareerShield',
    kind: 'job-applications',
    exported_at: new Date().toISOString(),
    count: s.total,
    applications: s.list
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'careershield-applications-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  tkMsg('Exported ' + s.total + ' applications. Keep that file safe — it is your backup.');
}

function trackerImport(input){
  const f = input.files && input.files[0];
  if (!f) return;
  if (f.size > 2 * 1024 * 1024){ tkMsg('That file is over 2 MB — not a CareerShield export.', '#ef4444'); input.value = ''; return; }

  const reader = new FileReader();
  reader.onload = function(){
    let data = null;
    try { data = JSON.parse(String(reader.result || '')); } catch(e){ data = null; }
    const rows = data && Array.isArray(data.applications) ? data.applications : (Array.isArray(data) ? data : null);
    if (!rows){ tkMsg('That file does not look like a CareerShield export.', '#ef4444'); input.value = ''; return; }

    const existing = getApps();
    const seen = {};
    existing.forEach(function(x){ seen[x.id] = true; });
    let added = 0;
    rows.forEach(function(r){
      if (!r || typeof r !== 'object' || !r.company) return;
      const id = String(r.id || Date.now() + '-' + added);
      if (seen[id]) return;
      seen[id] = true;
      existing.unshift({
        id: id,
        company: String(r.company).slice(0, 80),
        role: String(r.role || '').slice(0, 80),
        channel: String(r.channel || 'Other').slice(0, 40),
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(r.date || '')) ? r.date : new Date().toISOString().slice(0, 10),
        status: TK_STATUS.indexOf(r.status) > -1 ? r.status : 'Applied'
      });
      added++;
    });
    setApps(existing);
    tkMsg(added ? 'Imported ' + added + ' application' + (added === 1 ? '' : 's') + '.' : 'Nothing new in that file.', added ? '#86efac' : '#f59e0b');
    input.value = '';
  };
  reader.onerror = function(){ tkMsg('Could not read that file.', '#ef4444'); input.value = ''; };
  reader.readAsText(f);
}

function trackerToNoInterview(){
  const s = trackerStats();
  if (!s.total){ tkMsg('Log at least one application first.', '#f59e0b'); return; }
  const chans = Object.keys(s.byChannel).sort(function(a, b){ return s.byChannel[b].applied - s.byChannel[a].applied; });
  document.getElementById('niApps').value = String(s.total);
  document.getElementById('niMonths').value = String(s.months);
  document.getElementById('niChannels').value = chans.join(', ');
  document.getElementById('nointerview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  tkMsg('Filled your numbers into the No-Interview analysis below.', '#86efac');
}

/* ---------- AI INTERVIEW COACH (one question at a time) ---------- */
const COACH_TOTAL = 5;
let coachState = null;

function coachPick(txt, label){
  const m = String(txt || '').match(new RegExp('^' + label + '\\s*:\\s*(.+)$', 'im'));
  return m ? m[1].trim() : '';
}

function coachShowQuestion(){
  document.getElementById('coachSetup').style.display = 'none';
  document.getElementById('coachRun').style.display = 'block';
  document.getElementById('coachStep').textContent = 'Question ' + coachState.index + ' of ' + COACH_TOTAL;
  document.getElementById('coachQ').textContent = coachState.question;
  document.getElementById('coachA').value = '';
  document.getElementById('coachA').focus();
}

function coachReset(){
  coachState = null;
  const run = document.getElementById('coachRun');
  const setup = document.getElementById('coachSetup');
  if (run) run.style.display = 'none';
  if (setup) setup.style.display = 'block';
}

async function coachStart(){
  track('tool_coach_start');
  const role = document.getElementById('coachRole').value.trim();
  const out = document.getElementById('coachOut');
  if (!role){
    out.innerHTML = '<p style="color:#ef4444">Which role are you interviewing for?</p>';
    out.classList.add('show');
    return;
  }

  coachState = {
    role: role,
    level: document.getElementById('coachLevel').value,
    jd: document.getElementById('coachJd').value.trim(),
    index: 0,
    question: ''
  };

  const txt = await aiText({
    mode: 'interview-coach', site: 'careershield',
    role: coachState.role, level: coachState.level, jd: coachState.jd, index: 0
  }, 'coachOut', 'Preparing your first question…');

  if (txt === null){ coachState = null; return; }

  const q = coachPick(txt, 'QUESTION') || txt.trim();
  coachState.question = q;
  coachState.index = 1;
  out.innerHTML = '<p style="color:var(--muted);font-size:.85rem">Mock round started. Answer each question, and the next one comes after the feedback.</p>';
  out.classList.add('show');
  coachShowQuestion();
}

async function coachAnswer(){
  const answer = document.getElementById('coachA').value.trim();
  const out = document.getElementById('coachOut');
  if (!coachState) return;
  if (!answer){
    out.innerHTML = '<p style="color:#ef4444">Write your answer first.</p>';
    out.classList.add('show');
    return;
  }

  const st = coachState;
  const txt = await aiText({
    mode: 'interview-coach', site: 'careershield',
    role: st.role, level: st.level, index: st.index, question: st.question, answer: answer
  }, 'coachOut', 'Reading your answer…');

  if (txt === null) return;

  const nextQ = coachPick(txt, 'NEXT QUESTION');
  out.innerHTML = '<div style="white-space:pre-wrap;line-height:1.65">' + esc(txt) + '</div>';
  out.classList.add('show');

  if (st.index >= COACH_TOTAL || !nextQ){
    coachReset();
    showPdfBar('coach');
    return;
  }

  st.index += 1;
  st.question = nextQ;
  coachShowQuestion();
  document.getElementById('coachRun').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- FIRST-PARTY COUNTER ----------
   One row per page load in our own table (no cookies, IP stored as a hash).
   Vercel's own insights route answers 500 on this project, so we count here. */
function countHit(page, ref, device){
  try {
    // AI_BASE is declared further down, so it is read at call time, not now.
    const hitUrl = AI_BASE.replace('/functions/v1', '') + '/rest/v1/rpc/cs_hit';
    fetch(hitUrl, {
      method: 'POST', keepalive: true, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'apikey': AI_KEY, 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({ p_page: page, p_ref: ref, p_device: device })
    }).catch(function(){});
  } catch(e){}
}

function track(name, data){
  countHit('event:' + String(name) + (data && data.mode ? ':' + data.mode : ''), '', '');
}

/* ---------- SECURITY: single escape helper ---------- */
function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- SHARED AI CLIENT (CreatorMarket's ai-tools function) ---------- */
const AI_BASE = 'https://eqwmsjsqrhgyfpyssfop.supabase.co/functions/v1';
const AI_KEY  = 'sb_publishable_wYc_3ArDw5ghAcgYYxX_DA_LsrI4CsE';

async function callAI(payload){
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res;
  try {
    res = await fetch(AI_BASE + '/ai-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': AI_KEY, 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify(payload),
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
  }
  let data = {};
  try { data = await res.json(); } catch(e){}
  return { ok: res.ok, status: res.status, data };
}

const AI_MIN_GAP_MS = 1500;   // paid calls only now, so no long wait between steps
let lastAiAt = 0;

function paywallHtml(hasKey){
  track(hasKey ? 'paywall_pack_empty' : 'paywall_shown');
  if (hasKey){
    return '<div class="paywall"><p style="font-weight:700;margin-bottom:6px">Your pack is finished.</p>'
      + '<p style="color:var(--muted);font-size:.86rem;margin-bottom:10px">Get another pack to keep using the AI tools. The checks and the tracker stay free.</p>'
      + '<a class="btn btn-primary btn-sm" href="#pricing">See packs</a></div>';
  }
  return '<div class="paywall">'
    + '<p style="font-weight:700;margin-bottom:6px">This tool runs on AI credits.</p>'
    + '<p style="color:var(--muted);font-size:.86rem;margin-bottom:10px">Scam check, ATS check, job match, PDF reality check and the application tracker are free forever. '
    + 'The AI tools need a pack: ₹49 for 30 calls, one time, no subscription, no auto-renew.</p>'
    + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
    + '<a class="btn btn-primary btn-sm" href="#pricing">See packs</a>'
    + '<a class="btn btn-ghost btn-sm" href="#pricing">I already have a key</a>'
    + '</div></div>';
}

async function aiText(payload, outEl, busyLabel){
  const out = document.getElementById(outEl);
  // Every AI tool costs real money per call, so nothing AI runs without a pack.
  if (!licenceValid() || quotaLeft() <= 0){
    out.innerHTML = paywallHtml(licenceValid());
    out.classList.add('show');
    return null;
  }

  const now = Date.now();
  if (now - lastAiAt < AI_MIN_GAP_MS){
    const wait = Math.ceil((AI_MIN_GAP_MS - (now - lastAiAt)) / 1000);
    out.innerHTML = '<p style="color:#f59e0b">Please wait ' + wait + 's before the next AI request.</p>';
    out.classList.add('show');
    return null;
  }
  lastAiAt = now;
  out.innerHTML = '<p style="color:var(--muted)">' + busyLabel + '</p>';
  out.classList.add('show');
  try {
    // A licence key travels with the request: the server checks it and counts the call.
    const req = Object.assign({}, payload);
    const lic = getLicence();
    if (lic && lic.key && licenceValid()) req.licence = lic.key;

    const r = await callAI(req);
    if (!r.ok){
      const msg = (r.data && r.data.message) ? String(r.data.message) : '';
      if (r.status === 402 || r.status === 429){
        out.innerHTML = '<p style="color:#f59e0b">' + esc(msg || 'The AI service is busy. Please try again shortly.') + '</p>';
        return null;
      }
      out.innerHTML = '<p style="color:#f59e0b">The AI service is not available right now. '
        + esc(msg || ('Server returned ' + r.status + '.')) + '</p>';
      return null;
    }
    bumpQuota();
    track('ai_call', { mode: String(payload.mode || '') });

    // Keep the local count in step with the server's.
    if (lic && licenceValid() && r.data && r.data.remaining !== undefined){
      const next = Object.assign({}, lic);
      next.left = (r.data.remaining === null) ? null : Number(r.data.remaining);
      setLicence(next);
    }
    return r.data.content || '';
  } catch(e){
    out.innerHTML = '<p style="color:#ef4444">Could not reach the AI service. Check your connection and try again.</p>';
    return null;
  }
}

/* ---------- REALITY CHECK (pdf.js) ---------- */
let pdfText = '';
async function loadPdfJs(){
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = '/vendor/pdf.min.js';          // self-hosted, no third-party CDN
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.js';
  return window.pdfjsLib;
}

async function readPdf(){
  const f = document.getElementById('pdfFile').files[0];
  const out = document.getElementById('realityOut');
  if (!f) return;
  if (f.size > 2 * 1024 * 1024){ out.innerHTML = '<p style="color:#ef4444">PDF is over 2 MB. Please compress it first.</p>'; out.classList.add('show'); return; }
  out.innerHTML = '<p style="color:var(--muted)">Reading your PDF…</p>'; out.classList.add('show');
  try {
    const lib = await loadPdfJs();
    const buf = await f.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    if (pdf.numPages > 8){
      out.innerHTML = '<p style="color:#ef4444">This PDF has ' + pdf.numPages + ' pages. Please upload a resume of 8 pages or fewer.</p>';
      return;
    }
    let txt = '';
    for (let i = 1; i <= pdf.numPages; i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      txt += content.items.map(it => it.str).join(' ') + '\n';
      if (txt.length > 60000){ txt = txt.slice(0, 60000); break; }
    }
    pdfText = txt;
    out.innerHTML = `<p style="color:var(--green);font-weight:700">Read ${pdf.numPages} page(s), ${txt.trim().split(/\s+/).length} words.</p><p class="note">Now press "Read my resume" to see the full report.</p>`;
  } catch(e){
    out.innerHTML = '<p style="color:#ef4444">Could not read that PDF. It may be a scanned image — try a text-based PDF export.</p>';
  }
}

function runReality(){
  track('tool_pdf_reality');
  const out = document.getElementById('realityOut');
  const raw = pdfText;
  if (!raw || raw.trim().length < 50){
    out.innerHTML = '<p style="color:#ef4444">Upload a PDF first.</p>'; out.classList.add('show'); return;
  }
  const words = raw.trim().split(/\s+/).length;
  const checks = [];

  const email = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const phone = raw.replace(/[^0-9+]/g,'').match(/(\+91)?[6-9]\d{9}/);
  checks.push({ ok: !!email, label: 'Email address', detail: email ? email[0] : 'Not found — add a plain-text email on line 1.' });
  checks.push({ ok: !!phone, label: 'Phone number', detail: phone ? phone[0] : 'No Indian mobile number detected.' });

  const hasExp = /experience|employment|work history|professional experience/i.test(raw);
  const hasEdu = /education|qualification|academic/i.test(raw);
  const hasSkills = /skills|technical skills|core competencies/i.test(raw);
  checks.push({ ok: hasExp, label: 'Experience heading', detail: hasExp ? 'Standard label found.' : 'No standard "Experience" heading — parsers may skip this section.' });
  checks.push({ ok: hasEdu, label: 'Education heading', detail: hasEdu ? 'Standard label found.' : 'No standard "Education" heading found.' });
  checks.push({ ok: hasSkills, label: 'Skills heading', detail: hasSkills ? 'Standard label found.' : 'No "Skills" heading found.' });

  const dates = raw.match(/\b(19|20)\d{2}\b/g) || [];
  checks.push({ ok: dates.length >= 2, label: 'Dates readable', detail: dates.length >= 2 ? dates.length + ' year values found.' : 'Few or no years detected — check your date format.' });

  const hasTableChars = /[│┃┆┊]/.test(raw);
  const hasTabs = /\t{2,}/.test(raw);
  checks.push({ ok: !hasTableChars && !hasTabs, label: 'No table or column artefacts', detail: (hasTableChars || hasTabs) ? 'Table/column characters found — many parsers scramble these.' : 'Clean single-column flow detected.' });

  const bullets = (raw.match(/[•·▪◦‣]/g) || []).length;
  checks.push({ ok: true, label: 'Bullet characters', detail: bullets + ' bullet glyphs found.' + (bullets === 0 ? ' Using plain hyphens is safer.' : '') });

  const passed = checks.filter(c => c.ok).length;
  const cls = passed >= 7 ? 'risk-low' : passed >= 5 ? 'risk-mid' : 'risk-high';
  const label = passed >= 7 ? 'READS WELL' : passed >= 5 ? 'NEEDS WORK' : 'PARSING RISK';

  out.innerHTML = `
    <div class="risk ${cls}">
      <div class="score">${passed}/${checks.length}</div>
      <div><div style="font-weight:800">${label}</div><div class="lbl">${words} words read from your PDF across the checks below.</div></div>
    </div>
    <ul class="flags">
      ${checks.map(c => `<li class="${c.ok?'ok':'bad'}"><strong>${esc(c.label)}</strong> — ${esc(c.detail)}</li>`).join('')}
    </ul>
    <p class="note">This shows what a parser can read, not an employer's score. Different systems behave differently.</p>`;
  out.classList.add('show');
  showPdfBar('reality');
}


/* ---------- PDF EXPORT ---------- */
let lastSection = null;
function showPdfBar(sectionId){
  lastSection = sectionId;
  const bar = document.getElementById('pdfbar');
  bar.style.display = 'flex';
  document.body.style.paddingBottom = '84px';
}
/* Builds a clean A4 sheet: brand line, tool name, date, the report itself,
   the honesty note, and a footer that only the free version carries. */
function buildPrintSheet(sectionId){
  const sec = document.getElementById(sectionId);
  const sheet = document.getElementById('printSheet');
  if (!sec || !sheet) return '';

  const h2 = sec.querySelector('h2');
  const out = sec.querySelector('.out');
  const note = sec.querySelector('.note');
  const title = h2 ? h2.textContent.replace(/[^\x20-\x7E]/g, '').trim() : 'Report';
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Everything below prints on white paper, so the screen's CSS variables are
  // swapped for light-theme colours before the sheet is written.
  const wrap = document.createElement('div');
  if (sectionId === 'tracker'){
    const statsEl = document.getElementById('tkStats');
    const listEl = document.getElementById('tkList');
    wrap.innerHTML = (statsEl ? statsEl.innerHTML : '') + (listEl ? listEl.innerHTML : '');
    Array.prototype.forEach.call(wrap.querySelectorAll('select'), function(sel){
      const span = document.createElement('span');
      span.textContent = sel.selectedIndex > -1 ? sel.options[sel.selectedIndex].text : '';
      span.setAttribute('style', 'font-size:9.5pt;color:#43536e');
      if (sel.parentNode) sel.parentNode.replaceChild(span, sel);
    });
    Array.prototype.forEach.call(wrap.querySelectorAll('button'), function(btn){ btn.remove(); });
  } else {
    wrap.innerHTML = out ? out.innerHTML : '';
  }

  const LIGHT = {
    '--bg2': '#f5f7fa', '--line': '#d7dee9', '--faint': '#43536e', '--muted': '#43536e',
    '--ink': '#0b1220', '--green': '#166534', '--red': '#991b1b', '--amber': '#92400e'
  };
  Array.prototype.forEach.call(wrap.querySelectorAll('[style]'), function(el){
    let st = el.getAttribute('style') || '';
    if (st.indexOf('var(') === -1) return;
    Object.keys(LIGHT).forEach(function(v){ st = st.split('var(' + v + ')').join(LIGHT[v]); });
    el.setAttribute('style', st);
  });
  const bodyHtml = wrap.innerHTML;

  sheet.innerHTML =
    '<div class="ps-head"><div class="ps-brand">CareerShield</div>'
      + '<div class="ps-date">' + esc(today) + '</div></div>'
    + '<h1 class="ps-title">' + esc(title) + '</h1>'
    + '<div class="ps-body">' + bodyHtml + '</div>'
    + (note ? '<div class="ps-note">' + esc(note.textContent.trim()) + '</div>' : '')
    + '<div class="ps-foot">careershield.vercel.app'
      + (licenceValid() ? '' : ' · Free version')
      + '</div>';
  return title;
}

function savePdf(){
  track('pdf_export');
  const title = buildPrintSheet(lastSection);
  if (!title) return;

  const prevTitle = document.title;
  const stamp = new Date().toLocaleDateString('en-GB').split('/').reverse().join('-');
  document.title = 'CareerShield - ' + title + ' - ' + stamp;

  window.print();

  setTimeout(function(){
    document.title = prevTitle;
    const sheet = document.getElementById('printSheet');
    if (sheet) sheet.innerHTML = '';
  }, 1200);
}


/* ---------- LICENCE (localStorage, no login) ---------- */
const LIC_KEY = 'cs_licence_v1';

function getLicence(){
  try { return JSON.parse(localStorage.getItem(LIC_KEY) || 'null'); } catch(e){ return null; }
}
function setLicence(obj){
  try { localStorage.setItem(LIC_KEY, JSON.stringify(obj)); } catch(e){}
  paintLicence();
}
function licenceValid(){
  const l = getLicence();
  if (!l || !l.key) return false;
  if (l.expires && Date.now() > l.expires) return false;
  return true;
}
function paintLicence(){
  const bar = document.getElementById('licBar');
  const txt = document.getElementById('licBarText');
  if (!bar || !txt) return;
  const l = getLicence();
  if (licenceValid()){
    const d = new Date(l.expires).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    txt.textContent = 'Pro active — ' + (l.calls === 'unlimited' ? 'unlimited AI'
      : (typeof l.left === 'number' ? l.left + ' AI calls left' : l.calls + ' AI calls')) + ' · valid till ' + d;
    bar.style.display = 'block';
  } else {
    bar.style.display = 'none';
  }
}

// Licence key format: CS-XXXX-XXXX-XXXX  (checksum like Maasathi)
function keyValid(k){
  const clean = String(k || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^CS[0-9A-Z]{16}$/.test(clean)) return false;
  const body = clean.slice(2, 14);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += body.charCodeAt(i) * (i + 7);
  const expected = (sum * 7919 % 1679616).toString(36).toUpperCase().padStart(4, '0').slice(0, 4);
  return clean.slice(14) === expected;
}

async function applyLicence(){
  const raw = document.getElementById('licInput').value.trim();
  const out = document.getElementById('licOut');
  if (!raw){ out.innerHTML = '<p style="color:#ef4444">Paste your key first.</p>'; out.classList.add('show'); return; }
  if (!keyValid(raw)){
    out.innerHTML = '<p style="color:#ef4444">That key is not valid. Check for a missing character.</p>';
    out.classList.add('show');
    return;
  }

  out.innerHTML = '<p style="color:var(--muted)">Checking this key…</p>';
  out.classList.add('show');

  const ok = await activateKey(raw);
  if (!ok){
    out.innerHTML = '<p style="color:#ef4444">That key is not recognised. If you just paid, email '
      + 'creatormarket.support@gmail.com with your payment reference.</p>';
    out.classList.add('show');
    return;
  }

  const l = getLicence() || {};
  out.innerHTML = '<p style="color:var(--green);font-weight:700">Pro activated. Thank you.</p>'
    + (l.offline ? '<p class="note">We could not reach the server just now, so this is a temporary activation. It will be checked again on your next AI request.</p>' : '');
  out.classList.add('show');
}

/* ---------- AI QUOTA: no free AI calls, a pack is required ---------- */
const QUOTA_KEY = 'cs_quota_v1';
const FREE_PER_DAY = 0;

function todayStr(){ return new Date().toISOString().slice(0, 10); }
function getQuota(){
  try {
    const q = JSON.parse(localStorage.getItem(QUOTA_KEY) || 'null');
    if (!q || q.day !== todayStr()) return { day: todayStr(), used: 0 };
    return q;
  } catch(e){ return { day: todayStr(), used: 0 }; }
}
function bumpQuota(){
  const q = getQuota();
  q.used += 1;
  try { localStorage.setItem(QUOTA_KEY, JSON.stringify(q)); } catch(e){}
}
function quotaLeft(){
  if (licenceValid()){
    const l = getLicence();
    if (l.calls === 'unlimited') return Infinity;
    // the server's count wins whenever we have one
    if (typeof l.left === 'number') return Math.max(0, l.left);
    return l.used === undefined ? l.calls : Math.max(0, l.calls - (l.used || 0));
  }
  return Math.max(0, FREE_PER_DAY - getQuota().used);
}


/* Server-side check. A key only counts if the server has a record of it, so a
   key generated in the browser console gets nothing. */
async function verifyLicence(clean){
  try {
    const res = await fetch(PAY_BASE + '/careershield-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': AI_KEY, 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({ action: 'verify', key: clean })
    });
    const d = await res.json().catch(function(){ return {}; });
    if (res.ok && d.ok) return { ok: true, data: d };
    if (res.status === 400 || res.status === 404) {
      return { ok: false, reason: 'unknown', message: d.message || 'That key is not recognised.' };
    }
    return { ok: false, reason: 'network', message: d.message || 'Could not check that key right now.' };
  } catch(e){
    return { ok: false, reason: 'network', message: 'Could not reach the server to check that key.' };
  }
}

async function activateKey(raw){
  const clean = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!keyValid(clean)) return false;

  const v = await verifyLicence(clean);
  if (!v.ok && v.reason === 'unknown') return false;

  if (v.ok){
    track('licence_activated');
    setLicence({
      key: clean,
      tier: v.data.tier || v.data.plan,
      calls: v.data.calls === null || v.data.calls === undefined ? 'unlimited' : v.data.calls,
      left: v.data.remaining === undefined ? null : v.data.remaining,
      expires: v.data.expires ? new Date(v.data.expires).getTime() : Date.now() + 365*24*60*60*1000,
      offline: false
    });
    return true;
  }

  // Server unreachable: let the customer in, the first AI call still checks the key.
  setLicence({
    key: clean, tier: clean[2],
    calls: clean[2] === 'P' ? 'unlimited' : clean[2] === 'S' ? 120 : 30,
    left: null, expires: Date.now() + 365*24*60*60*1000, offline: true
  });
  return true;
}

function copyKey(el){
  const k = el.getAttribute('data-key') || '';
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(k).then(function(){ el.textContent = 'Copied'; },
      function(){ el.textContent = 'Copy'; });
  } else { el.textContent = k; }
}

/* Claims the licence key for a paid Razorpay payment. Retries because
   capture can lag a second or two behind the checkout callback. */
async function claimKey(paymentId, plan){
  for (let i = 0; i < 4; i++){
    try {
      const res = await fetch(PAY_BASE + '/careershield-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': AI_KEY, 'Authorization': 'Bearer ' + AI_KEY },
        body: JSON.stringify({ action: 'claim', payment_id: paymentId, plan: plan })
      });
      const d = await res.json();
      if (res.ok && d.key) return d;
      if (res.status === 400 || res.status === 404) return null;
    } catch(e){}
    await new Promise(function(r){ setTimeout(r, 1500); });
  }
  return null;
}


/* ---------- REVIEWS ---------- */
const SUPA_REST = 'https://eqwmsjsqrhgyfpyssfop.supabase.co/rest/v1';
let revRating = 0;
let revLast = 0;

function starStr(n){
  const k = Math.max(0, Math.min(5, Math.round(n)));
  return '★★★★★'.slice(0, k) + '☆☆☆☆☆'.slice(0, 5 - k);
}

(function initRating(){
  const box = document.getElementById('revRate');
  if (!box) return;
  box.addEventListener('click', function(e){
    const b = e.target.closest('button');
    if (!b) return;
    revRating = Number(b.getAttribute('data-v')) || 0;
    Array.prototype.forEach.call(box.children, function(x){
      x.classList.toggle('on', Number(x.getAttribute('data-v')) <= revRating);
    });
  });
})();

async function loadReviews(){
  const grid = document.getElementById('revGrid');
  const stats = document.getElementById('revStats');
  if (!grid) return;
  let rows = [];
  try {
    const r = await fetch(SUPA_REST + '/site_reviews?select=name,rating,comment,created_at&site=eq.careershield&approved=eq.true&order=created_at.desc&limit=24', {
      headers: { 'apikey': AI_KEY, 'Authorization': 'Bearer ' + AI_KEY }
    });
    if (r.ok) rows = await r.json();
  } catch(e){}

  if (!Array.isArray(rows) || rows.length === 0){
    grid.innerHTML = '<div class="rev-empty"><strong>No reviews yet.</strong><br>You could be the first — the form is just below.</div>';
    if (stats) stats.innerHTML = '';
    return;
  }

  const avg = rows.reduce(function(s, x){ return s + (Number(x.rating) || 0); }, 0) / rows.length;
  if (stats){
    stats.innerHTML = '<div class="rev-avg">' + avg.toFixed(1) + '</div>'
      + '<div><div class="rev-stars">' + starStr(avg) + '</div>'
      + '<div class="rev-count">' + rows.length + (rows.length === 1 ? ' review' : ' reviews') + '</div></div>';
  }

  grid.innerHTML = rows.map(function(x){
    const d = new Date(x.created_at);
    const when = isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
    return '<div class="rev-card">'
      + '<div class="who"><span>' + esc(x.name || 'Anonymous') + '</span><span class="when">' + esc(when) + '</span></div>'
      + '<div class="stars">' + starStr(Number(x.rating) || 0) + '</div>'
      + '<p>' + esc(x.comment || '') + '</p></div>';
  }).join('');
}

async function sendReview(){
  const msg = document.getElementById('revMsg');
  const name = (document.getElementById('revName').value || '').trim();
  const text = (document.getElementById('revText').value || '').trim();

  if (Date.now() - revLast < 60000){
    msg.style.color = 'var(--amber)';
    msg.textContent = 'Please wait a minute before posting another review.';
    return;
  }
  if (name.length < 2){ msg.style.color = 'var(--red)'; msg.textContent = 'Please add your first name.'; return; }
  if (!revRating){ msg.style.color = 'var(--red)'; msg.textContent = 'Pick a star rating.'; return; }
  if (text.length < 10){ msg.style.color = 'var(--red)'; msg.textContent = 'Please write at least 10 characters.'; return; }

  const btn = document.getElementById('revSend');
  btn.disabled = true;
  msg.style.color = 'var(--muted)';
  msg.textContent = 'Posting…';

  try {
    const r = await fetch(SUPA_REST + '/site_reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': AI_KEY,
        'Authorization': 'Bearer ' + AI_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ site: 'careershield', name: name.slice(0, 40), rating: revRating, comment: text.slice(0, 600) })
    });
    if (!r.ok){
      msg.style.color = 'var(--red)';
      msg.textContent = 'Could not post the review. Please try again later.';
    } else {
      revLast = Date.now();
      document.getElementById('revName').value = '';
      document.getElementById('revText').value = '';
      revRating = 0;
      Array.prototype.forEach.call(document.getElementById('revRate').children, function(x){ x.classList.remove('on'); });
      msg.style.color = 'var(--green)';
      msg.textContent = 'Thank you. Your review will appear once it is checked.';
    }
  } catch(e){
    msg.style.color = 'var(--red)';
    msg.textContent = 'Could not reach the server. Check your connection.';
  }
  btn.disabled = false;
}

/* ---------- RAZORPAY ---------- */
const PAY_BASE = 'https://eqwmsjsqrhgyfpyssfop.supabase.co/functions/v1';

async function buy(plan){
  track('buy_click', { plan: String(plan || '') });
  const out = document.getElementById('licOut');
  if (out){ out.innerHTML = '<p style="color:var(--muted)">Opening secure checkout…</p>'; out.classList.add('show'); }

  let data;
  try {
    const res = await fetch(PAY_BASE + '/careershield-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': AI_KEY, 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({ action: 'order', plan: plan, site: 'careershield' })
    });
    data = await res.json();
    if (!res.ok){
      if (out){
        out.innerHTML = '<p style="color:#f59e0b">Payments are not switched on yet. '
          + (data && data.message ? data.message : 'The server returned ' + res.status + '.') + '</p>';
        out.classList.add('show');
      }
      return;
    }
  } catch(e){
    if (out){ out.innerHTML = '<p style="color:#ef4444">Could not reach the payment server. Check your connection.</p>'; out.classList.add('show'); }
    return;
  }

  if (typeof Razorpay === 'undefined'){
    if (out){ out.innerHTML = '<p style="color:#ef4444">Checkout could not load. Disable your ad blocker and try again.</p>'; out.classList.add('show'); }
    return;
  }

  const label = plan === 'quick' ? 'Quick Pack' : plan === 'starter' ? 'Career Starter' : 'Career Pro';

  const rzp = new Razorpay({
    key: data.key_id,
    order_id: data.order_id,
    amount: data.amount,
    currency: data.currency,
    name: 'CareerShield',
    description: label + ' — one time, no auto-renew',
    theme: { color: '#22c55e' },
    handler: async function (r){
      if (out){
        out.innerHTML = '<p style="color:var(--muted)">Payment received. Creating your license key…</p>';
        out.classList.add('show');
      }
      const d = await claimKey(r.razorpay_payment_id, plan);
      const activated = (d && d.key) ? await activateKey(d.key) : false;
      if (d && d.key && activated){
        if (out){
          out.innerHTML = '<div class="risk risk-low"><div class="score">OK</div><div>'
            + '<div style="font-weight:800">You are all set — ' + esc(d.label) + '</div>'
            + '<div class="lbl" style="margin:6px 0 8px">This key is already active on this browser. '
            + 'Save it so you can use it on another device:</div>'
            + '<div style="font-family:monospace;font-size:16px;font-weight:800;letter-spacing:.5px;'
            + 'background:#0b1220;color:#86efac;border-radius:8px;padding:10px 12px;text-align:center">'
            + esc(d.key) + '</div>'
            + '<button class="btn" style="margin-top:8px" data-key="' + esc(d.key) + '" '
            + 'data-act="copyKey">Copy key</button>'
            + '</div></div>';
          out.classList.add('show');
        }
      } else if (out){
        out.innerHTML = '<div class="risk risk-low"><div class="score">OK</div><div>'
          + '<div style="font-weight:800">Payment received</div>'
          + '<div class="lbl">Reference ' + esc(r.razorpay_payment_id) + '. '
          + 'We could not create your key automatically. Email '
          + 'creatormarket.support@gmail.com with this reference and we will send it within a few hours.</div></div></div>';
        out.classList.add('show');
      }
    },
    modal: {
      ondismiss: function (){
        if (out){ out.innerHTML = '<p style="color:var(--muted)">Checkout closed. Nothing was charged.</p>'; out.classList.add('show'); }
      }
    }
  });
  rzp.open();
}

paintLicence();

buildScamQs();

renderVersions();

(function countPageView(){
  const ref = document.referrer ? (function(){ try { return new URL(document.referrer).hostname; } catch(e){ return ''; } })() : '';
  const dev = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? (/iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'mobile') : 'desktop';
  countHit(location.pathname || '/', ref, dev);
})();

(function initTracker(){
  const d = document.getElementById('tkDate');
  if (d && !d.value) d.value = new Date().toISOString().slice(0, 10);
  trackerRender();
})();

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', loadReviews);
} else {
  loadReviews();
}
/* ---------- CLICK DISPATCHER ----------
   No inline handlers anywhere: every control carries data-act, so the page can
   run under a Content-Security-Policy without 'unsafe-inline'. */
(function(){
  function closestAct(node){
    while (node && node !== document) {
      if (node.getAttribute && node.getAttribute('data-act')) return node;
      node = node.parentNode;
    }
    return null;
  }

  document.addEventListener('click', function(e){
    const el = closestAct(e.target);
    if (!el || el.disabled) return;
    const act = el.getAttribute('data-act');
    const id = el.getAttribute('data-id');
    const val = el.getAttribute('data-val');
    const plan = el.getAttribute('data-plan');

    if (act === 'buy') return buy(plan);
    if (act === 'pick') return pick(id, val, el);
    if (act === 'copyKey') return copyKey(el);
    if (act === 'pickFile'){ const f = document.getElementById('tkFile'); if (f) f.click(); return; }
    if (act === 'trackerDelete') return trackerDelete(id);
    if (act === 'loadVersion') return loadVersion(id);
    if (act === 'delVersion') return delVersion(id);

    const fn = window[act];
    if (typeof fn === 'function') fn(el);
  });

  document.addEventListener('change', function(e){
    const el = closestAct(e.target);
    if (!el) return;
    const act = el.getAttribute('data-act');
    if (act === 'trackerImport') return trackerImport(el);
    if (act === 'trackerStatus') return trackerSetStatus(el.getAttribute('data-id'), el.value);
    if (act === 'readPdf') return readPdf();
  });
})();
