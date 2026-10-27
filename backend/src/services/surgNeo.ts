import { pool } from '../db';

export type NeonatalSurgicalEmergencyType = 'CDH' | 'GASTROSCHISIS' | 'OMPHALOCELE' | 'TEF_EA' | 'NEC';

export type NecBellStage = 'STAGE_I_SUSPECTED' | 'STAGE_II_PROVEN' | 'STAGE_IIIA_ADVANCED_INTACT' | 'STAGE_IIIB_PERFORATED';

export interface ClinicalPresentationInput {
  scaphoidAbdomen?: boolean;
  bowelSoundsInChest?: boolean;
  excessiveSalivationDrooling?: boolean;
  chokingWithFeeds?: boolean;
  inabilityToPassNgt?: boolean;
  exposedEvisceratedBowel?: boolean;
  umbilicalCordOnSac?: boolean;
  sacRuptured?: boolean;
  abdominalDistention?: boolean;
  abdominalErythemaOrDiscoloration?: boolean;
  grosslyBloodyStools?: boolean;
  temperatureInstability?: boolean;
  apneaBradycardia?: boolean;
  septicShockOrAcidosis?: boolean;
}

export interface RadiographicFindingsInput {
  bowelLoopsInHemithorax?: boolean;
  mediastinalShiftOpposite?: boolean;
  coiledNgtInUpperPouch?: boolean;
  absentGasInAbdomen?: boolean;
  pneumatosisIntestinalis?: boolean;
  portalVenousGas?: boolean;
  pneumoperitoneumFreeAir?: boolean; // Rigler sign, football sign, falciform ligament
  fixedDilatedLoop?: boolean;
}

export interface SurgicalEvaluationInput {
  patientId: number;
  gestationalAgeWeeks: number;
  currentWeightGrams: number;
  emergencyType: NeonatalSurgicalEmergencyType;
  clinicalPresentation: ClinicalPresentationInput;
  radiographicFindings: RadiographicFindingsInput;
  plateletCount?: number;
  serumLactateMmolL?: number;
  bloodPh?: number;
}

export interface ContraindicationAlert {
  intervention: string;
  hazard: string;
  absoluteContraindication: boolean;
}

export interface ClinicalActionPlanStep {
  step: number;
  action: string;
  urgency: 'STAT_EMERGENT' | 'URGENT' | 'PRIORITY';
  rationale: string;
}

export interface SurgicalEvaluationResult {
  emergencyType: NeonatalSurgicalEmergencyType;
  bellStage?: NecBellStage;
  surgicalUrgency: 'EMERGENT_OPERATING_ROOM' | 'URGENT_BEDSIDE_DRAIN' | 'STAGED_SILO_OR_REDUCTION' | 'CONSERVATIVE_MEDICAL_STABILIZATION';
  airwayVentStrategy: string;
  decompressionRegimen: string;
  fluidResuscitationTarget: string;
  antimicrobialRegimen?: string;
  contraindicatedInterventions: ContraindicationAlert[];
  syndromicAndCoAnomalyScreen: string[];
  clinicalActionPlan: ClinicalActionPlanStep[];
}

export interface DecompressionMonitoringInput {
  patientId: number;
  emergencyType: NeonatalSurgicalEmergencyType;
  replogleSizeFr: number;
  suctionPressureMmhg: number;
  aspirateVolumeMl: number;
  aspirateCharacter: string; // e.g. 'Bilio-viscous', 'Clear gastric', 'Salivary', 'Feculent', 'Hemorrhagic'
  abdominalExam: string;
  abdominalGirthCm?: number;
}

export interface DecompressionMonitoringResult {
  decompressionEffective: boolean;
  suctionStatus: 'OPTIMAL_CONTINUOUS_DRAIN' | 'EXCESSIVE_PRESSURE_RISK' | 'INSUFFICIENT_SUCTION' | 'LUMEN_OCCLUSION_SUSPECTED';
  aspirateRiskAssessment: string;
  directives: string[];
}

