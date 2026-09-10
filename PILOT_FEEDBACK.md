# Auto Rejoin Pro — Pilot Feedback Form (Phase 5C)

Thank you for participating in the **Auto Rejoin Pro** Pilot Program. Your operational experience helps us refine stability, ergonomics, and clarity before public commercial launch.

---

## 📋 Pilot Participant Details (No Personal Information)

- **Participant Code**: `[PILOT-01 / PILOT-02 / PILOT-03 / PILOT-04 / PILOT-05]`
- **Device Model & OS**: `[e.g. UGPhone Android 10 / Xiaomi Redmi Note 10 Root]`
- **Execution Mode**: `[Root (su) / ADB / Termux direct]`
- **Roblox Version Tested**: `[Official / Dual App Clone / APK]`
- **Observation Duration**: `[e.g. 24h / 48h / 72h]`

---

## 📝 Evaluation Questionnaire

### 1. Installation & Initial Setup
- **Was the installation process clear and straightforward?**
  - [ ] Yes, installed on first attempt without issues
  - [ ] Minor confusion (explain below)
  - [ ] Failed / required manual interventions
  *Notes:*

- **Did `roblox-manager doctor` help identify system state or missing tools?**
  - [ ] Yes, clear PASS/WARN summary
  - [ ] No / didn't use doctor
  - [ ] Confusing output (explain below)
  *Notes:*

### 2. License & Account Ergonomics
- **Was the license activation process clear?**
  - [ ] Very easy (`roblox-manager license activate`)
  - [ ] Difficult / unclear error messages
  *Notes:*

- **Did you encounter any unexpected license deactivation or lockout?**
  - [ ] No, worked smoothly throughout test window
  - [ ] Yes (please provide sanitized logs)
  *Notes:*

### 3. Detection & Join Stability
- **Did Auto Rejoin Pro correctly detect your Roblox game link and package?**
  - [ ] Yes, parsed accurately
  - [ ] Needed manual configuration in `config.env`
  *Notes:*

- **Did auto rejoin successfully recover when Roblox crashed or closed?**
  - [ ] Yes, rejoins worked consistently within cooldown limits
  - [ ] Rejoin failed or hung
  *Notes:*

- **Did you observe any "false rejoins" (rejoining when game was still actively running)?**
  - [ ] Never observed false rejoins
  - [ ] Observed occasionally (explain below)
  *Notes:*

### 4. Network & Update Experience
- **How did the tool behave during temporary network drops or disconnects?**
  - [ ] Paused gracefully and resumed once online
  - [ ] Threw errors or entered crash loop
  *Notes:*

- **Did you test updating via `roblox-manager update`?**
  - [ ] Yes, update applied cleanly with zero downtime
  - [ ] Encountered error during update
  - [ ] Did not test update
  *Notes:*

### 5. Diagnostics & Support
- **If used, was `roblox-manager support-bundle` easy to generate and share?**
  - [ ] Yes, generated cleanly
  - [ ] Experienced errors
  *Notes:*

- **Were there any confusing error messages or log outputs in the terminal?**
  *Details:*

### 6. Overall Readiness & Trust
- **Would you trust Auto Rejoin Pro to run completely unattended 24/7 on your farming accounts?**
  - [ ] Yes, 100% confidence
  - [ ] Mostly yes, but needs minor improvements
  - [ ] No, not yet reliable enough
  *Notes:*

- **Any feature suggestions or UX improvements before commercial launch?**
  *Suggestions:*
