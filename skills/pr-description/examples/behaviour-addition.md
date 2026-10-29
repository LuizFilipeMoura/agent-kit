Staff can now put an order on hold from the order page. A held order keeps its fulfilment but sends nothing to the carrier until it is released, so a customer's change of address no longer races the label printer.

**Does not:** cancel the order, refund it, or hold a parcel the carrier already accepted (the button is disabled then, with the reason).

**Look first:** [`order-hold.service.ts`](https://github.com/acme/shop/blob/def5678/src/orders/order-hold.service.ts), proven by `order-hold.spec.ts`: the check that skips held orders in the label queue.

**Risk:** a hold that is never released leaves the order unshipped. The daily stale-orders report now lists holds older than 2 days.

**Not verified by anyone:** the button in Safari.
