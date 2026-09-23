import React from 'react';
import { LoanObligation, TaxObligation } from '../../types/financial';
import { ShieldCheck, Landmark, FileText, AlertCircle, Calendar } from 'lucide-react';

interface ObligationsViewProps {
  loans: LoanObligation[];
  taxes: TaxObligation[];
  currencySymbol: string;
}

export const ObligationsView: React.FC<ObligationsViewProps> = ({
  loans,
  taxes,
  currencySymbol,
}) => {
  const totalPrincipalRemaining = loans.reduce((sum, l) => sum + l.principalRemaining, 0);
  const totalMonthlyEmi = loans.reduce((sum, l) => sum + l.monthlyEmi, 0);
  const totalUpcomingTaxes = taxes
    .filter((t) => t.status !== 'paid')
    .reduce((sum, t) => sum + (t.confirmedObligation || t.estimatedObligation), 0);

  return (
    <div className="space-y-6">
      {/* 1. Header with Aggregate Metrics */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center">
            <ShieldCheck className="h-4 w-4 mr-1.5 text-indigo-600" />
            Committed Debt Obligations & Statutory Tax Schedules
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Non-negotiable cash commitments: Bank loans, interest amortization, and statutory tax filings (GST & TDS).
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Total Outstanding Loan Principal</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">
              {currencySymbol}
              {totalPrincipalRemaining.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Active MSME term & working capital facilities
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Monthly Debt Service (EMI)</span>
            <div className="text-xl font-bold text-rose-700 mt-0.5">
              {currencySymbol}
              {totalMonthlyEmi.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Next debit: {loans[0]?.nextDueDate || 'Oct 7'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Upcoming Statutory Tax Obligations</span>
            <div className="text-xl font-bold text-amber-700 mt-0.5">
              {currencySymbol}
              {totalUpcomingTaxes.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              GST GSTR-3B & Section 194C/J TDS
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bank Loan Facilities Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
            <Landmark className="h-4 w-4 mr-1.5 text-indigo-600" />
            Commercial Bank Loans & Credit Lines
          </div>
          <span className="text-xs text-slate-500">
            {loans.length} Active Credit Facility
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Lender & Facility</th>
                <th className="px-3 py-2 text-right">Principal Remaining</th>
                <th className="px-3 py-2 text-center">Interest Rate</th>
                <th className="px-3 py-2 text-right">Monthly EMI</th>
                <th className="px-3 py-2 text-right">Principal/Interest Split</th>
                <th className="px-3 py-2">Debit Due Date</th>
                <th className="px-3 py-2 text-center">Tenure Remaining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-semibold text-slate-900">
                    <div>{loan.lenderName}</div>
                    <div className="text-[10px] text-slate-500 capitalize">
                      {loan.loanType.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                    {currencySymbol}
                    {loan.principalRemaining.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-center font-medium text-slate-700">
                    {loan.annualInterestRate}% p.a.
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-rose-700">
                    {currencySymbol}
                    {loan.monthlyEmi.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600">
                    <div>
                      Principal: ₹{loan.principalPortion.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Interest: ₹{loan.interestPortion.toLocaleString('en-IN')}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {loan.nextDueDate}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600 font-medium">
                    {loan.remainingTenureMonths} Months
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Statutory Tax Obligations Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
            <FileText className="h-4 w-4 mr-1.5 text-amber-600" />
            Statutory Tax Obligations & Filing Milestones
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            Mandatory Statutory Deadlines
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Tax Type</th>
                <th className="px-3 py-2">Filing Period / Scope</th>
                <th className="px-3 py-2 text-right">Estimated Obligation</th>
                <th className="px-3 py-2 text-right">Confirmed Payable</th>
                <th className="px-3 py-2">Statutory Due Date</th>
                <th className="px-3 py-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxes.map((tax) => {
                const isImminent = tax.dueDate <= '2026-09-25';

                return (
                  <tr key={tax.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-900">
                      <div>{tax.taxType.replace('_', ' ')}</div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 font-medium">
                      {tax.period}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700">
                      {currencySymbol}
                      {tax.estimatedObligation.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-rose-700">
                      {currencySymbol}
                      {tax.confirmedObligation.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">
                      <div className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1 text-slate-400" />
                        {tax.dueDate}
                        {isImminent && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                            Imminent
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        {tax.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
