import os
import requests
from dotenv import load_dotenv

# Load from backend directory env file if available
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../backend/.env'))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5001")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-001")

def get_gemini_embedding(text: str) -> list:
    """
    Computes a 768-dimensional text embedding using Gemini's embedding model
    """
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured.")
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{EMBEDDING_MODEL}:embedContent?key={GEMINI_API_KEY}"
    
    headers = {"Content-Type": "application/json"}
    body = {
        "model": f"models/{EMBEDDING_MODEL}",
        "content": {
            "parts": [{"text": text}]
        },
        "outputDimensionality": 768
    }
    
    response = requests.post(url, json=body, headers=headers)
    if response.status_code != 200:
        raise Exception(f"Gemini API Embedding failed ({response.status_code}): {response.text}")
        
    data = response.json()
    if "embedding" in data and "values" in data["embedding"]:
        return data["embedding"]["values"]
    else:
        raise Exception("Invalid embedding response from Gemini API")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list:
    """
    Splits text into sliding window chunks
    """
    words = text.split()
    chunks = []
    
    i = 0
    while i < len(words):
        chunk_words = words[i:i + chunk_size]
        chunks.append(" ".join(chunk_words))
        i += chunk_size - overlap
        if i >= len(words) - overlap:
            break
            
    return chunks

def upload_chunk(title: str, content: str, chunk_index: int, embedding: list) -> bool:
    """
    POSTs a protocol chunk and its embedding to the Express backend
    """
    url = f"{BACKEND_URL}/api/protocols"
    body = {
        "title": title,
        "content": content,
        "chunkIndex": chunk_index,
        "embedding": embedding
    }
    
    try:
        response = requests.post(url, json=body)
        if response.status_code == 201:
            return True
        else:
            print(f"Failed to upload chunk {chunk_index} of '{title}': {response.text}")
            return False
    except Exception as e:
        print(f"Connection error uploading chunk: {e}")
        return False

def parse_and_ingest_pdf(pdf_path: str) -> int:
    """
    Parses a PDF file, chunks it, retrieves embeddings, and uploads them
    """
    from pypdf import PdfReader
    
    title = os.path.splitext(os.path.basename(pdf_path))[0].replace("_", " ").title()
    print(f"Parsing PDF: {pdf_path} (Title: '{title}')...")
    
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        text = page.extract_text()
        if text:
            full_text += text + "\n"
            
    if not full_text.strip():
        print(f"Warning: No text extracted from {pdf_path}")
        return 0
        
    chunks = chunk_text(full_text)
    print(f"Split document into {len(chunks)} chunks.")
    
    uploaded_count = 0
    for idx, chunk in enumerate(chunks):
        print(f"Embedding chunk {idx + 1}/{len(chunks)}...")
        try:
            embedding = get_gemini_embedding(chunk)
            if upload_chunk(title, chunk, idx, embedding):
                uploaded_count += 1
        except Exception as e:
            print(f"Error processing chunk {idx}: {e}")
            
    return uploaded_count

def ingest_default_protocols():
    """
    Creates and uploads default protocols to bootstrap RAG
    """
    protocols = [
        {
            "title": "Cardiac Chest Pain Protocol",
            "content": """
Cardiac Chest Pain Protocol for Patient Intake.
Objective: Assess patient symptoms when presenting with chest pain or pressure to rule out acute myocardial infarction or cardiac distress.
Protocol Steps:
1. Identify primary complaint details: Ask about the character of pain (crushing pressure, sharp, stabbing, aching, tightness).
2. Determine location and radiation: Check if the chest pain radiates to the left arm, shoulder, back, neck, or jaw.
3. Assess accompanying symptoms: Ask about shortness of breath (dyspnea), cold sweats (diaphoresis), nausea, vomiting, dizziness, or heart palpitations.
4. Gather temporal details: Ask about onset (sudden vs gradual), duration of the current episode, and if it is constant or intermittent.
5. Inquire about exacerbating/relieving factors: Does physical exertion make the pain worse? Does rest or nitroglycerin relieve it?
6. Check history: Record history of heart attacks, angina, angioplasty, hypertension, diabetes, high cholesterol, or smoking.
7. Medication use: Ask if the patient has taken aspirin or nitroglycerin since the pain started.
Emergency Warning: If the patient exhibits sudden crushing pain radiating to the arm/jaw with severe shortness of breath, dizziness, or sweating, immediately abort intake and direct the patient to call 911.
"""
        },
        {
            "title": "Asthma and Respiratory Protocol",
            "content": """
Asthma and Respiratory Protocol for Patient Intake.
Objective: Screen respiratory distress, coughing, wheezing, and chest tightness to determine appropriate triaging.
Protocol Steps:
1. Assess chief complaint: Note if the patient is experiencing active wheezing, shortness of breath, dry cough, or productive cough.
2. Inquire about asthma history: Record age of diagnosis, frequency of asthma attacks, and if they have ever been hospitalized or intubated for breathing issues.
3. Review current medications: Record use of rescue inhalers (e.g., Albuterol, Ventolin) and controller inhalers (e.g., Flovent, Symbicort, Advair).
4. Gather inhaler usage details: Ask how many times per day or week they use their rescue inhaler. Using it more than 2 times per week indicates poor control.
5. Identify triggers: Inquire if symptoms are triggered by exercise, cold air, allergens (pollen, dust, pet dander), smoke, or respiratory infections.
6. Assess current severity: Ask if they are having difficulty speaking in full sentences, or if they hear wheezing during breathing.
Emergency Warning: If the patient is struggling to breathe, unable to speak full sentences, or shows bluish lips (cyanosis), immediately abort intake and instruct them to call 911.
"""
        },
        {
            "title": "Gastrointestinal Abdominal Pain Protocol",
            "content": """
Gastrointestinal Abdominal Pain Protocol for Patient Intake.
Objective: Collect diagnostic context for abdominal pain complaints to screen for appendicitis, cholecystitis, or gastroenteritis.
Protocol Steps:
1. Locate the pain: Ask the patient to identify the quadrant of the abdomen (e.g., Right Upper Quadrant RUQ, Right Lower Quadrant RLQ, Left Lower Quadrant LLQ, epigastric).
2. Assess pain quality: Ask if the pain is cramping, burning, sharp, constant, or coming in waves (colicky).
3. Trace timeline: When did the pain start? Did it start suddenly or build up?
4. Document associated symptoms: Ask about fever, chills, nausea, vomiting, diarrhea, constipation, blood in stool, or painful urination.
5. Identify food correlation: Does eating make the pain better or worse? (e.g., gallbladder pain worsens after fatty meals, ulcer pain may get better with food).
6. Check history: Record previous surgeries (appendix removal, gallbladder removal) or history of ulcers, IBS, Crohn's, or kidney stones.
Triage Guidance: Pain localized to the Right Lower Quadrant with fever and vomiting indicates potential appendicitis (Urgent/Emergency). Right Upper Quadrant pain radiating to back suggests cholecystitis.
"""
        }
    ]
    
    print("Ingesting default protocols to bootstrap pgvector...")
    for proto in protocols:
        print(f"Processing '{proto['title']}'...")
        try:
            embedding = get_gemini_embedding(proto["content"])
            upload_chunk(proto["title"], proto["content"], 0, embedding)
            print(f"Successfully uploaded '{proto['title']}'.")
        except Exception as e:
            print(f"Failed to upload default protocol '{proto['title']}': {e}")
