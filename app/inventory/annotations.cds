using InventoryService as service from '../../srv/services';

// ---------------------------------------------------------------------------
// Stock of the goods with stock tracking; opening a product shows its movements
// ---------------------------------------------------------------------------

annotate service.Products with @(
  UI.HeaderInfo          : {
    TypeName      : '{i18n>Product}',
    TypeNamePlural: '{i18n>Inventory}',
    Title         : {Value: name},
    Description   : {Value: code},
    TypeImageUrl  : 'sap-icon://inventory'
  },
  UI.SelectionFields     : [
    stockStatus,
    defaultSupplier_ID
  ],
  UI.LineItem            : [
    {
      Value         : name,
      @UI.Importance: #High
    },
    {Value: code},
    {
      Value         : stockOnHand,
      @UI.Importance: #High
    },
    {Value: reorderLevel},
    {Value: unit},
    {
      Value         : stockStatus,
      Criticality   : stockStatusCriticality,
      @UI.Importance: #High
    }
  ],
  UI.PresentationVariant : {
    SortOrder     : [{Property: name}],
    Visualizations: ['@UI.LineItem']
  },
  UI.Identification      : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'InventoryService.adjustStock',
      Label : '{i18n>AdjustStock}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'InventoryService.returnToSupplier',
      Label : '{i18n>SupplierReturn}'
    }
  ],
  UI.DataPoint #stock    : {
    Value: stockOnHand,
    Title: '{i18n>StockOnHand}'
  },
  UI.DataPoint #status   : {
    Value      : stockStatus,
    Title      : '{i18n>StockStatus}',
    Criticality: stockStatusCriticality
  },
  UI.HeaderFacets        : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#stock'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    }
  ],
  UI.FieldGroup #Product : {Data: [
    {Value: code},
    {Value: ean},
    {Value: unit},
    {Value: reorderLevel},
    {Value: defaultSupplier_ID},
    {Value: purchasePrice},
    {Value: defaultPrice}
  ]},
  UI.Facets              : [
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Product',
      Label : '{i18n>General}',
      Target: '@UI.FieldGroup#Product'
    },
    {
      $Type : 'UI.ReferenceFacet',
      ID    : 'Movements',
      Label : '{i18n>StockMovements}',
      Target: 'stockMovements/@UI.PresentationVariant'
    }
  ]
);

annotate service.Products with {
  stockStatus @Common.ValueListWithFixedValues: false;
};

annotate service.Products actions {
  adjustStock      @(
    Core.OperationAvailable: {$edmJson: {$Not: {$Path: 'in/readOnly'}}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/stockMovements']
    }
  )(reason @Common.FieldControl: #Mandatory);
  returnToSupplier @(
    Core.OperationAvailable: {$edmJson: {$Not: {$Path: 'in/readOnly'}}},
    Common.SideEffects     : {
      TargetProperties: ['in/*'],
      TargetEntities  : ['in/stockMovements']
    }
  );
};

annotate service.StockMovements with @(
  UI.LineItem           : [
    {Value: movementDate},
    {Value: type_code},
    {
      Value      : quantity,
      Criticality: quantityCriticality
    },
    {Value: reason},
    {Value: supplierInvoice_ID},
    {Value: deliveryNote_ID},
    {Value: createdBy}
  ],
  UI.PresentationVariant: {
    SortOrder     : [{
      Property  : createdAt,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  }
);
