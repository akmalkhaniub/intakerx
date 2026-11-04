import { Router, Request, Response } from 'express';
import { FhirGatewayService, CdsHookRequest } from '../services/fhirGateway';

const router = Router();

// ============================================================================
// FHIR R4 CONFORMANCE & RESOURCE ENDPOINTS
// ============================================================================

/**
 * GET /api/fhir/r4/metadata
 * Returns FHIR R4 CapabilityStatement (Conformance).
 */
router.get('/metadata', (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:5000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}/api/fhir/r4`;
  const statement = FhirGatewayService.getCapabilityStatement(baseUrl);
  res.setHeader('Content-Type', 'application/fhir+json');
  return res.json(statement);
});

/**
 * GET /api/fhir/r4/Patient/:id
 * Returns FHIR R4 Patient resource.
 */
router.get('/Patient/:id', async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.id, 10);
    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid Patient ID format' });
    }

    const patient = await FhirGatewayService.getFhirPatient(patientId);
    if (!patient) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [{ severity: 'error', code: 'not-found', diagnostics: `Patient ${patientId} not found` }]
      });
    }

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json(patient);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/fhir/r4/Observation
 * Returns FHIR R4 Observation resources for a patient.
 */
router.get('/Observation', async (req: Request, res: Response) => {
  try {
    const patientParam = (req.query.patient || req.query.subject || '1') as string;
    const patientId = parseInt(patientParam.replace('Patient/', ''), 10) || 1;

    const observations = await FhirGatewayService.getFhirObservations(patientId);
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: observations.length,
      entry: observations.map(o => ({ resource: o }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/fhir/r4/Condition
 * Returns FHIR R4 Condition resources for a patient.
 */
router.get('/Condition', async (req: Request, res: Response) => {
  try {
    const patientParam = (req.query.patient || req.query.subject || '1') as string;
    const patientId = parseInt(patientParam.replace('Patient/', ''), 10) || 1;

    const conditions = await FhirGatewayService.getFhirConditions(patientId);
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: conditions.length,
      entry: conditions.map(c => ({ resource: c }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/fhir/r4/CarePlan
 * Returns FHIR R4 CarePlan (Century Orchestration Plan) for a patient.
 */
router.get('/CarePlan', async (req: Request, res: Response) => {
  try {
    const patientParam = (req.query.patient || req.query.subject || '1') as string;
    const patientId = parseInt(patientParam.replace('Patient/', ''), 10) || 1;

    const carePlan = await FhirGatewayService.getFhirCarePlan(patientId);
    res.setHeader('Content-Type', 'application/fhir+json');
    if (!carePlan) {
      return res.json({ resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] });
    }
    return res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [{ resource: carePlan }]
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/fhir/r4/Flag
 * Returns FHIR R4 Flags (Cross-phase safety contraindications).
 */
router.get('/Flag', async (req: Request, res: Response) => {
  try {
    const patientParam = (req.query.patient || req.query.subject || '1') as string;
    const patientId = parseInt(patientParam.replace('Patient/', ''), 10) || 1;

    const flags = await FhirGatewayService.getFhirFlags(patientId);
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json({
      resourceType: 'Bundle',
      type: 'searchset',
      total: flags.length,
      entry: flags.map(f => ({ resource: f }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// CDS HOOKS 1.0 DISCOVERY & EXECUTION ENDPOINTS
// ============================================================================

/**
 * GET /cds-services
 * CDS Discovery endpoint returning available CDS services.
 */
router.get('/cds-services', (_req: Request, res: Response) => {
  const services = FhirGatewayService.getCdsServicesList();
  return res.json({ services });
});

/**
 * POST /cds-services/:id
 * CDS Service execution endpoint returning CDS Cards.
 */
router.post('/cds-services/:id', async (req: Request, res: Response) => {
  try {
    const serviceId = req.params.id;
    const hookRequest: CdsHookRequest = req.body;

    if (!hookRequest || !hookRequest.context) {
      return res.status(400).json({ error: 'Invalid CDS Hook request: missing context' });
    }

    const response = await FhirGatewayService.executeCdsHook(serviceId, hookRequest);
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
