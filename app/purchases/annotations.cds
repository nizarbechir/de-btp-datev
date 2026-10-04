using PurchasingService as service from '../../srv/services';

// ---------------------------------------------------------------------------
// Supplier invoices
// ---------------------------------------------------------------------------

annotate service.SupplierInvoices with @(
  UI.HeaderInfo             : {
    TypeName      : '{i18n>SupplierInvoice}',
    TypeNamePlural: '{i18n>SupplierInvoices}',
    Title         : {Value: invoiceNumber},
    Description   : {Value: supplier.name},
    TypeImageUrl  : 'sap-icon://receipt'
  },
  UI.SelectionFields        : [
    supplier_ID,
    expenseCategory_ID,
    paymentStatus_code,
    isOverdue,
    invoiceDate,
    dueDate
  ],
  UI.LineItem               : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.markInvoicePaid',
      Label : '{i18n>MarkPaid}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.markInvoiceOpen',
      Label : '{i18n>MarkOpen}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.bookGoodsReceipt',
      Label : '{i18n>BookGoodsReceipt}'
    },
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: grossAmount},
    {Value: outstandingAmount},
    {Value: expenseCategory_ID},
    {
      Value      : status,
      Criticality: statusCriticality
    }
  ],
  UI.PresentationVariant    : {
    SortOrder     : [{
      Property  : dueDate,
      Descending: false
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.SelectionVariant #All  : {
    Text         : '{i18n>All}',
    SelectOptions: []
  },
  UI.SelectionVariant #Open : {
    Text         : '{i18n>Open}',
    SelectOptions: [{
      PropertyName: paymentStatus_code,
      Ranges      : [{
        Sign  : #E,
        Option: #EQ,
        Low   : 'PAID'
      }]
    }]
  },
  UI.SelectionVariant #Paid : {
    Text         : '{i18n>Paid}',
    SelectOptions: [{
      PropertyName: status,
      Ranges      : [{
        Sign  : #I,
        Option: #EQ,
        Low   : 'Paid'
      }]
    }]
  },
  // Header and actions of the invoice detail page
  UI.Identification         : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.recordPayment',
      Label : '{i18n>RecordPayment}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.markInvoicePaid',
      Label : '{i18n>MarkPaid}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.markInvoiceOpen',
      Label : '{i18n>MarkOpen}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.addComment',
      Label : '{i18n>AddComment}'
    }
  ],
  UI.DataPoint #grossAmount : {
    Value: grossAmount,
    Title: '{i18n>GrossAmount}'
  },
  UI.DataPoint #status      : {
    Value      : status,
    Title      : '{i18n>Status}',
    Criticality: statusCriticality
  },
  UI.DataPoint #dueDate     : {
    Value: dueDate,
    Title: '{i18n>DueDate}'
  },
  UI.HeaderFacets           : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#grossAmount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#dueDate'
    }
  ],
  UI.FieldGroup #General    : {Data: [
    {Value: supplier_ID},
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: expenseCategory_ID}
  ]},
  UI.FieldGroup #Amounts    : {Data: [
    {Value: netAmount},
    {Value: taxAmount},
    {Value: grossAmount},
    {Value: currency_code}
  ]},
  UI.FieldGroup #Payment    : {Data: [
    {
      Value      : status,
      Criticality: statusCriticality
    },
    {Value: paidAmount},
    {Value: outstandingAmount},
    {Value: paymentDate}
  ]},
  UI.FieldGroup #Document   : {Data: [
    {Value: documentContent},
    {
      Value        : documentHint,
      @UI.Hidden: IsActiveEntity
    }
  ]},
  UI.FieldGroup #Notes      : {Data: [{Value: notes}]},
  UI.Facets                 : [
    // Upload first: the document fills in the invoice data below
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Document',
      Label : '{i18n>Document}',
      Target: '@UI.FieldGroup#Document'
    },
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Details',
      Label : '{i18n>General}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'General',
          Label : '{i18n>General}',
          Target: '@UI.FieldGroup#General'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Amounts',
          Label : '{i18n>Amounts}',
          Target: '@UI.FieldGroup#Amounts'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Payment',
          Label : '{i18n>Payment}',
          Target: '@UI.FieldGroup#Payment'
        }
      ]
    },
    // Optional: expenses need no items; goods bought for stock do
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Items',
      Label : '{i18n>Items}',
      Target: 'items/@UI.LineItem'
    },
    {
      $Type     : 'UI.ReferenceFacet',
      ID        : 'Payments',
      Label     : '{i18n>Payments}',
      Target    : 'payments/@UI.LineItem#Invoice',
      @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Notes',
      Label : '{i18n>Notes}',
      Target: '@UI.FieldGroup#Notes'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Comments',
      Label : '{i18n>Comments}',
      Target: 'comments/@UI.LineItem'
    }
  ],
  // Recalculate gross amount and status while editing
  Common.SideEffects #Amounts: {
    SourceProperties: [
      netAmount,
      taxAmount
    ],
    TargetProperties: ['grossAmount']
  },
  // An uploaded document proposes the invoice data (see supplier-invoice-prefill.ts)
  Common.SideEffects #Document: {
    SourceProperties: [documentContent],
    TargetProperties: [
      'supplier_ID',
      'supplier/name',
      'invoiceNumber',
      'invoiceDate',
      'dueDate',
      'currency_code',
      'netAmount',
      'taxAmount',
      'grossAmount',
      'status',
      'statusCriticality'
    ]
  },
  Common.SideEffects #Items  : {
    SourceEntities  : [items],
    SourceProperties: [
      items.quantity,
      items.unitPrice,
      items.taxRate,
      items.productService_ID
    ],
    TargetProperties: [
      'netAmount',
      'taxAmount',
      'grossAmount'
    ],
    TargetEntities  : [items]
  },
  Common.SideEffects #Status : {
    SourceProperties: [dueDate],
    TargetProperties: [
      'status',
      'statusCriticality'
    ]
  }
);

