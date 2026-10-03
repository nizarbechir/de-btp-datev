using FinanceService as service from '../../srv/services';

// ---------------------------------------------------------------------------
// Bank transactions and payment matching
// ---------------------------------------------------------------------------

annotate service.BankTransactions with @(
  UI.HeaderInfo                  : {
    TypeName      : '{i18n>BankTransaction}',
    TypeNamePlural: '{i18n>BankTransactions}',
    Title         : {Value: counterpartyName},
    Description   : {Value: reference},
    TypeImageUrl  : 'sap-icon://loan'
  },
  UI.SelectionFields             : [
    bookingDate,
    matchStatus_code,
    direction,
    counterpartyName
  ],
  UI.LineItem                    : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.confirmMatch',
      Label : '{i18n>ConfirmMatch}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.ignore',
      Label : '{i18n>Ignore}'
    },
    {
      Value         : bookingDate,
      @UI.Importance: #High
    },
    {
      Value         : counterpartyName,
      @UI.Importance: #High
    },
    {Value: reference},
    {
      Value         : amount,
      @UI.Importance: #High
    },
    {
      Value         : matchStatus_code,
      Criticality   : matchStatusCriticality,
      @UI.Importance: #High
    },
    {Value: suggestedSalesInvoice_ID},
    {Value: suggestedSupplierInvoice_ID},
    {Value: suggestionReason}
  ],
  UI.PresentationVariant         : {
    SortOrder     : [{
      Property  : bookingDate,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.SelectionVariant #ToConfirm : {
    Text         : '{i18n>ToConfirm}',
    SelectOptions: [{
      PropertyName: matchStatus_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'SUGGESTED'
      }]
    }]
  },
  UI.SelectionVariant #Unmatched : {
    Text         : '{i18n>Unmatched}',
    SelectOptions: [{
      PropertyName: matchStatus_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'UNMATCHED'
      }]
    }]
  },
  UI.SelectionVariant #Matched   : {
    Text         : '{i18n>Matched}',
    SelectOptions: [{
      PropertyName: matchStatus_code,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'MATCHED'
      }]
    }]
  },
  UI.SelectionVariant #All       : {
    Text         : '{i18n>All}',
    SelectOptions: []
  },
  UI.Identification              : [
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'FinanceService.confirmMatch',
      Label      : '{i18n>ConfirmMatch}',
      Criticality: #Positive
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.matchManually',
      Label : '{i18n>MatchManually}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.ignore',
      Label : '{i18n>Ignore}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'FinanceService.unmatch',
      Label : '{i18n>Unmatch}'
    }
  ],
  UI.DataPoint #amount           : {
    Value: amount,
    Title: '{i18n>Amount}'
  },
  UI.DataPoint #status           : {
    Value      : matchStatus_code,
    Title      : '{i18n>MatchStatus}',
    Criticality: matchStatusCriticality
  },
  UI.HeaderFacets                : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#amount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    }
  ],
  UI.FieldGroup #Booking         : {Data: [
    {Value: bookingDate},
    {Value: valueDate},
    {Value: amount},
    {Value: direction},
    {Value: counterpartyName},
    {Value: counterpartyIBAN},
    {Value: reference},
    {Value: externalReference},
    {Value: importBatch_ID}
  ]},
  UI.FieldGroup #Match           : {Data: [
    {Value: matchStatus_code},
    {Value: suggestedSalesInvoice_ID},
    {Value: suggestedSupplierInvoice_ID},
    {Value: suggestionReason}
  ]},
  UI.Facets                      : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Booking',
      Label : '{i18n>Booking}',
      Target: '@UI.FieldGroup#Booking'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Match',
      Label : '{i18n>Matching}',
      Target: '@UI.FieldGroup#Match'
    }
  ]
);

annotate service.BankTransactions with {
  matchStatus @(
    Common.Text                    : matchStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

annotate service.BankTransactions actions {
  confirmMatch  @(
    Core.OperationAvailable: {$edmJson: {$Eq: [{$Path: 'in/matchStatus_code'}, 'SUGGESTED']}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  ignore        @(
    Core.OperationAvailable: {$edmJson: {$Ne: [{$Path: 'in/matchStatus_code'}, 'MATCHED']}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  unmatch       @(
    Core.OperationAvailable: {$edmJson: {$Or: [{$Eq: [{$Path: 'in/matchStatus_code'}, 'MATCHED']}, {$Eq: [{$Path: 'in/matchStatus_code'}, 'IGNORED']}]}},
    Common.IsActionCritical: true,
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  matchManually @(
    Core.OperationAvailable: {$edmJson: {$Ne: [{$Path: 'in/matchStatus_code'}, 'MATCHED']}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  )(
    salesInvoice    @Common.ValueList: {
      CollectionPath: 'SalesInvoices',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: salesInvoice,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'invoiceNumber'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'outstandingAmount'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'isIssued',
          Constant         : true
        }
      ]
    },
    supplierInvoice @Common.ValueList: {
      CollectionPath: 'SupplierInvoices',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: supplierInvoice,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'invoiceNumber'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'outstandingAmount'
        }
      ]
    }
  );
};

annotate service.SalesInvoices with {
  ID @Common.Text: invoiceNumber;
};

annotate service.SupplierInvoices with {
  ID @Common.Text: invoiceNumber;
};

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

annotate service.Payments with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Payment}',
    TypeNamePlural: '{i18n>Payments}',
    Title         : {Value: reference},
    TypeImageUrl  : 'sap-icon://payment-approval'
  },
  UI.SelectionFields    : [
    paymentDate,
    direction,
    source
  ],
  UI.LineItem           : [
    {
      Value         : paymentDate,
      @UI.Importance: #High
    },
    {Value: direction},
    {
      Value         : amount,
      @UI.Importance: #High
    },
    {Value: salesInvoice_ID},
    {Value: supplierInvoice_ID},
    {Value: source},
    {Value: reference}
  ],
  UI.PresentationVariant: {
    SortOrder     : [{
      Property  : paymentDate,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.FieldGroup #General: {Data: [
    {Value: paymentDate},
    {Value: direction},
    {Value: amount},
    {Value: salesInvoice_ID},
    {Value: supplierInvoice_ID},
    {Value: source},
    {Value: reference}
  ]},
  UI.Facets             : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'General',
    Label : '{i18n>General}',
    Target: '@UI.FieldGroup#General'
  }]
);
