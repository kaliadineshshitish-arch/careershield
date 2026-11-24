# CareerShield

Free tools for Indian job seekers. No signup, no card, no data stored.

## Tools
1. **Job Offer Red Flag Check** — 7-question scam pattern checker (flagship)
2. **ATS Reality Check** — keyword + parsing issues vs a job description
3. **Job Match Score** — same engine, section view
4. **Resume Reality Check** — pdf.js parse check on an uploaded PDF
5. **Resume Repair** — AI bullet rewrite (mode: `repair`)
6. **AI Achievement Writer** — duty → 3 achievement lines (mode: `achievement`)
7. **AI Cover Letter** — per-job letter, English/Hindi/Hinglish (mode: `cover-letter`)
8. **Hindi ⇄ English Converter** — 4 directions, tools stay in English (mode: `career-translate`)
9. **Career Gap Assistant** — resume line + interview answer for a gap (mode: `career-gap`)
10. **Fresher Resume Expert** — one-page fresher skeleton with [ADD:] slots (mode: `fresher-resume`)
11. **Multiple Job Resume Versions** — per-job tailoring + versions saved in localStorage (mode: `resume-tailor`)
12. **Why No Interview Analysis** — diagnosis from resume + application numbers (mode: `no-interview`)
13. **PDF export** — print the current report

All AI modes are served by the shared Supabase edge function `ai-tools`
(project `eqwmsjsqrhgyfpyssfop`), which calls Sarvam AI. Free tier is 3 AI
calls per day per browser; paid packs add more via a licence key.

## Privacy
The client-side checks (scam, ATS, match, PDF parsing) run entirely in the
browser. AI tools send only the text the user pastes to the `ai-tools`
function. Nothing is written to a database.

## Status
- [x] Scam checker (client-side)
- [x] ATS / Job match engine (client-side)
- [x] PDF reality check (pdf.js)
- [x] Resume Repair AI (Sarvam, via ai-tools)
- [x] Achievement Writer AI
- [x] Cover Letter AI
- [x] Hindi ⇄ English converter
- [x] PDF export
- [x] Razorpay checkout + licence keys
- [x] Career Gap Assistant
- [x] Fresher Resume Expert
- [x] Multiple Job Resume Versions (localStorage)
- [x] Why No Interview Analysis
- [ ] Career Improvement Plan
- [ ] AI Interview Coach, LinkedIn Optimizer, Job Application Tracker