annotate service.SupplierInvoices with {
  supplier      @(
    Common.Text           : supplier.name,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath: 'Suppliers',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: supplier_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'city'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
  paymentStatus   @(
    Common.Text                    : paymentStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
  expenseCategory @(
    Common.ValueListWithFixedValues: true,
    Common.ValueList               : {
      CollectionPath: 'ExpenseCategories',
      Parameters    : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: expenseCategory_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
};

annotate service.SupplierInvoices actions {
  // Comments and questions, also from the tax advisor
  addComment @(
    Core.OperationAvailable: {$edmJson: {$Path: 'in/IsActiveEntity'}},
    Common.SideEffects     : {TargetEntities: ['in/comments']}
  );
  markInvoicePaid @(
    // Only on saved invoices, not while editing
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [
      {$Ne: [{$Path: 'in/paymentStatus_code'}, 'PAID']},
      {$Path: 'in/IsActiveEntity'}
    ]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments']
    }
  );
  recordPayment   @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [
      {$Ne: [{$Path: 'in/paymentStatus_code'}, 'PAID']},
      {$Path: 'in/IsActiveEntity'}
    ]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments']
    }
  )(amount @UI.ParameterDefaultValue: in.outstandingAmount);
  markInvoiceOpen @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [
      {$Ne: [{$Path: 'in/paymentStatus_code'}, 'OPEN']},
      {$Path: 'in/IsActiveEntity'}
    ]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/payments']
    }
  );
};

annotate service.SupplierInvoices actions {
  bookGoodsReceipt @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Path: 'in/IsActiveEntity'}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {TargetEntities: ['in/items']}
  );
};

annotate service.SupplierInvoiceItems with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>Item}',
    TypeNamePlural: '{i18n>Items}',
    Title         : {Value: description}
  },
  UI.LineItem           : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.receiveGoods',
      Inline: true,
      Label : '{i18n>BookGoodsReceipt}'
    },
    {
      Value             : productService_ID,
      @HTML5.CssDefaults: {width: '12rem'}
    },
    {
      Value             : description,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '20rem'}
    },
    {
      Value             : quantity,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '6rem'}
    },
    {
      Value             : unit,
      @HTML5.CssDefaults: {width: '7rem'}
    },
    {
      Value             : unitPrice,
      @UI.Importance    : #High,
      @HTML5.CssDefaults: {width: '9rem'}
    },
    {
      Value             : taxRate,
      @HTML5.CssDefaults: {width: '6rem'}
    },
    {
      Value             : grossAmount,
      @HTML5.CssDefaults: {width: '9rem'}
    },
    {
      Value             : receivedQuantity,
      @HTML5.CssDefaults: {width: '7rem'}
    }
  ],
  UI.PresentationVariant: {
    SortOrder     : [{Property: position}],
    Visualizations: ['@UI.LineItem']
  },
  Common.SideEffects #Product: {
    SourceProperties: [productService_ID],
    TargetProperties: [
      'description',
      'unit',
      'unitPrice',
      'taxRate',
      'netAmount',
      'grossAmount'
    ]
  }
);