// 1. EVALUATE NEONATAL SURGICAL EMERGENCY
export function evaluateNeonatalSurgicalEmergency(input: SurgicalEvaluationInput): SurgicalEvaluationResult {
  const {
    emergencyType,
    currentWeightGrams,
    clinicalPresentation,
    radiographicFindings,
    plateletCount,
    serumLactateMmolL,
    bloodPh
  } = input;

  const contraindications: ContraindicationAlert[] = [];
  const coAnomalyScreen: string[] = [];
  const plan: ClinicalActionPlanStep[] = [];
  let surgicalUrgency: SurgicalEvaluationResult['surgicalUrgency'] = 'CONSERVATIVE_MEDICAL_STABILIZATION';
  let airwayVentStrategy = '';
  let decompressionRegimen = '';
  let fluidResuscitationTarget = '';
  let antimicrobialRegimen: string | undefined = undefined;
  let bellStage: NecBellStage | undefined = undefined;

  // Replogle sizing based on weight
  const replogleSizeFr = currentWeightGrams < 1500 ? 8 : 10;

  switch (emergencyType) {
    case 'CDH': {
      // Congenital Diaphragmatic Hernia
      surgicalUrgency = 'CONSERVATIVE_MEDICAL_STABILIZATION'; // Initial stabilization prior to delayed surgery
      airwayVentStrategy = 'EMERGENT ENDOTRACHEAL INTUBATION (Size 3.0-3.5 uncuffed). STRICT gentle ventilation: PIP < 25 cmH2O, PEEP 4-5 cmH2O, Permissive Hypercapnia (PaCO2 45-60 mmHg, pH > 7.25). Target Pre-ductal SpO2 85-92%. Avoid hyperventilation.';
      decompressionRegimen = `Insert ${replogleSizeFr} Fr double-lumen Replogle tube via oropharynx into stomach on continuous low suction (-20 to -30 mmHg). Flush vent lumen with 0.5-1.0 mL air Q2-4H to ensure continuous visceral decompression and prevent mediastinal tension.`;
      fluidResuscitationTarget = 'Maintenance D10W at 60-80 mL/kg/day. Avoid fluid overload to protect hypoplastic lungs and pulmonary capillary bed.';
      antimicrobialRegimen = 'Broad-spectrum surgical prophylaxis (Ampicillin + Gentamicin or Cefazolin).';

      // Contraindications
      contraindications.push({
        intervention: 'Bag-Valve-Mask Ventilation',
        hazard: 'Air enters stomach and herniated viscera in the hemithorax, causing acute mediastinal shift, contralateral lung compression, and tension pneumothorax/cardiovascular collapse.',
        absoluteContraindication: true
      });
      contraindications.push({
        intervention: 'Aggressive High-Pressure Ventilation (PIP > 25 cmH2O)',
        hazard: 'Barotrauma and pneumothorax in the hypoplastic contralateral lung.',
        absoluteContraindication: true
      });
      contraindications.push({
        intervention: 'Immediate Emergent Surgical Repair Prior to Cardiopulmonary Stabilization',
        hazard: 'High mortality. Surgery must be delayed 24-72 hours until PPHN is controlled, pulmonary vascular resistance settles, and inotropic stability is achieved.',
        absoluteContraindication: false
      });

      // Co-anomalies
      coAnomalyScreen.push('Urgent Echocardiogram: Assess pulmonary arterial pressure (PPHN), ductal shunting, and screen for associated congenital heart defects (present in 15-25%).');
      coAnomalyScreen.push('Renal Ultrasound: Assess for structural urogenital anomalies.');
      coAnomalyScreen.push('Cranial Ultrasound: Screen for intracranial abnormalities and baseline prior to potential ECMO.');

      // Plan
      plan.push({
        step: 1,
        action: 'Intubate immediately in delivery room or NICU without bag-mask ventilation.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Secures airway while preventing visceral aerophagia and tension mediastinal compression.'
      });
      plan.push({
        step: 2,
        action: `Pass ${replogleSizeFr} Fr Replogle tube to continuous low suction (-20 to -30 mmHg).`,
        urgency: 'STAT_EMERGENT',
        rationale: 'Decompresses intrathoracic bowel loops to maximize lung expansion.'
      });
      plan.push({
        step: 3,
        action: 'Place Pre-ductal (right wrist) and Post-ductal (either lower extremity) pulse oximeters and right radial arterial line.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Monitors right-to-left ductal shunting and true cerebral pre-ductal oxygenation.'
      });
      plan.push({
        step: 4,
        action: 'Prepare for delayed surgical repair once pulmonary hypertension and hemodynamics stabilize (typically 24-72 hours). Alert ECMO team.',
        urgency: 'URGENT',
        rationale: 'Premature surgery during active acute PPHN carries near 100% mortality.'
      });
      break;
    }

    case 'GASTROSCHISIS': {
      // Full-thickness abdominal wall defect lateral to umbilicus (usually right), no sac
      surgicalUrgency = 'STAGED_SILO_OR_REDUCTION';
      airwayVentStrategy = 'Intubation typically required if primary closure attempted or if respiratory compromise from increased intra-abdominal pressure occurs. Spontaneous breathing acceptable initially if vigorous.';
      decompressionRegimen = `Place ${replogleSizeFr} Fr Replogle tube to continuous suction (-20 to -30 mmHg). Aspirate gastric contents Q1-2H to prevent bowel distention and aspiration.`;
      fluidResuscitationTarget = 'AGGRESSIVE FLUID RESUSCITATION: 150 - 200 mL/kg/day isotonic crystalloid (D5 or D10 0.2% NS / Plasmalyte). Exposed eviscerated bowel has massive evaporative fluid and heat losses (2.5-3x normal maintenance).';
      antimicrobialRegimen = 'Ampicillin + Gentamicin (broad-spectrum covering skin, bowel, and maternal vaginal flora).';

      // Contraindications
      contraindications.push({
        intervention: 'Direct Gauze / Dry Dressing on Exposed Viscera',
        hazard: 'Desiccation, serosal tear, severe intestinal ischemia, and necrosis.',
        absoluteContraindication: true
      });
      contraindications.push({
        intervention: 'Forced Primary Closure Under Excessive Tension (Intra-abdominal Pressure > 20 mmHg)',
        hazard: 'Abdominal compartment syndrome, inferior vena cava compression, renal failure, and bowel strangulation.',
        absoluteContraindication: true
      });

      // Co-anomalies
      coAnomalyScreen.push('Assess intestinal integrity for intestinal atresia (present in 10-15% due to intrauterine volvulus/constriction).');
      coAnomalyScreen.push('Inspect for bowel perforation, ischemia, or matted peel.');

      // Plan
      plan.push({
        step: 1,
        action: 'Immediate sterile bowel bag or sterile plastic wrap covering lower body and viscera from axillae down.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Preserves core body temperature and arrests profound evaporative water and electrolyte loss.'
      });
      plan.push({
        step: 2,
        action: 'Position infant in right lateral decubitus position; support eviscerated bowel with warm saline-soaked gauze rolls.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Relieves kinking and vascular torsion of mesenteric vessels at the defect margin.'
      });
      plan.push({
        step: 3,
        action: 'Establish large-bore peripheral or central venous access and start 175 mL/kg/day fluid infusion.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Compensates for rapid third-space fluid shift and evaporative hypovolemia.'
      });
      plan.push({
        step: 4,
        action: 'Bedside Spring-Loaded Silo placement for staged reduction over 3-7 days, followed by sutureless or fascial closure.',
        urgency: 'URGENT',
        rationale: 'Allows gradual reduction into peritoneal cavity without precipitating abdominal compartment syndrome.'
      });
      break;
    }

    case 'OMPHALOCELE': {
      // Central midline defect at base of umbilicus covered by peritoneal/amniotic membrane
      const isRuptured = clinicalPresentation.sacRuptured === true;
      surgicalUrgency = isRuptured ? 'EMERGENT_OPERATING_ROOM' : 'STAGED_SILO_OR_REDUCTION';
      airwayVentStrategy = isRuptured
        ? 'Emergent intubation and mechanical ventilation due to respiratory compromise.'
        : 'Spontaneous breathing or elective intubation depending on associated cardiac anomalies.';
      decompressionRegimen = `Insert ${replogleSizeFr} Fr Replogle tube to low intermittent or continuous suction to decompress gastrointestinal tract.`;
      fluidResuscitationTarget = isRuptured
        ? '150 - 180 mL/kg/day (sac ruptured behaves physiologically like gastroschisis).'
        : 'Standard maintenance fluids (80 - 100 mL/kg/day) with careful glucose monitoring.';
      antimicrobialRegimen = 'Ampicillin + Gentamicin IV.';

      // Contraindications
      contraindications.push({
        intervention: 'Aggressive Manual Reduction or Twisting of Intact Sac',
        hazard: 'Torsion of suprahepatic inferior vena cava or hepatic veins if liver is herniated, causing sudden fatal cardiac arrest.',
        absoluteContraindication: true
      });
      contraindications.push({
        intervention: 'Clamping or Ligating the Umbilical Cord Near the Base',
        hazard: 'Inadvertent ligation of herniated intestinal loops within the umbilical cord base.',
        absoluteContraindication: true
      });

      // Co-anomalies
      coAnomalyScreen.push('STAT Echocardiogram: Congenital heart defects are present in 35-50% (Tetralogy of Fallot, ASD/VSD, Coarctation).');
      coAnomalyScreen.push('Frequent Blood Glucose Surveillance: Screen for Beckwith-Wiedemann Syndrome (Omphalocele + Macroglossia + Severe Hypoglycemia from islet cell hyperplasia).');
      coAnomalyScreen.push('Karyotype / Microarray: Screen for Trisomy 13, 18, 21 (associated in 30-40%).');
      coAnomalyScreen.push('Screen for Pentalogy of Cantrell (Sternal cleft, ectopia cordis, diaphragmatic defect, omphalocele, intracardiac defect).');

      // Plan
      plan.push({
        step: 1,
        action: isRuptured
          ? 'EMERGENT OR ACTIVATION: Ruptured omphalocele requires urgent sterile silo or primary surgical repair.'
          : 'Gently cover intact sac with sterile non-adherent saline dressing and warm dry wrap. Do not disrupt sac.',
        urgency: isRuptured ? 'STAT_EMERGENT' : 'URGENT',
        rationale: isRuptured ? 'Sepsis and evisceration risk.' : 'Preserves membrane integrity while systemic workup occurs.'
      });
      plan.push({
        step: 2,
        action: 'STAT Bedside blood glucose check and continuous glucose infusion (GIR 6-8 mg/kg/min).',
        urgency: 'STAT_EMERGENT',
        rationale: 'Detects and treats hyperinsulinemic hypoglycemia characteristic of Beckwith-Wiedemann Syndrome.'
      });
      plan.push({
        step: 3,
        action: 'Urgent Pediatric Cardiology Echo consultation prior to definitive surgical closure.',
        urgency: 'URGENT',
        rationale: 'Cardiac anomalies dictate anesthetic risk and intraoperative tolerance of elevated intrathoracic pressure.'
      });
      break;
    }

    case 'TEF_EA': {
      // Tracheoesophageal Fistula & Esophageal Atresia (Type C most common ~85%)
      surgicalUrgency = 'URGENT_BEDSIDE_DRAIN'; // Surgery within 24-48 hours once stable
      airwayVentStrategy = 'MAINTAIN SPONTANEOUS BREATHING IF AT ALL POSSIBLE. AVOID POSITIVE PRESSURE VENTILATION (PPV, CPAP, Bag-Mask). If intubation is mandatory for severe respiratory failure, position endotracheal tube tip distal to the fistula but above the carina under bronchoscopic guidance.';
      decompressionRegimen = 'Insert 10 Fr Replogle sump tube into upper esophageal pouch (typically arrests at 9-11 cm from alveolar ridge). Attach to CONTINUOUS SUCTION (-20 to -30 mmHg). Flush air vent with 0.5 mL air Q1-2H to prevent salivary aspiration.';
      fluidResuscitationTarget = 'Maintenance IV fluids (60 - 80 mL/kg/day D10W). Strict NPO.';
      antimicrobialRegimen = 'Ampicillin + Gentamicin (prophylaxis against chemical/bacterial aspiration pneumonitis).';

      // Contraindications
      contraindications.push({
        intervention: 'Positive Pressure Ventilation (CPAP, Non-invasive PPV, Bag-Valve-Mask)',
        hazard: 'Air preferentially passes through low-resistance distal tracheoesophageal fistula into the stomach, causing massive acute gastric distention, diaphragmatic splinting, respiratory arrest, and gastric rupture.',
        absoluteContraindication: true
      });
      contraindications.push({
        intervention: 'Oral or Enteral Feedings of Any Kind',
        hazard: 'Massive aspiration of feeds directly into tracheobronchial tree from blind upper pouch or via fistula.',
        absoluteContraindication: true
      });

      // Co-anomalies
      coAnomalyScreen.push('VACTERL Screening Protocol:');
      coAnomalyScreen.push('  - V: Vertebral anomalies (Spine X-rays for hemivertebrae, tethered cord)');
      coAnomalyScreen.push('  - A: Anal atresia (Perineal inspection for imperforate anus)');
      coAnomalyScreen.push('  - C: Cardiac echo (ASD, VSD, Tetralogy of Fallot, right-sided aortic arch present in 35%)');
      coAnomalyScreen.push('  - TE: TracheoEsophageal fistula (confirmed)');
      coAnomalyScreen.push('  - R: Renal ultrasound (renal agenesis, hydronephrosis)');
      coAnomalyScreen.push('  - L: Limb anomalies (Radial ray dysplasia, absent thumb or radius)');

      // Plan
      plan.push({
        step: 1,
        action: 'Place 10 Fr Replogle tube into upper esophageal pouch on continuous low suction (-20 to -30 mmHg). Strict NPO.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Evacuates continuous salivary secretions and halts pulmonary aspiration.'
      });
      plan.push({
        step: 2,
        action: 'Elevate Head of Bed to 30 - 45 degrees.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Utilizes gravity to minimize reflux of gastric acid through the distal fistula into the tracheobronchial tree.'
      });
      plan.push({
        step: 3,
        action: 'Confirm diagnosis with babygram (CXR/AXR): Coiled tube in upper neck/chest and presence of gastric gas (confirms distal TEF).',
        urgency: 'STAT_EMERGENT',
        rationale: 'Differentiates isolated esophageal atresia (gasless abdomen) from Type C fistula.'
      });
      plan.push({
        step: 4,
        action: 'Urgent Pediatric Surgery consult for extrapleural thoracoscopic or open primary TEF ligation and esophageal anastomosis.',
        urgency: 'URGENT',
        rationale: 'Definitive anatomical correction within 24-48 hours.'
      });
      break;
    }

    case 'NEC': {
      // Necrotizing Enterocolitis (Modified Bell's Criteria)
      const hasFreeAir = radiographicFindings.pneumoperitoneumFreeAir === true;
      const hasPortalGas = radiographicFindings.portalVenousGas === true;
      const hasPneumatosis = radiographicFindings.pneumatosisIntestinalis === true;
      const hasShockOrAcidosis = clinicalPresentation.septicShockOrAcidosis === true ||
        (bloodPh !== undefined && bloodPh < 7.20) ||
        (serumLactateMmolL !== undefined && serumLactateMmolL >= 4.0);
      const hasSevereThrombocytopenia = plateletCount !== undefined && plateletCount < 50000;

      if (hasFreeAir) {
        bellStage = 'STAGE_IIIB_PERFORATED';
        surgicalUrgency = currentWeightGrams < 1000 ? 'URGENT_BEDSIDE_DRAIN' : 'EMERGENT_OPERATING_ROOM';
      } else if (hasShockOrAcidosis || hasSevereThrombocytopenia) {
        bellStage = 'STAGE_IIIA_ADVANCED_INTACT';
        surgicalUrgency = 'CONSERVATIVE_MEDICAL_STABILIZATION'; // Surgical consultation on standby
      } else if (hasPneumatosis || hasPortalGas) {
        bellStage = 'STAGE_II_PROVEN';
        surgicalUrgency = 'CONSERVATIVE_MEDICAL_STABILIZATION';
      } else {
        bellStage = 'STAGE_I_SUSPECTED';
        surgicalUrgency = 'CONSERVATIVE_MEDICAL_STABILIZATION';
      }

      airwayVentStrategy = (bellStage === 'STAGE_IIIB_PERFORATED' || bellStage === 'STAGE_IIIA_ADVANCED_INTACT')
        ? 'Elective intubation and mechanical ventilation to alleviate diaphragmatic splinting and respiratory acidosis from severe abdominal distention.'
        : 'Supportive oxygenation; intubate if recurrent apneas or severe abdominal distention compromise ventilation.';

      decompressionRegimen = `Insert ${replogleSizeFr} Fr double-lumen Replogle tube to continuous low suction (-20 to -30 mmHg). Strict NPO. Decompress stomach and upper bowel continuously. Measure aspirate Q2-4H.`;
      fluidResuscitationTarget = 'AGGRESSIVE RESUSCITATION: 140 - 160 mL/kg/day total fluids. Bolus with 10-20 mL/kg isotonic saline for hypovolemic septic shock. Replace third-space sequestration.';
      antimicrobialRegimen = 'BROAD-SPECTRUM TRIPLE REGIMEN: Ampicillin (100 mg/kg/dose) + Gentamicin (4-5 mg/kg Q24-36H) or Cefotaxime + Metronidazole (15 mg/kg loading, then 7.5 mg/kg Q12H) to cover Gram-positive, Gram-negative enteric bacilli, and anaerobes.';

      // Contraindications
      contraindications.push({
        intervention: 'Enteral Nutrition / Oral Feeds',
        hazard: 'Substrate for rapid bacterial proliferation, gas formation, worsening bowel ischemia, and perforation.',
        absoluteContraindication: true
      });
      contraindications.push({
        intervention: 'Rectal Temperatures or Enemas / Thermometers',
        hazard: 'Risk of iatrogenic perforation of ischemic, fragile rectal/colonic wall.',
        absoluteContraindication: true
      });
      if (hasFreeAir) {
        contraindications.push({
          intervention: 'Continued Conservative Non-Surgical Management in Frank Pneumoperitoneum',
          hazard: 'Untreated gastrointestinal perforation leads to progressive septic peritonitis, multisystem organ failure, and death.',
          absoluteContraindication: true
        });
      }

      // Co-anomalies
      coAnomalyScreen.push('Serial Abdominal Radiographs (AXR) Q6-8H (Supine AP and Left Lateral Decubitus or Cross-Table Lateral) to detect early free air.');
      coAnomalyScreen.push('Serial Platelet Count & Coagulation Profile Q12H: Rapid plummeting platelets (< 50,000) or DIC heralds bowel gangrene/necrosis.');
      coAnomalyScreen.push('Serial Blood Gases & Lactate Q6H: Refractory metabolic acidosis is an ominous marker of extensive dead gut.');

      // Plan
      plan.push({
        step: 1,
        action: 'Strict NPO and immediately place Replogle tube to continuous low suction (-20 to -30 mmHg).',
        urgency: 'STAT_EMERGENT',
        rationale: 'Halts enteral bacterial substrate and decompresses distended loops to improve mesenteric microcirculation.'
      });
      plan.push({
        step: 2,
        action: 'Initiate broad-spectrum triple antibiotics: Ampicillin + Gentamicin + Metronidazole immediately.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Halts systemic bacteremia and translocation of enteric anaerobes and Gram-negative organisms.'
      });
      plan.push({
        step: 3,
        action: 'Volume resuscitation with 10-20 mL/kg isotonic crystalloid boluses; maintain MAP > gestational age equivalent.',
        urgency: 'STAT_EMERGENT',
        rationale: 'Combats severe capillary leak and third-space fluid loss into bowel lumen and peritoneal cavity.'
      });

      if (hasFreeAir) {
        if (currentWeightGrams < 1000) {
          plan.push({
            step: 4,
            action: 'STAT PEDIATRIC SURGERY: Bedside Primary Peritoneal Drainage (PPD / Penrose drain) in Right Lower Quadrant under local anesthesia for ELBW infant (< 1000g).',
            urgency: 'STAT_EMERGENT',
            rationale: 'Temporizes perforation and stabilizes hemodynamics in fragile micropreemies who cannot tolerate laparotomy.'
          });
        } else {
          plan.push({
            step: 4,
            action: 'STAT OPERATING ROOM ACTIVATION: Emergent exploratory laparotomy with bowel resection and enterostomy for intestinal perforation.',
            urgency: 'STAT_EMERGENT',
            rationale: 'Definitive source control and resection of necrotic bowel.'
          });
        }
      } else {
        plan.push({
          step: 4,
          action: 'Alert Pediatric Surgery service for early consult and joint surveillance. Serial AXR Q6-8H.',
          urgency: 'URGENT',
          rationale: 'Enables rapid transition to intervention if clinical deterioration or perforation develops.'
        });
      }
      break;
    }
  }

  return {
    emergencyType,
    bellStage,
    surgicalUrgency,
    airwayVentStrategy,
    decompressionRegimen,
    fluidResuscitationTarget,
    antimicrobialRegimen,
    contraindicatedInterventions: contraindications,
    syndromicAndCoAnomalyScreen: coAnomalyScreen,
    clinicalActionPlan: plan
  };
}

