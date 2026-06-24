import { validateSOAPData } from './routes/intake';

console.log('==================================================');
console.log('         IntakeRx SOAP Validation Unit Test        ');
console.log('==================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

function runTests() {
  // Test Case 1: Valid SOAP Data
  const validData = {
    chiefComplaint: "Severe migraine and nausea",
    historyOfPresentIllness: "Onset 12 hours ago, throbbing pain, sensitive to light.",
    pastMedicalHistory: "Hypertension managed with Lisinopril",
    medications: [
      { name: "Lisinopril", dosage: "10mg", frequency: "daily" },
      { name: "Ibuprofen", dosage: "400mg", frequency: "as needed" }
    ],
    allergies: ["Penicillin"],
    insurance: {
      provider: "Blue Cross Blue Shield",
      policyNumber: "XYZ123456789"
    },
    triageLevel: "routine",
    triageRationale: "Patient presents with common migraine symptoms without red flags.",
    redFlagsIdentified: []
  };

  assert(validateSOAPData(validData) === true, "Should validate correct and complete SOAP data structure.");

  // Test Case 2: Missing required string fields
  const missingHPI = { ...validData, historyOfPresentIllness: "" };
  assert(validateSOAPData(missingHPI) === false, "Should fail validation if required historyOfPresentIllness is empty.");

  // Test Case 3: Invalid triage level
  const invalidTriage = { ...validData, triageLevel: "critical" };
  assert(validateSOAPData(invalidTriage) === false, "Should fail validation if triage level is not one of routine/urgent/emergency.");

  // Test Case 4: Invalid medications array
  const invalidMeds = {
    ...validData,
    medications: [
      { name: "", dosage: "10mg" } // Empty name
    ]
  };
  assert(validateSOAPData(invalidMeds) === false, "Should fail validation if medication name is empty.");

  // Test Case 5: Missing redFlagsIdentified
  const missingRedFlags = { ...validData };
  delete (missingRedFlags as any).redFlagsIdentified;
  assert(validateSOAPData(missingRedFlags) === false, "Should fail validation if redFlagsIdentified array is missing.");

  console.log('\n==================================================');
  console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
  console.log('==================================================');
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests();
