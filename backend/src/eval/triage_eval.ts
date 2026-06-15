import { AIService } from '../services/ai';
import { TriageLevel } from '../types';

interface TriageTestCase {
  symptoms: string;
  expectedTriage: TriageLevel;
  description: string;
}

const triageTestCases: TriageTestCase[] = [
  // Emergency Cases
  {
    symptoms: "I have sudden severe chest pain that radiates down my left arm and up to my jaw. I am sweating heavily and feel dizzy.",
    expectedTriage: "emergency",
    description: "Acute myocardial infarction (heart attack)"
  },
  {
    symptoms: "I am having sudden weakness on the right side of my face and arm. I am struggling to find words and my speech is slurred.",
    expectedTriage: "emergency",
    description: "Acute stroke"
  },
  {
    symptoms: "I got stung by a bee and my throat is swelling up. I cannot swallow and I am wheezing and gasping for breath.",
    expectedTriage: "emergency",
    description: "Anaphylaxis (severe allergic reaction)"
  },
  {
    symptoms: "I am experiencing the worst headache of my life. It came on like a thunderclap and I feel extremely nauseous.",
    expectedTriage: "emergency",
    description: "Subarachnoid hemorrhage (thunderclap headache)"
  },
  {
    symptoms: "I fell and hit my head, lost consciousness for 5 minutes, and now I cannot stay awake and have vomited twice.",
    expectedTriage: "emergency",
    description: "Severe concussion / head trauma"
  },

  // Urgent Cases
  {
    symptoms: "I have a high fever of 103F, a stiff neck, and a severe headache that makes it hard to look at light.",
    expectedTriage: "urgent",
    description: "Potential meningitis screening"
  },
  {
    symptoms: "I have severe pain in the lower right side of my stomach. It started around my belly button and has gotten much worse. I have a low fever and feel nauseated.",
    expectedTriage: "urgent",
    description: "Potential appendicitis"
  },
  {
    symptoms: "My left calf is swollen, red, hot to the touch, and hurts when I try to walk on it. I recently returned from a 12-hour flight.",
    expectedTriage: "urgent",
    description: "Potential Deep Vein Thrombosis (DVT)"
  },
  {
    symptoms: "I am coughing up yellow-green mucus, breathing quickly, and have a fever of 101F. Every time I take a deep breath, my chest hurts.",
    expectedTriage: "urgent",
    description: "Potential pneumonia"
  },
  {
    symptoms: "I stepped on a rusty nail in my garage. It went through my shoe and punctured my heel. I haven't had a tetanus shot in over 10 years.",
    expectedTriage: "urgent",
    description: "Deep puncture wound with tetanus risk"
  },

  // Routine Cases
  {
    symptoms: "I have had a runny nose, sneezing, and scratchy throat for two days. No fever, breathing is completely fine.",
    expectedTriage: "routine",
    description: "Common cold / viral rhinitis"
  },
  {
    symptoms: "My eyes are itchy, watery, and red, and I have been sneezing frequently since the pollen count went up this week.",
    expectedTriage: "routine",
    description: "Seasonal allergies"
  },
  {
    symptoms: "I tweaked my lower back yesterday lifting a box. It's stiff and aches, but no pain down my legs or numbness.",
    expectedTriage: "routine",
    description: "Mild lumbar muscle strain"
  },
  {
    symptoms: "I have a minor sunburn on my shoulders after being at the pool. It is red and stings slightly, but no blisters.",
    expectedTriage: "routine",
    description: "First-degree sunburn"
  },
  {
    symptoms: "I need a prescription refill for my daily blood pressure medication, Lisinopril 10mg. I have no new symptoms.",
    expectedTriage: "routine",
    description: "Routine prescription refill request"
  }
];

async function runTriageEval() {
  console.log("==================================================");
  console.log("          IntakeRx Triage Accuracy Eval           ");
  console.log("==================================================\n");

  let correctCount = 0;
  let emergencyMissed = 0;

  for (let i = 0; i < triageTestCases.length; i++) {
    const testCase = triageTestCases[i];
    console.log(`[Case ${i + 1}/${triageTestCases.length}] Description: "${testCase.description}"`);
    console.log(`Symptoms: "${testCase.symptoms}"`);

    try {
      const systemPrompt = `You are a clinical triaging assistant. 
Review the patient's symptoms and classify them into one of the following triage levels:
- 'routine': Non-urgent symptoms, minor issues, routine refills.
- 'urgent': Requires prompt clinical attention (within 12-24 hours), but not immediately life-threatening.
- 'emergency': Immediate life-threatening signs (chest pain, stroke, severe respiratory distress, anaphylaxis).

Output raw JSON:
{
  "triageLevel": "routine" | "urgent" | "emergency",
  "rationale": "Brief clinical reasoning"
}`;

      // Add delay to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
      const response = await AIService.generateText(systemPrompt, [{ role: 'user', content: testCase.symptoms }], {
        temperature: 0.0,
        responseJsonSchema: {
          type: 'OBJECT',
          properties: {
            triageLevel: { type: 'STRING' },
            rationale: { type: 'STRING' }
          },
          required: ['triageLevel', 'rationale']
        }
      });

      const parsed = JSON.parse(response.trim());
      const level = parsed.triageLevel.toLowerCase() as TriageLevel;

      if (level === testCase.expectedTriage) {
        correctCount++;
        console.log(`\x1b[32m✔ CORRECT\x1b[0m - Got: ${level}. Rationale: ${parsed.rationale}\n`);
      } else {
        if (testCase.expectedTriage === 'emergency') {
          emergencyMissed++;
        }
        console.log(`\x1b[31m✘ INCORRECT\x1b[0m - Expected: ${testCase.expectedTriage}, Got: ${level}. Rationale: ${parsed.rationale}\n`);
      }
    } catch (err) {
      console.error(`Error processing case ${i + 1}:`, err);
    }
  }

  const accuracy = (correctCount / triageTestCases.length) * 100;
  console.log("==================================================");
  console.log("                 EVALUATION SUMMARY               ");
  console.log("==================================================");
  console.log(`Total Cases Evaluated:       ${triageTestCases.length}`);
  console.log(`Correct Classifications:    ${correctCount} (${accuracy.toFixed(1)}%)`);
  console.log(`Emergency Cases Missed:     ${emergencyMissed}`);
  console.log("--------------------------------------------------");

  const passedGates = accuracy >= 86.0 && emergencyMissed === 0;
  if (passedGates) {
    console.log("\x1b[32m✔ TRIAGE ACCURACY GATES PASSED SUCCESSFULLY.\x1b[0m");
    process.exit(0);
  } else {
    console.log("\x1b[31m✘ TRIAGE ACCURACY GATES FAILED.\x1b[0m Requirements: Accuracy >= 86%, 0 Emergency cases missed.");
    process.exit(1);
  }
}

// Execute
runTriageEval();
