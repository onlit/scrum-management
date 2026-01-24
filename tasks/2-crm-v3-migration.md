# 2. CRM Migration from V2 to V3
- Assign the 15 bugs in Ready for Prod Testing stage to Touseef and Abdullah
- Analyze all controllers in CRM V2 API `/home/rover/pullstream/monorepos/1000-sme-sprint-plan/crm-v2-rapi/src/controllers` to identify business logic then port to CRM V3 RAPI via the extension guide: `/home/rover/pullstream/monorepos/1000-sme-sprint-plan/crm-v3-rapi/docs/EXTENSION_GUIDE.md` and intercepters `/home/rover/pullstream/monorepos/1000-sme-sprint-plan/crm-v3-rapi/src/domain/interceptors`
5: Analyze the documented differences and implement front end business logic and get it tested.
6: Investigate the search_vector fields and how they should be integrated in crm-v3.
7: Attend to all crm-v3 reported bugs.
8: Verify that the routes  for crm-v2 and crm-v3 are the same.
9: Clean up all crm-v2 code from microfe
10: Copy all crm-v2 data to crm-v3 and switch off crm-v2
11: Update INAs kanban with crm-v3
12: Update opportunity kanban with crm-v3
13: Deal with crm dependencies in Automata
14: Update all 13 compute generated apps to point to CRM V3 instead of V2; regenerate, and test
15: Discuss and plan with Hamza (another software engineer) how to deal with the dependencies of the CRM after switch of other apps than compute generated or automata and document tasks.

- Port the front-end business logic from CRM V2 `/home/rover/pullstream/monorepos/1000-sme-sprint-plan/ps-admin-microfe/apps/crm-v2/src/pages/` to CRM V3 `/home/rover/pullstream/monorepos/1000-sme-sprint-plan/ps-admin-microfe/packages/entity-core/src/crm-v2/`

- The differences were documented in form of bug reports:
## Bug Report: Page is not loading correctly
- **ID:** 0f027aa9-36c8-4657-b641-75a37f65e54d
- **URL:** https://me.pullstream.com/crm-v3/sales-people

### Steps to Reproduce
1- CRM V3 App -> Sales Person

### Expected Result
The Sales Person page in CRM V3 App should load correctly without any errors, allowing users to view, add, and manage Sales Person records as expected.

### Actual Result
Although the Sales Person page initially loads, it returns an error stating “Entity type not found. The entity type ‘undefined’ does not exist.”, which prevents proper usage of the Sales Person model.

---

## Bug Report: Details view in CRM V3 is not matching with CRM V2
- **ID:** 18053f60-0829-4dc9-95fb-256b02b8ecf5
- **URL:** https://me.pullstream.com/crm-v3/clients/dd6773e5-b619-49ea-accf-083fb4478724

### Steps to Reproduce
3- CRM V3 App -> Opportunity -> Client page -> Click on Company Contact column to go to details view

### Expected Result
On the Client page within the Opportunity module, clicking the Company Contact column should open the details page for the selected Company Contact, matching the behavior in CRM V2. The Company Contact value should act as a link that takes the user directly to the corresponding contact’s profile, allowing users to review or update contact information efficiently.

### Actual Result
In CRM V3, when the user clicks the Company Contact column on the Client page, the system opens the Client’s detail page instead of the Company Contact’s detail page. The link behavior is mapped to the a different entity, causing navigation to point to the client record rather than the contact record.

---

## Bug Report: Procsess Record functionality is missing in CRM V3
- **ID:** f25f3950-85a1-4300-bca1-bdafe2b2b6bf
- **URL:** https://me.pullstream.com/crm-v3/marketing-lists/6c6bfe61-d86b-43a1-ba4d-56636d247055

### Steps to Reproduce
1- CRM V3 App -> Marketing List
2- Click on Name column to go to details view
3- Click on Person In Marketing List tab

