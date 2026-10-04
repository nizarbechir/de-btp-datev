using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';
using {
  swiver.SupplierInvoices,
  swiver.SupplierInvoiceItems
} from './schema';
using {
  swiver.DeliveryNotes,
  swiver.DeliveryNoteItems,
  swiver.ProductServices,
  swiver.Quantity
} from './sales';
using {swiver.OrganizationOwned} from './organizations';

namespace swiver;

/**
 * The stock ledger: every change of the stock of a product is one movement, booked only by the
 * business actions (goods receipt, delivery, returns, adjustment) and never changed or deleted
 * afterwards. Mistakes are corrected with an adjustment. Only goods with stock tracking have movements.
 * TODO(feature): multiple warehouses, stock valuation (FIFO / average) and COGS bookings
 */
entity StockMovements : cuid, managed, OrganizationOwned {
  product             : Association to ProductServices @mandatory;
  type                : Association to StockMovementTypes @mandatory;
  // Positive into stock, negative out of stock.
  quantity            : Quantity @mandatory;
  movementDate        : Date @mandatory;
  reason              : String(255);
  // The business document that caused the movement, if any.
  supplierInvoice     : Association to SupplierInvoices;
  supplierInvoiceItem : Association to SupplierInvoiceItems;
  deliveryNote        : Association to DeliveryNotes;
  deliveryNoteItem    : Association to DeliveryNoteItems;
  quantityCriticality : Integer = (case when quantity < 0 then 1 else 3 end);
}

entity StockMovementTypes : CodeList {
  key code : String(20) enum {
        openingBalance = 'OPENING_BALANCE';
        goodsReceipt   = 'GOODS_RECEIPT';
        delivery       = 'DELIVERY';
        customerReturn = 'CUSTOMER_RETURN';
        supplierReturn = 'SUPPLIER_RETURN';
        adjustment     = 'ADJUSTMENT';
      };
}

/** Stock on hand per product: the sum of its movements. */
@readonly
view StockLevels as
  select from StockMovements {
    key product.ID      as product_ID,
        organization.ID as organization_ID : UUID,
        sum(quantity)   as quantity        : Quantity
  }
  group by
    product.ID,
    organization.ID;

extend ProductServices with {
  stock                  : Association to StockLevels
                             on stock.product_ID = ID;
  stockMovements         : Association to many StockMovements
                             on stockMovements.product = $self;
  isStockTracked         : Boolean = (case when type.code = 'GOODS' and trackStock = true then true else false end);
  stockOnHand            : Quantity = coalesce(stock.quantity, 0);
  // Low stock: at or below the reorder level.
  stockStatus            : String(10) = (case
                                           when coalesce(stock.quantity, 0) <= coalesce(reorderLevel, 0)
                                           then 'Low'
                                           else 'OK'
                                         end);
  stockStatusCriticality : Integer = (case
                                        when coalesce(stock.quantity, 0) <= coalesce(reorderLevel, 0)
                                        then 2
                                        else 3
                                      end);
}
