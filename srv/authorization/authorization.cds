using from '../services/finance-service';

annotate FinanceService with @(requires: [
    'InvoiceManager',
    'system-user'
]);
