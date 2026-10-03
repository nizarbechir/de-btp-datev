using from '../services/sales-service';
using from '../services/purchasing-service';
using from '../services/finance-service';
using from '../services/organization-service';

// Any signed-in user may use Swiver; what they see is decided by their organization membership.
// Every record is restricted to the organization of the signed-in user ($user.organization),
// which the organization context middleware resolves from the user's membership.

annotate SalesService with @(requires: 'authenticated-user');

annotate PurchasingService with @(requires: 'authenticated-user');

annotate FinanceService with @(requires: 'authenticated-user');

annotate OrganizationService with @(requires: 'authenticated-user');

annotate SalesService.Customers with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.ProductServices with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.SalesInvoices with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.Quotes with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.Payments with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.ReminderRecords with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.CustomerBalances with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate PurchasingService.Suppliers with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate PurchasingService.SupplierInvoices with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate PurchasingService.IncomingDocuments with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate PurchasingService.ExpenseCategories with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate PurchasingService.Payments with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate PurchasingService.SupplierBalances with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.BankTransactions with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.BankImportBatches with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.Payments with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.SalesInvoices with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.SupplierInvoices with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate OrganizationService.CompanySettings with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate OrganizationService.Memberships with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate SalesService.SalesInvoiceItems with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'invoice.organization_ID = $user.organization'
}]);

annotate SalesService.SalesInvoiceTaxes with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'invoice.organization_ID = $user.organization'
}]);

annotate SalesService.QuoteItems with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'quote.organization_ID = $user.organization'
}]);

annotate OrganizationService.Organizations with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'ID = $user.organization'
}]);
annotate FinanceService.Customers with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.Suppliers with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

annotate FinanceService.ExpenseCategories with @(restrict: [{
  grant: '*',
  to   : 'authenticated-user',
  where: 'organization_ID = $user.organization'
}]);