annotate service.SupplierInvoiceItems with {
  productService @(
    Common.Text           : productService.name,
    Common.TextArrangement: #TextOnly,
    Common.ValueList      : {
      CollectionPath : 'ProductServices',
      SearchSupported: true,
      Parameters     : [
        {
          $Type            : 'Common.ValueListParameterInOut',
          LocalDataProperty: productService_ID,
          ValueListProperty: 'ID'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'name'
        },
        {
          $Type            : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty: 'purchasePrice'
        },
        {
          $Type            : 'Common.ValueListParameterConstant',
          ValueListProperty: 'active',
          Constant         : true
        }
      ]
    }
  );
};

annotate service.SupplierInvoiceItems actions {
  // Received now: proposes what is still open on the line
  receiveGoods @(
    Core.OperationAvailable: {$edmJson: {$And: [{$Path: 'in/IsActiveEntity'}, {$Gt: [{$Path: 'in/openQuantity'}, 0]}]}},
    Common.SideEffects     : {TargetProperties: ['in/receivedQuantity', 'in/openQuantity']}
  )(quantity @UI.ParameterDefaultValue: in.openQuantity);
};

annotate service.Payments with @(UI.LineItem #Invoice: [
  {Value: paymentDate},
  {Value: amount},
  {Value: source},
  {Value: reference}
]);

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

annotate service.Suppliers with @(
  UI.HeaderInfo              : {
    TypeName      : '{i18n>Supplier}',
    TypeNamePlural: '{i18n>Suppliers}',
    Title         : {Value: name},
    Description   : {Value: supplierNumber},
    TypeImageUrl  : 'sap-icon://supplier'
  },
  UI.SelectionFields         : [
    active,
    city,
    country_code
  ],
  UI.LineItem                : [
    {
      Value         : name,
      @UI.Importance: #High
    },
    {Value: supplierNumber},
    {Value: city},
    {Value: country_code},
    {Value: email},
    {Value: phone},
    {
      Value         : balance.openAmount,
      @UI.Importance: #High
    },
    {
      Value         : active,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant     : {
    SortOrder     : [{Property: name}],
    Visualizations: ['@UI.LineItem']
  },
  UI.DataPoint #invoiceCount : {
    Value: balance.invoiceCount,
    Title: '{i18n>InvoiceCount}'
  },
  UI.DataPoint #openAmount   : {
    Value: balance.openAmount,
    Title: '{i18n>OpenAmount}'
  },
  UI.HeaderFacets            : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#invoiceCount'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#openAmount'
    }
  ],
  UI.FieldGroup #General     : {Data: [
    {Value: name},
    {Value: supplierNumber},
    {Value: taxNumber},
    {Value: vatId},
    {Value: active}
  ]},
  UI.FieldGroup #Contact     : {Data: [
    {Value: email},
    {Value: phone},
    {Value: address},
    {Value: postalCode},
    {Value: city},
    {Value: country_code}
  ]},
  UI.FieldGroup #BankDetails : {Data: [{Value: iban}]},
  UI.FieldGroup #Notes       : {Data: [{Value: notes}]},
  UI.Facets                  : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'Details',
      Label : '{i18n>General}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'General',
          Label : '{i18n>General}',
          Target: '@UI.FieldGroup#General'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'Contact',
          Label : '{i18n>Contact}',
          Target: '@UI.FieldGroup#Contact'
        },
        {
          $Type : 'UI.ReferenceFacet',
          ID    : 'BankDetails',
          Label : '{i18n>BankDetails}',
          Target: '@UI.FieldGroup#BankDetails'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Invoices',
      Label : '{i18n>SupplierInvoices}',
      Target: 'invoices/@UI.LineItem#SupplierInvoices'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Notes',
      Label : '{i18n>Notes}',
      Target: '@UI.FieldGroup#Notes'
    }
  ]
);

