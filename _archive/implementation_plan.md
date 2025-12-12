# Implementation Plan: Excel Daily Report Tool

## Architecture
- **Frontend**: Next.js (React) - Modern, responsive UI.
- **Backend**: Python (FastAPI) - Handles Excel file operations.
- **Database**: The Excel file itself (`daily_report_template.xlsm`) acts as the DB.

## Phase 1: Setup & Basic Reading
1.  **Backend Setup**:
    - Create FastAPI app.
    - Implement endpoint to read '営業日報' sheet.
    - Convert Excel data to JSON for frontend.
2.  **Frontend Setup**:
    - Initialize Next.js project.
    - Create a "Dashboard" page to list daily reports.
    - Implement a data grid/table to view the reports.

## Phase 2: Input & Writing
# Implementation Plan: Excel Daily Report Tool

## Architecture
- **Frontend**: Next.js (React) - Modern, responsive UI.
- **Backend**: Python (FastAPI) - Handles Excel file operations.
- **Database**: The Excel file itself (`daily_report_template.xlsm`) acts as the DB.

## Phase 1: Setup & Basic Reading
1.  **Backend Setup**:
    - Create FastAPI app.
    - Implement endpoint to read '営業日報' sheet.
    - Convert Excel data to JSON for frontend.
2.  **Frontend Setup**:
    - Initialize Next.js project.
    - Create a "Dashboard" page to list daily reports.
    - Implement a data grid/table to view the reports.

## Phase 2: Input & Writing
1.  **Backend**:
    - Implement endpoint to append a new row to '営業日報'.
    - Handle data validation (basic).
2.  **Frontend**:
    - Create an "Input Form" page.
    - Fields should match the Excel columns (Date, Customer, Action, etc.).
    - Use dropdowns for fields like 'Area' or 'Action Content' if possible (referencing '入力_List' sheet).

## Phase 3: Analysis & Visualization
1.  **Backend**:
    - Create endpoints for aggregated data (e.g., visits per month, key customer interactions).
2.  **Frontend**:
    - Add charts (using Recharts or Chart.js).
    - Visualizations for:
        - Activity count by Area.
        - Monthly visit trends.

## Phase 4: Polish
- Styling (Tailwind CSS or custom CSS).
- Ensure "Easy to see" (High contrast, clear fonts).
- Test with Japanese characters.

## Proposed Changes

### Backend
#### [MODIFY] [main.py](file:///c:/Users/asahi/.gemini/antigravity/playground/drifting-apollo/backend/main.py)
- Update `add_report` function to copy cell styles (alignment, font, border, fill) from the previous row to the new row.
- This ensures that when a new report is added, it maintains the same formatting as existing reports, preventing layout issues in generated PDFs.

## Verification Plan

### Automated Tests
- Run `test_style_copying.py` (to be created) which adds a report and verifies that the new row has the same styles as the previous row.

### Manual Verification
- Add a new report via the UI.
- Open the Excel file and verify the formatting of the new row matches the previous ones.
- Generate a PDF (using the user's tool) and verify the layout is correct.

## Current Status
- Excel file analyzed.
- Ready to start Phase 1.
