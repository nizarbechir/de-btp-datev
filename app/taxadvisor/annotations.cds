using TaxAdvisorService as service from '../../srv/services';

// The tax advisor workspace: one filter bar and one table per kind of record.
// Field labels come from the domain model (srv/services/labels.cds).

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------

annotate service.Questions with @(
  UI.SelectionFields: [
    resolved,
    recordType,
    authorRole,
    createdBy,
    createdAt
  ],
  UI.LineItem       : [
    {Value: text},
    {Value: recordType},
    {Value: record},
    {Value: createdBy},
    {Value: authorRole},
    {Value: createdAt},
    {
      Value      : resolved,
      Criticality: resolvedCriticality
    },
    {Value: resolvedBy},
    {Value: resolvedAt}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : createdAt,
    Descending: true
  }]}
) {
  recordType @title: '{i18n>Record}';
  record     @title: '{i18n>RecordReference}';
  // Open questions first
  resolved   @Common.FilterDefaultValue: false;
};

// ---------------------------------------------------------------------------
// Supplier invoices
// ---------------------------------------------------------------------------

annotate service.SupplierInvoices with @(
  UI.SelectionFields: [
    invoiceDate,
    supplier_ID,
    expenseCategory_ID,
    paymentStatus_code,
    missingDocument,
    uncategorized,
    isOverdue
  ],
  UI.LineItem       : [
    {Value: invoiceNumber},
    {Value: supplierName},
    {Value: supplierVatId},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: expenseCategory_ID},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount},
    {
      Value      : status,
      Criticality: statusCriticality
    },
    {Value: paymentDate},
    {Value: documentContent},
    {
      Value      : missingDocument,
      Criticality: #Critical
    },
    {Value: uncategorized}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : invoiceDate,
    Descending: true
  }]}
) {
  supplierName       @title: '{i18n>Supplier}';
  supplierVatId      @title: '{i18n>VatId}';
  missingDocument    @title: '{i18n>MissingDocument}';
  uncategorized      @title: '{i18n>Uncategorized}';
  isOverdue          @title: '{i18n>Overdue}';
  supplier           @(
    Common.Text           : supplierName,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath: 'Suppliers',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterOut',
          LocalDataProperty: supplier_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        }
      ]
    }
  );
  expenseCategory    @(
    Common.Text                    : expenseCategory.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true,
    Common.ValueList               : {
      CollectionPath: 'ExpenseCategories',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterOut',
          LocalDataProperty: expenseCategory_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        }
      ]
    }
  );
  paymentStatus      @(
    Common.Text                    : paymentStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

annotate service.Suppliers with {
  ID   @UI.Hidden  @Common.Text: name;
  name @title: '{i18n>Name}';
};

annotate service.ExpenseCategories with {
  ID   @UI.Hidden  @Common.Text: name;
  name @title: '{i18n>Name}';
};

// ---------------------------------------------------------------------------
// Sales invoices
// ---------------------------------------------------------------------------

annotate service.SalesInvoices with @(
  // Read-only here; replaces the edit rules of the domain model, which use fields not shown here.
  Capabilities.UpdateRestrictions: {Updatable: false},
  UI.UpdateHidden                : true,
  UI.SelectionFields: [
    invoiceDate,
    customer_ID,
    status_code,
    paymentStatus_code,
    isOverdue
  ],
  UI.LineItem       : [
    {Value: invoiceNumber},
    {Value: customerName},
    {Value: customerVatId},
    {Value: invoiceDate},
    {Value: servicePeriodStart},
    {Value: servicePeriodEnd},
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount},
    {Value: status_code},
    {Value: paymentStatus_code},
    {Value: paymentDate}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : invoiceDate,
    Descending: true
  }]}
) {
  customerName  @title: '{i18n>Customer}';
  customerVatId @title: '{i18n>VatId}';
  isOverdue     @title: '{i18n>Overdue}';
  customer      @(
    Common.Text           : customerName,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath: 'Customers',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterOut',
          LocalDataProperty: customer_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'displayName'
        }
      ]
    }
  );
  status        @(
    Common.Text                    : status.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  paymentStatus @(
    Common.Text                    : paymentStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

annotate service.Customers with {
  ID          @UI.Hidden  @Common.Text: displayName;
  displayName @title: '{i18n>Customer}';
};

// ---------------------------------------------------------------------------
// Receipts (purchase inbox)
// ---------------------------------------------------------------------------

annotate service.Receipts with @(
  UI.SelectionFields: [
    uploadedAt,
    processingStatus_code,
    detectedDocumentType
  ],
  UI.LineItem       : [
    {Value: originalFileName},
    {Value: content},
    {Value: uploadedAt},
    {
      Value      : processingStatus_code,
      Criticality: statusCriticality
    },
    {Value: detectedDocumentType},
    {Value: extractedSupplierName},
    {Value: extractedInvoiceNumber},
    {Value: extractedInvoiceDate},
    {Value: extractedGrossAmount},
    {Value: linkedInvoiceNumber}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : uploadedAt,
    Descending: true
  }]}
) {
  linkedInvoiceNumber @title: '{i18n>SupplierInvoice}';
  processingStatus    @(
    Common.Text                    : processingStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

// ---------------------------------------------------------------------------
// Bank transactions
// ---------------------------------------------------------------------------

annotate service.BankTransactions with @(
  UI.SelectionFields: [
    bookingDate,
    matchStatus_code,
    direction,
    counterpartyName
  ],
  UI.LineItem       : [
    {Value: bookingDate},
    {Value: counterpartyName},
    {Value: reference},
    {Value: amount},
    {Value: direction},
    {
      Value      : matchStatus_code,
      Criticality: matchStatusCriticality
    },
    {Value: salesInvoiceNumber},
    {Value: supplierInvoiceNumber}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : bookingDate,
    Descending: true
  }]}
) {
  direction             @title: '{i18n>Direction}';
  salesInvoiceNumber    @title: '{i18n>SalesInvoice}';
  supplierInvoiceNumber @title: '{i18n>SupplierInvoice}';
  matchStatus           @(
    Common.Text                    : matchStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

annotate service.Payments with @(
  UI.SelectionFields: [
    paymentDate,
    direction,
    source
  ],
  UI.LineItem       : [
    {Value: paymentDate},
    {Value: direction},
    {Value: amount},
    {Value: reference},
    {Value: source},
    {Value: salesInvoiceNumber},
    {Value: customerName},
    {Value: supplierInvoiceNumber},
    {Value: supplierName}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : paymentDate,
    Descending: true
  }]}
) {
  salesInvoiceNumber    @title: '{i18n>SalesInvoice}';
  customerName          @title: '{i18n>Customer}';
  supplierInvoiceNumber @title: '{i18n>SupplierInvoice}';
  supplierName          @title: '{i18n>Supplier}';
};
