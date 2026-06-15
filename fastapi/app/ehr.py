import os
import asyncio
from playwright.async_api import async_playwright

async def sync_to_ehr_portal(patient_name: str, chief_complaint: str, hpi: str, triage_level: str, meds: str, allergies: str) -> str:
    """
    Automates input of clinical summary data into the simulated EHR portal
    """
    html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "mock_ehr.html"))
    file_url = f"file:///{html_path.replace(os.sep, '/')}"
    
    print(f"[Playwright] Initializing browser. Loading local EHR mock: {file_url}...")
    
    async with async_playwright() as p:
        # Launch headless Chromium
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        
        await page.goto(file_url)
        
        # Fill in the form fields
        print(f"[Playwright] Filling out chart for patient: {patient_name}...")
        await page.fill("#patientName", patient_name)
        await page.fill("#chiefComplaint", chief_complaint)
        await page.fill("#hpi", hpi)
        await page.select_option("#triageLevel", triage_level)
        await page.fill("#medications", meds)
        await page.fill("#allergies", allergies)
        
        # Click submit button
        print("[Playwright] Submitting form...")
        await page.click("#submit-btn")
        
        # Wait for the success message to display
        await page.wait_for_selector("#success-message", state="visible")
        
        # Extract the resulting EHR ID
        ehr_id = await page.inner_text("#ehr-id-display")
        print(f"[Playwright] Chart synced successfully. Generated EHR ID: {ehr_id}")
        
        await browser.close()
        return ehr_id

if __name__ == "__main__":
    # Test script directly
    async def test():
        ehr_id = await sync_to_ehr_portal(
            patient_name="John Doe",
            chief_complaint="Chest pressure",
            hpi="Patient reports sudden pressure radiating to left arm since morning.",
            triage_level="urgent",
            meds="Lisinopril 10mg daily",
            allergies="Peanuts"
        )
        print("Test Result EHR ID:", ehr_id)
        
    asyncio.run(test())
