using from '../services/sales-service';
using from '../services/purchasing-service';
using from '../services/finance-service';
using from '../services/organization-service';
using from '../services/tax-advisor-service';

// Any signed-in user may use Swiver; what they see is decided by their organization membership.
// Every record is restricted to the organization of the signed-in user ($user.organization),
// which the organization context middleware resolves from the user's membership. The membership
// role is mapped to the CAP roles OrganizationMember (owner, admin, member), OrganizationAdmin
// (owner, admin) and TaxAdvisor. The tax advisor reads financial data, downloads documents, runs the
// accountant export and adds comments, but changes nothing else.

annotate SalesService with @(requires: 'authenticated-user');

annotate PurchasingService with @(requires: 'authenticated-user');

annotate FinanceService with @(requires: 'authenticated-user');

annotate OrganizationService with @(requires: 'authenticated-user');

// Sales

annotate SalesService.Customers with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.ProductServices with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.Payments with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.ReminderRecords with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.CustomerBalances with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.SalesInvoices with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: ['READ', 'pdf', 'zugferd', 'addComment'],
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.SalesInvoiceItems with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'invoice.organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'invoice.organization_ID = $user.organization'
  }
]);

annotate SalesService.SalesInvoiceTaxes with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'invoice.organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'invoice.organization_ID = $user.organization'
  }
]);

// Quotes are not shared with the tax advisor.
annotate SalesService.Quotes with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  }
]);

annotate SalesService.QuoteItems with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'quote.organization_ID = $user.organization'
  }
]);

annotate SalesService.FinancialComments with @(restrict: [
  {
    grant: ['READ', 'resolve'],
    to   : ['OrganizationMember', 'TaxAdvisor'],
    where: 'organization_ID = $user.organization'
  }
]);

// Purchasing

annotate PurchasingService.Suppliers with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate PurchasingService.ExpenseCategories with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate PurchasingService.Payments with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate PurchasingService.SupplierBalances with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate PurchasingService.SupplierInvoices with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: ['READ', 'addComment'],
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate PurchasingService.IncomingDocuments with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: ['READ', 'addComment'],
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate PurchasingService.FinancialComments with @(restrict: [
  {
    grant: ['READ', 'resolve'],
    to   : ['OrganizationMember', 'TaxAdvisor'],
    where: 'organization_ID = $user.organization'
  }
]);

// Finance

annotate FinanceService.BankTransactions with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: ['READ', 'addComment'],
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.BankImportBatches with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.CashFlow with @(restrict: [{
  grant: 'READ',
  to   : ['OrganizationMember', 'TaxAdvisor'],
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.Payments with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.SalesInvoices with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.SupplierInvoices with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.Customers with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.Suppliers with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.ExpenseCategories with @(restrict: [
  {
    grant: '*',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization'
  }
]);

annotate FinanceService.FinancialComments with @(restrict: [
  {
    grant: ['READ', 'resolve'],
    to   : ['OrganizationMember', 'TaxAdvisor'],
    where: 'organization_ID = $user.organization'
  }
]);

// The dashboard, VAT overview and accountant export are open to the tax advisor; importing
// statements and suggesting matches are not.
annotate FinanceService.importBankStatement with @(requires: 'OrganizationMember');

annotate FinanceService.suggestMatches with @(requires: 'OrganizationMember');

// Organization: settings and members are maintained by owners and admins. A user sees all
// organizations they belong to (to switch between them); the tax advisor sees only their own
// membership, invitation and actions.

annotate OrganizationService.Organizations with @(restrict: [
  {
    grant: ['READ', 'switchTo'],
    to   : 'authenticated-user',
    where: 'exists members[userId = $user]'
  },
  {
    grant: '*',
    to   : 'OrganizationAdmin',
    where: 'ID = $user.organization'
  }
]);

annotate OrganizationService.CompanySettings with @(restrict: [
  {
    grant: 'READ',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: '*',
    to   : 'OrganizationAdmin',
    where: 'organization_ID = $user.organization'
  }
]);

annotate OrganizationService.Memberships with @(restrict: [
  {
    grant: 'READ',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: '*',
    to   : 'OrganizationAdmin',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization and userId = $user'
  }
]);

annotate OrganizationService.Invitations with @(restrict: [
  {
    grant: 'READ',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: '*',
    to   : 'OrganizationAdmin',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization and acceptedBy = $user'
  }
]);

annotate OrganizationService.AuditLogEntries with @(restrict: [
  {
    grant: 'READ',
    to   : 'OrganizationAdmin',
    where: 'organization_ID = $user.organization'
  },
  {
    grant: 'READ',
    to   : 'OrganizationMember',
    where: 'organization_ID = $user.organization and actor = $user'
  },
  {
    grant: 'READ',
    to   : 'TaxAdvisor',
    where: 'organization_ID = $user.organization and actor = $user'
  }
]);

// Tax advisor workspace: read-only, for tax advisors and for owners and admins.
annotate TaxAdvisorService with @(requires: [
  'TaxAdvisor',
  'OrganizationAdmin'
]);

annotate TaxAdvisorService.Questions with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.SupplierInvoices with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.SalesInvoices with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.Receipts with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.BankTransactions with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.Payments with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.Suppliers with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.Customers with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

annotate TaxAdvisorService.ExpenseCategories with @(restrict: [{
  grant: 'READ',
  to   : [
    'TaxAdvisor',
    'OrganizationAdmin'
  ],
  where: 'organization_ID = $user.organization'
}]);

// Only users with the Swiver role collection (scope InvoiceManager) may create a new organization.
// Everybody else gets access by invitation only (members and tax advisors need no role collection),
// so logging in with an arbitrary account of the identity provider does not open Swiver for sign-up.
annotate OrganizationService.createOrganization with @(requires: 'InvoiceManager');

// The complete data export of an organization is for its owners and admins only.
annotate OrganizationService.exportOrganizationData with @(requires: 'OrganizationAdmin');
