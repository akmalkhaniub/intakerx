import { AIService } from './services/ai';
import { pool } from './db';

async function runMultilingualTests() {
  console.log('==================================================');
  console.log('       IntakeRx Multilingual Translation Test      ');
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

  try {
    // Formulate a structured output prompt to test translation constraints
    const systemPrompt = `You are a professional medical assistant. 
The patient's preferred language is: Spanish (es-ES).
You MUST respond strictly in the following JSON format:
{
  "text": "Your calming question to the patient (written in Spanish)",
  "extractedData": {
    "symptoms": [{"name": "symptom name (translated to English)", "severity": "mild/moderate/severe"}],
    "medications": [{"name": "medication name (translated to English)"}]
  }
}`;

    const messages = [
      { role: 'user' as const, content: 'Me duele mucho la cabeza y tengo náuseas. Tomo Aspirina todos los días.' }
    ];

    console.log('Running translation test call to AI Service...');
    const response = await AIService.generateText(systemPrompt, messages, {
      temperature: 0.1,
      responseJsonSchema: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          extractedData: {
            type: 'OBJECT',
            properties: {
              symptoms: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' },
                    severity: { type: 'STRING' }
                  },
                  required: ['name', 'severity']
                }
              },
              medications: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    name: { type: 'STRING' }
                  },
                  required: ['name']
                }
              }
            },
            required: ['symptoms', 'medications']
          }
        },
        required: ['text', 'extractedData']
      }
    });

    console.log('\nAI Response:', response);
    const parsed = JSON.parse(response.trim());
    
    // Assertions
    assert(
      typeof parsed.text === 'string' && parsed.text.length > 0,
      'Response text should be a valid string.'
    );
    
    // Verify translation of text to Spanish
    const isSpanish = /[áéíóúüñ¿¡]/i.test(parsed.text) || 
                      parsed.text.toLowerCase().includes('dolor') ||
                      parsed.text.toLowerCase().includes('hola') ||
                      parsed.text.toLowerCase().includes('cómo') ||
                      parsed.text.toLowerCase().includes('que');
    assert(
      isSpanish,
      `Response dialog should be in Spanish. Got: "${parsed.text}"`
    );

    // Verify extraction and translation of symptoms to English
    const symptoms = parsed.extractedData?.symptoms || [];
    assert(
      symptoms.length > 0,
      'Should extract at least one symptom.'
    );

    const hasHeadache = symptoms.some((s: any) => 
      s.name.toLowerCase().includes('headache') || 
      s.name.toLowerCase().includes('head pain') ||
      s.name.toLowerCase().includes('migraine')
    );
    assert(
      hasHeadache,
      `Symptom name "dolor de cabeza" should be translated to English ("headache"). Got: ${JSON.stringify(symptoms)}`
    );

    const medications = parsed.extractedData?.medications || [];
    assert(
      medications.length > 0,
      'Should extract at least one medication.'
    );

    const hasAspirin = medications.some((m: any) => m.name.toLowerCase().includes('aspirin'));
    assert(
      hasAspirin,
      `Medication name "Aspirina" should be extracted in English ("aspirin"). Got: ${JSON.stringify(medications)}`
    );

    console.log('\n==================================================');
    console.log(`Test Results: ${passedTests}/${totalTests} Passed`);
    console.log('==================================================');
    await new Promise(resolve => setTimeout(resolve, 500));
    await pool.end();
    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Test execution failed:', err);
    try {
      await pool.end();
    } catch (e) {}
    process.exit(1);
  }
}

runMultilingualTests();