annotate service.Suppliers with {
  country @(
    Common.Text                    : country.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

// Invoices table on the supplier detail page
annotate service.SupplierInvoices with @(
  UI.LineItem #SupplierInvoices: [
    {Value: invoiceNumber},
    {Value: invoiceDate},
    {Value: dueDate},
    {Value: grossAmount},
    {
      Value      : status,
      Criticality: statusCriticality
    }
  ]
);

// ---------------------------------------------------------------------------
// Document inbox
// ---------------------------------------------------------------------------

annotate service.IncomingDocuments with @(
  UI.HeaderInfo                : {
    TypeName      : '{i18n>IncomingDocument}',
    TypeNamePlural: '{i18n>Inbox}',
    Title         : {Value: originalFileName},
    Description   : {Value: processingMessage},
    TypeImageUrl  : 'sap-icon://inbox'
  },
  UI.SelectionFields           : [
    processingStatus_code,
    detectedDocumentType
  ],
  UI.LineItem                  : [
    {
      Value         : originalFileName,
      @UI.Importance: #High
    },
    {Value: uploadedAt},
    {Value: detectedDocumentType},
    {Value: extractedSupplierName},
    {Value: extractedInvoiceNumber},
    {Value: extractedGrossAmount},
    {
      Value         : processingStatus_code,
      Criticality   : statusCriticality,
      @UI.Importance: #High
    },
    // Book straight from the list: select a document, check the proposed data, done
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'PurchasingService.createSupplierInvoice',
      Label      : '{i18n>CreateSupplierInvoice}',
      Criticality: #Positive
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.ignore',
      Label : '{i18n>Ignore}'
    }
  ],
  UI.PresentationVariant       : {
    SortOrder     : [{
      Property  : uploadedAt,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.SelectionVariant #ToDo    : {
    Text         : '{i18n>ToProcess}',
    SelectOptions: [{
      PropertyName: processingStatus_code,
      Ranges      : [
        {
          Sign  : #I,
          Option: #EQ,
          Low   : 'NEW'
        },
        {
          Sign  : #I,
          Option: #EQ,
          Low   : 'ERROR'
        }
      ]
    }]
  },
  UI.SelectionVariant #All     : {
    Text         : '{i18n>All}',
    SelectOptions: []
  },
  UI.Identification            : [
    {
      $Type      : 'UI.DataFieldForAction',
      Action     : 'PurchasingService.createSupplierInvoice',
      Label      : '{i18n>CreateSupplierInvoice}',
      Criticality: #Positive
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.process',
      Label : '{i18n>Process}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.ignore',
      Label : '{i18n>Ignore}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'PurchasingService.addComment',
      Label : '{i18n>AddComment}'
    }
  ],
  UI.DataPoint #status         : {
    Value      : processingStatus_code,
    Title      : '{i18n>Status}',
    Criticality: statusCriticality
  },
  UI.HeaderFacets              : [{
    $Type : 'UI.ReferenceFacet',
    Target: '@UI.DataPoint#status'
  }],
  UI.FieldGroup #Document      : {Data: [
    {Value: content},
    {Value: originalFileName},
    {Value: notes}
  ]},
  UI.FieldGroup #Extracted     : {Data: [
    {Value: detectedDocumentType},
    {Value: extractedSupplier_ID},
    {Value: extractedSupplierName},
    {Value: extractedVatId},
    {Value: extractedIBAN},
    {Value: extractedInvoiceNumber},
    {Value: extractedInvoiceDate},
    {Value: extractedDueDate},
    {Value: extractedNetAmount},
    {Value: extractedTaxAmount},
    {Value: extractedGrossAmount}
  ]},
  UI.FieldGroup #Result        : {Data: [
    {Value: processingMessage},
    {Value: linkedSupplierInvoice_ID}
  ]},
  UI.Facets                    : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Document',
      Label : '{i18n>Document}',
      Target: '@UI.FieldGroup#Document'
    },
    {
      $Type     : 'UI.ReferenceFacet',
      ID        : 'Extracted',
      Label     : '{i18n>InvoiceData}',
      Target    : '@UI.FieldGroup#Extracted',
      @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
    },
    {
      $Type     : 'UI.ReferenceFacet',
      ID        : 'Result',
      Label     : '{i18n>Processing}',
      Target    : '@UI.FieldGroup#Result',
      @UI.Hidden: {$edmJson: {$Not: {$Path: 'IsActiveEntity'}}}
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Comments',
      Label : '{i18n>Comments}',
      Target: 'comments/@UI.LineItem'
    }
  ]
);

annotate service.IncomingDocuments with {
  processingStatus @(
    Common.Text                    : processingStatus.name,
    Common.TextArrangement         : #TextOnly,
    Common.ValueListWithFixedValues: true
  );
};

