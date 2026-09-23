/**
 * Financial Invariants Test Suite
 * Validates the core arithmetic formula:
 * EndingCash(t) = BeginningCash(t) + Inflows(t) - Outflows(t)
 * Tests cents-based precision, zero-drift guarantees, and Cash Conversion Cycle metrics.
 */
import { describe, it, expect } from 'vitest';
import { MonetaryMath, CashConversionCycle } from '../financial-calculator';

describe('Financial Invariants & Arithmetic Correctness', () => {
  it('guarantees EndingCash(t) = BeginningCash(t) + Inflows(t) - Outflows(t)', () => {
    const beginningCash = 125000.55;
    const inflows = 45230.25;
    const outflows = 21780.35;

    // MonetaryMath uses exact integer cents conversion
    const endingCash = MonetaryMath.add(
      beginningCash,
      MonetaryMath.subtract(inflows, outflows)
    );

    // Theoretical exact: 125000.55 + 45230.25 - 21780.35 = 148450.45
    expect(endingCash).toBe(148450.45);
  });

  it('prevents IEEE-754 binary floating-point contamination (0.1 + 0.2 === 0.3)', () => {
    // In IEEE-754: 0.1 + 0.2 === 0.30000000000000004
    const floatingSum = 0.1 + 0.2;
    expect(floatingSum).not.toBe(0.3);

    // In MonetaryMath integer cents:
    const safeSum = MonetaryMath.add(0.1, 0.2);
    expect(safeSum).toBe(0.3);
  });

  it('guarantees multi-account transfers net to zero total organizational cash change', () => {
    const accountABalance = 50000.0;
    const accountBBalance = 15000.0;
    const totalBeginning = MonetaryMath.add(accountABalance, accountBBalance);

    const transferAmount = 12345.67;
    const newAccountA = MonetaryMath.subtract(accountABalance, transferAmount);
    const newAccountB = MonetaryMath.add(accountBBalance, transferAmount);
    const totalEnding = MonetaryMath.add(newAccountA, newAccountB);

    expect(totalEnding).toBe(totalBeginning);
    expect(MonetaryMath.subtract(totalEnding, totalBeginning)).toBe(0);
  });

  it('correctly calculates Cash Conversion Cycle (CCC = DIO + DSO - DPO)', () => {
    const cccResult = CashConversionCycle.calculate({
      inventoryValue: 100000,
      cogsAnnual: 800000,
      accountsReceivable: 65000,
      totalCreditSalesAnnual: 1200000,
      accountsPayable: 45000,
      totalPurchasesAnnual: 750000,
    });

    // DIO = (100000 / 800000) * 365 = 45.625 -> ~45.6 days
    // DSO = (65000 / 1200000) * 365 = 19.77 -> ~19.8 days
    // DPO = (45000 / 750000) * 365 = 21.9 days
    // CCC = 45.625 + 19.771 - 21.9 = 43.496 -> ~43.5 days
    expect(cccResult.dio).toBeCloseTo(45.6, 1);
    expect(cccResult.dso).toBeCloseTo(19.8, 1);
    expect(cccResult.dpo).toBeCloseTo(21.9, 1);
    expect(cccResult.ccc).toBeCloseTo(43.5, 1);
  });
});
