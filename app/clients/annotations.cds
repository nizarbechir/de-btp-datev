using ClientService as service from '../../srv/services';

// The client cockpit: one tab per list, and the tax firm with its staff and clients.
// Field labels come from the domain model (srv/services/labels.cds).

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

annotate service.Clients with @(
  UI.SelectionFields     : [name],
  UI.LineItem            : [
    {Value: name},
    {
      Value      : openTasks,
      Criticality: openTasksCriticality
    },
    {Value: openQuestions},
    {Value: missingDocuments},
    {Value: uncategorized},
    {Value: unprocessedReceipts},
    {Value: unmatchedTransactions},
    {Value: lastExportAt}
  ],
  // Clients with the most open work first
  UI.PresentationVariant : {SortOrder: [{
    Property  : openTasks,
    Descending: true
  }]}
) {
  openTasks            @title: '{i18n>OpenTasks}';
  openTasksCriticality @UI.Hidden;
};

// ---------------------------------------------------------------------------
// Open items across all clients
// ---------------------------------------------------------------------------

annotate service.OpenQuestions with @(
  UI.SelectionFields    : [
    clientName,
    createdBy,
    createdAt
  ],
  UI.LineItem           : [
    {Value: clientName},
    {Value: text},
    {Value: record},
    {Value: createdBy},
    {Value: authorRole},
    {Value: createdAt}
  ],
  UI.PresentationVariant: {SortOrder: [{
    Property  : createdAt,
    Descending: true
  }]}
) {
  clientName @title: '{i18n>Client}';
  record     @title: '{i18n>RecordReference}';
};

annotate service.SupplierInvoicesToReview with @(
  UI.SelectionFields: [
    clientName,
    hasDocument,
    isCategorized,
    invoiceDate
  ],
  UI.LineItem       : [
    {Value: clientName},
    {Value: invoiceNumber},
    {Value: supplierName},
    {Value: invoiceDate},
    {Value: grossAmount},
    {Value: hasDocument},
    {Value: isCategorized}
  ]
) {
  clientName   @title: '{i18n>Client}';
  supplierName @title: '{i18n>SupplierName}';
  grossAmount  @Measures.ISOCurrency: currency_code;
};

annotate service.NewReceipts with @(
  UI.SelectionFields: [
    clientName,
    processingStatus_code,
    uploadedAt
  ],
  UI.LineItem       : [
    {Value: clientName},
    {Value: originalFileName},
    {
      Value      : processingStatus_code,
      Criticality: statusCriticality
    },
    {Value: extractedSupplierName},
    {Value: extractedGrossAmount},
    {Value: uploadedAt}
  ]
) {
  clientName           @title: '{i18n>Client}';
  extractedGrossAmount @Measures.ISOCurrency: extractedCurrency_code;
};

annotate service.UnmatchedTransactions with @(
  UI.SelectionFields: [
    clientName,
    bookingDate
  ],
  UI.LineItem       : [
    {Value: clientName},
    {Value: bookingDate},
    {Value: counterpartyName},
    {Value: reference},
    {Value: amount}
  ]
) {
  clientName @title: '{i18n>Client}';
  amount     @Measures.ISOCurrency: currency_code;
};

// ---------------------------------------------------------------------------
// Tax firm
// ---------------------------------------------------------------------------

annotate service.TaxFirms with @(
  UI.HeaderInfo      : {
    TypeName      : '{i18n>TaxFirm}',
    TypeNamePlural: '{i18n>TaxFirm}',
    Title         : {Value: name},
    TypeImageUrl  : 'sap-icon://building'
  },
  UI.FieldGroup #Main: {Data: [{Value: name}]},
  UI.Facets          : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Main',
      Label : '{i18n>General}',
      Target: '@UI.FieldGroup#Main'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Staff',
      Label : '{i18n>TaxFirmStaff}',
      Target: 'staff/@UI.LineItem'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Clients',
      Label : '{i18n>Clients}',
      Target: 'clients/@UI.LineItem'
    }
  ]
) {
  // Clients come from invitations, so the firm cannot add them.
  clients @Capabilities.InsertRestrictions.Insertable: false;
};

annotate service.TaxFirmStaff with @(UI.LineItem: [
  {Value: userId},
  {Value: role}
]);

annotate service.TaxFirmClients with @(
  UI.HeaderInfo: {
    TypeName      : '{i18n>Client}',
    TypeNamePlural: '{i18n>Clients}',
    Title         : {Value: clientName}
  },
  UI.LineItem  : [{Value: clientName}],
  UI.Facets    : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'Assignments',
    Label : '{i18n>AssignedStaff}',
    Target: 'assignments/@UI.LineItem'
  }]
);

annotate service.TaxFirmAssignments with @(UI.LineItem: [{Value: staff_ID}]) {
  staff @(
    Common.Text           : staff.userId,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath: 'TaxFirmStaff',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterOut',
          LocalDataProperty: staff_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'userId'
        }
      ]
    }
  );
};