annotate service.IncomingDocuments actions {
  // Comments and questions, also from the tax advisor
  addComment @(
    Core.OperationAvailable: {$edmJson: {$Path: 'in/IsActiveEntity'}},
    Common.SideEffects     : {TargetEntities: ['in/comments']}
  );
  process               @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Ne: [{$Path: 'in/processingStatus_code'}, 'PROCESSED']}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  ignore                @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Ne: [{$Path: 'in/processingStatus_code'}, 'PROCESSED']}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
  createSupplierInvoice @(
    Core.OperationAvailable: {$edmJson: {$And: [{$And: [{$Ne: [{$Path: 'in/processingStatus_code'}, 'PROCESSED']}, {$Path: 'in/IsActiveEntity'}]}, {$Not: {$Path: 'in/readOnly'}}]}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  )(
    supplier        @(
      UI.ParameterDefaultValue: in.extractedSupplier_ID,
      Common.ValueList        : {
        CollectionPath: 'Suppliers',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: supplier,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'vatId'
          }
        ]
      }
    ),
    newSupplierName @UI.ParameterDefaultValue: in.extractedSupplierName,
    invoiceNumber   @UI.ParameterDefaultValue: in.extractedInvoiceNumber,
    invoiceDate     @UI.ParameterDefaultValue: in.extractedInvoiceDate,
    dueDate         @UI.ParameterDefaultValue: in.extractedDueDate,
    netAmount       @UI.ParameterDefaultValue: in.extractedNetAmount,
    taxAmount       @UI.ParameterDefaultValue: in.extractedTaxAmount,
    expenseCategory @(
      Common.ValueListWithFixedValues: true,
      Common.ValueList               : {
        CollectionPath: 'ExpenseCategories',
        Parameters    : [
          {
            $Type            : 'Common.ValueListParameterInOut',
            LocalDataProperty: expenseCategory,
            ValueListProperty: 'ID'
          },
          {
            $Type            : 'Common.ValueListParameterDisplayOnly',
            ValueListProperty: 'name'
          }
        ]
      }
    )
  );
};

// ---------------------------------------------------------------------------
// Expense categories
// ---------------------------------------------------------------------------

annotate service.ExpenseCategories with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>ExpenseCategory}',
    TypeNamePlural: '{i18n>ExpenseCategories}',
    Title         : {Value: name},
    TypeImageUrl  : 'sap-icon://expense-report'
  },
  UI.LineItem           : [
    {Value: name},
    {Value: active}
  ],
  UI.PresentationVariant: {
    SortOrder     : [{Property: name}],
    Visualizations: ['@UI.LineItem']
  },
  UI.FieldGroup #General: {Data: [
    {Value: name},
    {Value: active}
  ]},
  UI.Facets             : [{
    $Type : 'UI.ReferenceFacet',
    ID    : 'General',
    Label : '{i18n>General}',
    Target: '@UI.FieldGroup#General'
  }]
);

// ---------------------------------------------------------------------------
// Comments and questions (e.g. from the tax advisor), resolved by the team
// ---------------------------------------------------------------------------

annotate service.FinancialComments with @(UI.LineItem: [
  {
    $Type : 'UI.DataFieldForAction',
    Action: 'PurchasingService.resolve',
    Label : '{i18n>Resolve}'
  },
  {Value: text},
  {Value: createdBy},
  {Value: authorRole},
  {Value: createdAt},
  {
    Value      : resolved,
    Criticality: resolvedCriticality
  }
]);

annotate service.FinancialComments actions {
  resolve @(
    Core.OperationAvailable: {$edmJson: {$Not: {$Path: 'in/resolved'}}},
    Common.SideEffects     : {TargetProperties: ['in/*']}
  );
};

// ---------------------------------------------------------------------------
// Create, edit and delete are hidden for the read-only tax advisor (the backend enforces it)
// ---------------------------------------------------------------------------

annotate service.Suppliers with @(
  UI.CreateHidden: {$edmJson: {$Path: '/ReadOnlyUser/readOnly'}},
  UI.UpdateHidden: readOnly,
  UI.DeleteHidden: readOnly
);

annotate service.SupplierInvoices with @(
  UI.CreateHidden: {$edmJson: {$Path: '/ReadOnlyUser/readOnly'}},
  UI.UpdateHidden: readOnly,
  UI.DeleteHidden: readOnly
);

annotate service.IncomingDocuments with @(
  // Files are added with the Upload button of the list (several at once, no draft)
  UI.CreateHidden: true,
  UI.UpdateHidden: readOnly,
  UI.DeleteHidden: readOnly
);

annotate service.ExpenseCategories with @(
  UI.CreateHidden: {$edmJson: {$Path: '/ReadOnlyUser/readOnly'}},
  UI.UpdateHidden: readOnly,
  UI.DeleteHidden: readOnly
);
