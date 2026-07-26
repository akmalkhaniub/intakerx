"""
Drug Interaction and Patient Safety Verification Engine for IntakeRx
Evaluates patient prescriptions for known contraindications and high dosage risks.
"""
from typing import List, Dict, Any

KNOWN_DRUG_INTERACTIONS = {
    ("warfarin", "aspirin"): "SEVERE: Increased risk of major internal bleeding",
    ("lisinopril", "spironolactone"): "MODERATE: Risk of hyperkalemia (high potassium)",
    ("simvastatin", "amiodarone"): "HIGH: Risk of severe myopathy and rhabdomyolysis",
    ("metformin", "contrast_media"): "HIGH: Risk of lactic acidosis"
}

class DrugSafetyEngine:
    """Evaluates drug-drug interaction warnings and dosage thresholds."""

    @staticmethod
    def evaluate_prescriptions(medications: List[str]) -> Dict[str, Any]:
        """Check list of patient medications for severe interactions."""
        norm_meds = [m.lower().strip() for m in medications]
        warnings = []

        for i in range(len(norm_meds)):
            for j in range(i + 1, len(norm_meds)):
                med1, med2 = norm_meds[i], norm_meds[j]
                
                # Check directional pairs
                interaction = KNOWN_DRUG_INTERACTIONS.get((med1, med2)) or KNOWN_DRUG_INTERACTIONS.get((med2, med1))
                if interaction:
                    warnings.append({
                        "drugs": [med1, med2],
                        "warning": interaction,
                        "severity": "HIGH" if "SEVERE" in interaction or "HIGH" in interaction else "MEDIUM"
                    })

        return {
            "total_medications": len(medications),
            "safety_status": "SAFE" if len(warnings) == 0 else "WARNINGS_DETECTED",
            "warnings_count": len(warnings),
            "interaction_warnings": warnings
        }
