Four fixes from the checkout support queue.

| Symptom before | Behaviour after | Where |
|---|---|---|
| A discount code with a trailing space was refused | codes are trimmed before lookup | `discount-code.ts` |
| Paying twice quickly charged the card twice | the second submit is refused while the first is pending | `checkout-submit.service.ts` |
| The receipt showed the total before tax | it shows the total the card was charged | `receipt.template.ts` |
| "Postcode" was misspelled on the address form | spelled correctly | `address-form.tsx` |

Only the double charge carries real behaviour (look at the pending check, proven by `checkout-submit.spec.ts`); the rest are trivial.