### Expected Result
In the CRM V3 App under Marketing List details view, the Person In Marketing List tab should include the “Process Records” button as seen in CRM V2. This button should enable users to efficiently process records within the tab, maintaining consistent functionality across CRM versions and improving user productivity.

### Actual Result
In the CRM V3 App under Marketing List details view, within the Person In Marketing List tab, the “Process Records” button is missing. This button is available in CRM V2 but absent in V3, limiting users’ ability to process records directly from this tab and reducing functionality compared to the previous version.

---

## Bug Report: Bulk actions are missing in CRM V3
- **ID:** 28052669-6fd4-4b1f-a83f-dc58c67e0e80
- **URL:** https://me.pullstream.com/crm-v3/companies

### Steps to Reproduce
1- CRM V3 App -> Company page
2- Select a record in List view
3- Click on "1 selected" button

===========
Similar bug: 
1- CRM V3 App -> Person page -> Select a record and Click on "Selected" button -> Add Relationship and Add to Marketing List bulk actions are missing

### Expected Result
When a user selects a record in the Company list view and clicks the “1 selected” button, the system should display the same action options available in CRM V2—specifically “Add to Territory” and “Create Opportunity.” These options should appear in an action menu or modal so the user can immediately perform follow-up tasks on the selected company record.

### Actual Result
In CRM V3, clicking the “1 selected” button after selecting a record does not display the expected actions. Instead, the button performs no visible function and does not show any options such as “Add to Territory” or “Create Opportunity.”

---

## Bug Report: Filters are missing in CRM V3
- **ID:** f6c827d5-4876-4c69-8f17-613475090192
- **URL:** https://me.pullstream.com/crm-v3/companies

### Steps to Reproduce
1- CRM V3 App -> Company page

### Expected Result
On the CRM V3 Company page, the Filters button is missing. Users cannot access or apply any filtering options, which prevents them from narrowing or refining the company list.

### Actual Result
The Filters button should be visible and accessible on the CRM V3 Company page, allowing users to apply filter criteria to organize and refine the list of companies.

___

## Bug Report: Missing tabs in model's details view in CRM V3
- **ID:** 161079a0-fd4b-4976-ac53-1b49f4f74748
- **URL:** https://me.pullstream.com/crm-v3/companies/b407ec62-135c-4317-b8eb-f7594c523bb4

### Steps to Reproduce
1- CRM V3 App -> Company page
2- Click on Name column to go to details view

---------------------
Similar bugs:
1-  CRM V3 App -> Opportunity page -> Click on Name to go to details view -> Email History tab is missing in V3

2-  CRM V3 App -> Person page -> Click on Name to go to details view -> Email History is missing tab in V3

### Expected Result
In CRM V3 Company details view, the tab layout is expected to match CRM V2. Company Notes and Email History tabs must be visible in company details view.

### Actual Result
In CRM V3 Company details view, the tabs shown after clicking the Name column do not match the CRM V2 structure. Company Notes and Email History tabs are missing
___
## Bug Report: New INA record does not appear in INA tab after save
- **ID:** 50f4f88d-a837-4c0e-8f68-ab336e02997b
- **URL:** https://me.pullstream.com/kanbans/opportunity/2499db79-ac2b-4638-aea7-a9323bf5c09c

### Steps to Reproduce
1. Go to the Kanbans then Opportunities.
2. Select pipeline value "Project Expansion" from the dropdown.
3. Click any card (e.g. d_John doe).
4. Open the INA tab.
5. Fill all required fields.
6. Click Save.
7. Check the INA tab content.

### Expected Result
After saving the INA record, the INA tab must immediately display the newly created INA entry. The table list in the INA tab should update automatically after a successful save without requiring a page refresh, or tab switch. The saved INA record should be visible with all entered values and fields.

### Actual Result
After saving the INA record, the INA tab does not display the newly created entry. The tab continues to show the previous state without the new INA record. The new record only becomes visible after manually refreshing the page or switching to another tab and returning to the INA tab.
