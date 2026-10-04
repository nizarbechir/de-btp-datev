using {swiver as my} from '../../db/inventory';

/**
 * Stock of the goods with stock tracking and its movements. Stock only changes through the actions
 * here and the business documents (goods receipt, delivery note, customer return); movements cannot
 * be created, changed or deleted directly.
 */
service InventoryService @(path: '/odata/v4/inventory') {
  @readonly
  entity Products           as projection on my.ProductServices {
    *,
    virtual null as readOnly : Boolean
  } where type.code = 'GOODS' and trackStock = true
    actions {
      /** Corrects the stock, e.g. -1 for a damaged item. The first booking of a product is its opening balance. */
      @title: '{i18n>AdjustStock}'
      action adjustStock(quantity : Decimal @title: '{i18n>QuantityChange}',
                         reason : String(255) @title: '{i18n>Reason}') returns Products;
      /** Books goods sent back to the supplier out of stock. */
      @title: '{i18n>SupplierReturn}'
      action returnToSupplier(quantity : Decimal @title: '{i18n>Quantity}',
                              reason : String(255) @title: '{i18n>Reason}') returns Products;
    };

  @readonly
  entity StockMovements     as projection on my.StockMovements;

  @readonly
  entity StockMovementTypes as projection on my.StockMovementTypes;

  @readonly
  entity ProductTypes       as projection on my.ProductTypes;

  @readonly
  entity Suppliers          as projection on my.Suppliers {
    ID,
    name,
    organization
  };

  @odata.singleton
  @cds.persistence.skip
  entity ReadOnlyUser {
    readOnly : Boolean;
  }
}