// 2. MONITOR SURGICAL DECOMPRESSION EFFICACY
export function evaluateSurgicalDecompression(input: DecompressionMonitoringInput): DecompressionMonitoringResult {
  const {
    suctionPressureMmhg,
    aspirateVolumeMl,
    aspirateCharacter,
    abdominalExam
  } = input;

  const directives: string[] = [];
  let suctionStatus: DecompressionMonitoringResult['suctionStatus'] = 'OPTIMAL_CONTINUOUS_DRAIN';
  let decompressionEffective = true;

  // Suction pressure check (Target -20 to -30 mmHg)
  const absPressure = Math.abs(suctionPressureMmhg);
  if (absPressure > 40) {
    suctionStatus = 'EXCESSIVE_PRESSURE_RISK';
    directives.push(`HIGH SUCTION HAZARD: Suction pressure (${absPressure} mmHg) exceeds safe neonatal threshold (-20 to -30 mmHg). High suction causes mucosal adherence, gastric erosions, and lumen invagination. Reduce immediately to -25 mmHg.`);
  } else if (absPressure < 15) {
    suctionStatus = 'INSUFFICIENT_SUCTION';
    directives.push(`SUBOPTIMAL DECOMPRESSION: Suction pressure (${absPressure} mmHg) is insufficient to overcome viscous enteric resistance. Increase to -20 to -30 mmHg.`);
    decompressionEffective = false;
  } else {
    suctionStatus = 'OPTIMAL_CONTINUOUS_DRAIN';
    directives.push(`Suction pressure (${absPressure} mmHg) is optimal for neonatal mucosal preservation and continuous drainage.`);
  }

  // Aspirate volume & character evaluation
  let aspirateRisk = 'Benign gastric aspirate';
  const charLower = aspirateCharacter.toLowerCase();

  if (charLower.includes('bilious') || charLower.includes('bilio-viscous') || charLower.includes('green')) {
    aspirateRisk = 'BILIOUS ENTERIC ASPIRATE: Indicates distal duodenal or jejunal drainage. In neonates, bilious aspirates signify mechanical bowel obstruction (volvulus, malrotation, atresia) until proven otherwise.';
    directives.push('BILIOUS DRAINAGE PROTOCOL: Keep Replogle on continuous suction, maintain strict NPO, send aspirate for culture, and ensure fluid replacement milliliter-for-milliliter with 0.45% NS + 20 mEq/L KCl if drainage exceeds 20 mL/kg/day.');
  } else if (charLower.includes('feculent')) {
    aspirateRisk = 'FECULENT ASPIRATE: High-grade distal bowel obstruction, severe bacterial overgrowth, or enterocutaneous / gastrocolic fistulization. Stat surgical consult.';
    directives.push('STAT SURGICAL NOTIFICATION: Feculent drainage indicates long-standing low intestinal stasis or necrotic perforation.');
  } else if (charLower.includes('hemorrhagic') || charLower.includes('gross blood')) {
    aspirateRisk = 'GROSSLY HEMORRHAGIC DRAINAGE: Gastric mucosal ulceration, coagulopathy/DIC, or bowel transmural infarction. Check platelets and coags.';
    directives.push('BLEEDING DIRECTIVE: Irrigate Replogle gently with room-temperature saline, administer IV Vitamin K, check platelet count and fibrinogen, and prepare FFP / platelets if coagulopathic.');
  } else if (charLower.includes('salivary')) {
    aspirateRisk = 'SALIVARY SECRETIONS: Consistent with blind esophageal pouch in TEF/EA. Continuous suction prevents pulmonary micro-aspiration.';
  }

  // Abdominal Exam & Effectiveness Check
  const examLower = abdominalExam.toLowerCase();
  if (examLower.includes('rigid') || examLower.includes('tense') || examLower.includes('erythema') || examLower.includes('peritonitis')) {
    decompressionEffective = false;
    directives.push('PERITONEAL RE-EVALUATION: Abdominal wall erythema, fixed discoloration, or rigidity indicates peritonitis or underlying gangrenous bowel. Urgent cross-table lateral AXR to rule out perforation.');
  }

  if (aspirateVolumeMl === 0 && (examLower.includes('distended') || examLower.includes('tense'))) {
    suctionStatus = 'LUMEN_OCCLUSION_SUSPECTED';
    decompressionEffective = false;
    directives.push('TUBE OCCLUSION ALERT: Distended abdomen with zero aspirate suggests Replogle sump eyelet occlusion or tube displacement. Flush vent lumen with 0.5 - 1.0 mL air; gently irrigate main lumen with 1-2 mL sterile saline and re-aspirate.');
  }

  return {
    decompressionEffective,
    suctionStatus,
    aspirateRiskAssessment: aspirateRisk,
    directives
  };
}

