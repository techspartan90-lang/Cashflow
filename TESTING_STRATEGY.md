# Testing Strategy & Quality Assurance Framework

## 1. Testing Philosophy & Financial Reliability
In financial software, subtle computation errors or non-deterministic projections can cause catastrophic business decisions. Our testing philosophy mandates:
1. **Mathematical Invariants are Non-Negotiable:** Ending balances must reconcile exactly across all projection days.
2. **Deterministic Reproducibility:** The same input ledger state must produce identical forecast runs down to the cent.
3. **Non-Destruction Verification:** Simulation engines must be proven via unit tests never to alter underlying actuals.
4. **Zero-Flake Test Execution:** Fast, isolated Vitest execution without relying on live external networks.

---

## 2. Test Taxonomy & Suite Breakdown

| Test Suite File | Scope / Focus | Total Tests | Status |
|---|---|:---:|:---:|
| `src/services/__tests__/financial-invariants.test.ts` | Mathematical invariant $\text{EndingCash}(t) = \text{BeginningCash}(t) + \text{Inflows}(t) - \text{Outflows}(t)$, IEEE-754 drift prevention, CCC metrics | 4 | **Passed** |
| `src/services/__tests__/forecast-engine.test.ts` | 30-day projection horizon, rollforward continuity, AR/AP scheduling, liquidity buffer breaches | 4 | **Passed** |
| `src/services/__tests__/alert-engine.test.ts` | Deterministic alphanumeric fingerprinting, alert deduplication, overdue receivable alerts | 3 | **Passed** |
| `src/services/__tests__/scenario-isolation.test.ts` | Base forecast immutability, date shifting, parameter sweeps | 1 | **Passed** |
| `tests/forecast-engine.test.ts` | Comprehensive deterministic rollforward, multi-account consolidation, recurring payment schedules | 18 | **Passed** |
| `tests/scenario-simulation.test.ts` | Multi-assumption chaining, sales drops, expense shocks, sensitivity sweeps | 10 | **Passed** |
| `tests/data-quality.test.ts` | Missing due dates, zero values, negative amounts, out-of-order transactions | 4 | **Passed** |
| `tests/import-processing.test.ts` | CSV delimiter detection, date parsing, column normalization, bank statement formats | 14 | **Passed** |
| `tests/financial-calculator.test.ts` | Fixed-point cents conversion, add, subtract, multiply, divide, round2 edge cases | 16 | **Passed** |
| `tests/validation.test.ts` | Schema validation, invalid date formats, extreme numeric boundaries | 11 | **Passed** |
| **Total Automated Tests** | | **85** | **100% Passed** |

---

## 3. Running Automated Tests

### 3.1 All Unit & Integration Tests
```bash
npm test
```

### 3.2 Watch Mode (Local Development)
```bash
npx vitest
```

### 3.3 Static Type Checking & Linting
```bash
npm run lint
```
