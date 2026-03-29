import store from '../store.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { uid, nowIso, findById } from '../lib/helpers.js';

function calcMonthlyPayment(principal, annualRatePct, termMonths) {
  if (principal <= 0 || annualRatePct <= 0 || termMonths <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = termMonths;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

export function calculate(req, res) {
  try {
    const {
      netIncome, ownerSalary, personalAddbacks, oneTimeAdjustments,
      marketRateManagement, askingPrice, downPaymentPct, sellerNotePct,
      seniorDebtRatePct, seniorDebtTermMonths, sellerNoteRatePct, sellerNoteTermMonths,
    } = req.validated;

    const grossSDE          = netIncome + ownerSalary + personalAddbacks + oneTimeAdjustments;
    const normalizedSDE     = grossSDE - marketRateManagement;
    const downPayment       = (askingPrice * downPaymentPct) / 100;
    const sellerNoteAmount  = (askingPrice * sellerNotePct) / 100;
    const seniorDebtAmount  = askingPrice - downPayment - sellerNoteAmount;
    const monthlyDebtService =
      calcMonthlyPayment(seniorDebtAmount, seniorDebtRatePct, seniorDebtTermMonths) +
      calcMonthlyPayment(sellerNoteAmount, sellerNoteRatePct, sellerNoteTermMonths);
    const annualDebtService  = monthlyDebtService * 12;
    const dscr               = annualDebtService > 0 ? parseFloat((normalizedSDE / annualDebtService).toFixed(4)) : 0;
    const postDebtCashFlow   = normalizedSDE - annualDebtService;
    const multiple           = askingPrice > 0 && normalizedSDE > 0 ? parseFloat((askingPrice / normalizedSDE).toFixed(2)) : 0;

    const riskFlags = [];
    if (dscr > 0 && dscr < 1.25)     riskFlags.push({ type: 'dscr',     message: `DSCR ${dscr.toFixed(2)}x below minimum 1.25x` });
    if (multiple > 5.5)               riskFlags.push({ type: 'multiple', message: `Multiple ${multiple.toFixed(1)}x above typical 3–5x range` });
    if (downPaymentPct < 10)          riskFlags.push({ type: 'equity',   message: 'Down payment below 10% SBA minimum' });
    if (normalizedSDE > 0 && (normalizedSDE / (askingPrice || 1)) < 0.15)
      riskFlags.push({ type: 'margin', message: 'SDE margin appears thin' });

    res.json({ grossSDE, normalizedSDE, downPayment, seniorDebtAmount, sellerNoteAmount, monthlyDebtService, annualDebtService, dscr, postDebtCashFlow, multiple, riskFlags });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Calculation failed');
  }
}

export function listScenarios(req, res) {
  try {
    const { dealId } = req.query;
    let results = [...store.underwritingScenarios];
    if (dealId) results = results.filter((s) => s.dealId === dealId);
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(results);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve scenarios');
  }
}

export function createScenario(req, res) {
  try {
    const scenario = { id: uid(), createdAt: nowIso(), ...req.body };
    store.underwritingScenarios.push(scenario);
    res.status(201).json(scenario);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to save scenario');
  }
}

export function deleteScenario(req, res) {
  try {
    const exists = findById(store.underwritingScenarios, req.params.id);
    if (!exists) return errorResponse(res, 404, 'NOT_FOUND', 'Scenario not found');
    store.underwritingScenarios = store.underwritingScenarios.filter((s) => s.id !== req.params.id);
    res.status(204).end();
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to delete scenario');
  }
}