// 3. DATABASE OPERATIONS
export async function saveSurgicalEvaluation(record: SurgicalEvaluationInput & SurgicalEvaluationResult) {
  const result = await pool.query(
    `INSERT INTO neonatal_surgical_evaluations (
      patient_id, surgical_emergency_type, gestational_age_weeks, current_weight_grams,
      clinical_presentation, radiographic_findings, bell_stage, airway_vent_strategy,
      decompression_regimen, surgical_urgency, contraindicated_interventions, clinical_action_plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      record.patientId,
      record.emergencyType,
      record.gestationalAgeWeeks,
      record.currentWeightGrams,
      JSON.stringify(record.clinicalPresentation),
      JSON.stringify(record.radiographicFindings),
      record.bellStage || null,
      record.airwayVentStrategy,
      record.decompressionRegimen,
      record.surgicalUrgency,
      JSON.stringify(record.contraindicatedInterventions),
      JSON.stringify(record.clinicalActionPlan)
    ]
  );
  return result.rows[0];
}

export async function getPatientSurgicalEvaluations(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM neonatal_surgical_evaluations WHERE patient_id = $1 ORDER BY evaluated_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}

export async function saveDecompressionLog(log: DecompressionMonitoringInput & DecompressionMonitoringResult) {
  const result = await pool.query(
    `INSERT INTO surgical_decompression_logs (
      patient_id, emergency_type, replogle_size_fr, suction_pressure_mmhg,
      aspirate_volume_ml, aspirate_character, abdominal_exam, decompression_effective, directives
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      log.patientId,
      log.emergencyType,
      log.replogleSizeFr,
      log.suctionPressureMmhg,
      log.aspirateVolumeMl,
      log.aspirateCharacter,
      log.abdominalExam,
      log.decompressionEffective,
      log.directives.join(' | ')
    ]
  );
  return result.rows[0];
}

export async function getPatientDecompressionLogs(patientId: number) {
  const result = await pool.query(
    'SELECT * FROM surgical_decompression_logs WHERE patient_id = $1 ORDER BY logged_at DESC LIMIT 50',
    [patientId]
  );
  return result.rows;
}
