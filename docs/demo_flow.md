# Milestone 1 demo flow

1. Start the API and web app using the commands in the repository README.
2. Open `GET /api/business` to establish Maya's Catering Co. as the demo business.
3. Open `GET /api/financial-state` and call out the calculated baseline:
   current cash `$43,200`, inflows `$19,400`, outflows `$51,700`, shortfall `$4,800`, and
   runway `18 days`.
4. Open `GET /api/signals` to show the five early warnings.
5. Open `GET /api/signals/signal-invoice-overdue`, then match its evidence's
   `source_document_id` to `GET /api/documents`. This demonstrates provenance.
6. Submit a deterministic scenario:

   ```json
   {
     "name": "Revenue pressure plus cost increase",
     "revenue_change_percent": -10,
     "expense_change_percent": 5,
     "cash_adjustment_cents": 500000
   }
   ```

   `POST /api/scenarios` returns baseline and projected snapshots plus explicit assumptions.
   Repeating the request produces the same scenario ID and calculated values.
7. Show `GET /api/recommendations`; recommendations link back to signal IDs and do not invent
   new financial totals.
8. Call `POST /api/demo/reset` to restore the initial fixture before the next demo.

The API's interactive OpenAPI UI is available at `http://localhost:8000/docs`.

