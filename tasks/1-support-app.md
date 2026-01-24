# 1. Support app
1. Assign testing of the support app to Touseef (his estimate was 4 hours) and Abdullah (he has already done testing in the past but we should include it as history anyway)
2. Fix the bugs that will be reported after Touseef is done testing.
3. Fix the two bugs that are in failed testing stage:
### Bug Report: Data is not shoiwng correctly in drop down, list and details view (Our ETA: 30 mins for the fix, it then needs to be tested again)
- **ID:** c708bfec-a7ba-4397-ada4-24cd78680d51
- **URL:** https://me.pullstream.com/support/ai-performance-feedbacks

#### Steps to Reproduce
1- Support App -> AI & Automation -> Ai Performance Feedbacks -> Add record
2- Drop down AI Classification Result field
3- Select "2026-01-30T01:30:32.000Z" and fill in all other field -> Save

#### Expected Result
The AI Classification Result dropdown should display the same user-friendly formatted timestamp used in the AI Classification Results list view (e.g., MM/DD/YYYY HH:MM AM/PM), not the raw UTC ISO value. This ensures users can correctly identify and select the intended record.
After saving the record, the list and details view should display the selected AI Classification Result value properly instead of showing (...). The referenced record should appear consistently and clearly in both views.

#### Actual Result
When adding a record in Support App → AI & Automation → AI Performance Feedbacks, the AI Classification Result dropdown displays values such as 2026-01-30T01:30:32.000Z, which do not match the formatted timestamp shown in the AI Classification Results model (e.g., 01/30/2026 06:30 AM). This creates inconsistency between what users see in the source model and what appears in the dropdown.

Additionally, after saving the new Performance Feedback record, the newly created record does not display correctly in the list or detail view; instead of showing the selected value, it displays (...) or blank placeholders, indicating that the reference value is not rendering properly.

---

### Bug Report: Form flows is listed with only one form (No idea about the ETA yet)
- **ID:** 970cb0f6-fed9-4d9f-af44-4b8870e90b58
- **URL:** https://me.pullstream.com/support/ff/knowledge-articles

#### Steps to Reproduce
Same bug at the pages below:
https://me.pullstream.com/support/ff/support-agent-profiles
https://me.pullstream.com/support/ff/autonomy-configurations
https://me.pullstream.com/support/ff/bug-reports

1. Open the Support app from the sidebar drawer menu.
2. Click on Form Flows.
3. Open the Knowledge Articles form flow.

#### Expected Result
Form Flows menu shows entries that have only one form. Support Agent Profiles, Autonomy Configurations, and Bug Reports appear even though each page shows only a single form.

#### Actual Result
Form Flows menu should only show entries that have more than one form. Any form flow with only one form should not appear in the menu. Users should see only form flows that contain multiple forms.