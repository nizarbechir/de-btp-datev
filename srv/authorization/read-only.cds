using from '../services/sales-service';
using from '../services/purchasing-service';
using from '../services/finance-service';

// readOnly is true for the tax advisor (set by registerReadOnlyFlag). The UI uses it to hide create,
// edit, delete and the business actions; the @restrict annotations enforce the same in the backend.

extend projection SalesService.Customers with {
  virtual null as readOnly : Boolean
};

extend projection SalesService.ProductServices with {
  virtual null as readOnly : Boolean
};

extend projection SalesService.SalesInvoices with {
  virtual null as readOnly : Boolean
};

extend projection PurchasingService.Suppliers with {
  virtual null as readOnly : Boolean
};

extend projection PurchasingService.SupplierInvoices with {
  virtual null as readOnly : Boolean
};

extend projection PurchasingService.IncomingDocuments with {
  virtual null as readOnly : Boolean
};

extend projection PurchasingService.ExpenseCategories with {
  virtual null as readOnly : Boolean
};

extend projection FinanceService.BankTransactions with {
  virtual null as readOnly : Boolean
};

// The same flag for the signed-in user, for the Create buttons of the list reports (UI.CreateHidden).
extend service SalesService with {
  @odata.singleton
  @cds.persistence.skip
  entity ReadOnlyUser {
    readOnly : Boolean;
  }
}

extend service PurchasingService with {
  @odata.singleton
  @cds.persistence.skip
  entity ReadOnlyUser {
    readOnly : Boolean;
  }
}
