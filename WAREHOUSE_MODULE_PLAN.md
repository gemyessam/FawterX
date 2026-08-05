# FawterX Warehouse Module Plan

## Goal

Add a project-based warehouse module to FawterX that can read supplier invoices and outgoing sales/SD invoices, convert invoice lines into stock movements, and keep accurate item balances per project and per authorized user.

The module must stay separate from the ETA submission workflow. It should reuse the existing smart invoice parser, but every warehouse update must pass through a review/correction screen before being saved.

## Business Idea

The admin creates warehouse projects, for example:

- Canex Stock
- Schuco Project A
- Export Project B

Each project has:

- Authorized users
- Supplier invoices that add stock
- Outgoing invoices or SD documents that deduct stock
- Item master data learned automatically from uploaded invoices
- Stock balances by item, unit, color, length, weight, and other product attributes

Example flow:

1. User uploads a Canex purchase invoice.
2. System extracts invoice metadata and lines.
3. User reviews and corrects parsed items.
4. System saves the invoice and creates inbound stock movements.
5. Later user uploads an outgoing invoice or SD document.
6. System extracts lines, matches them to existing stock items, shows review screen.
7. User confirms.
8. System deducts quantities from stock and keeps traceability.

## Access Control

Only admin can:

- Enable warehouse module for a user.
- Create projects.
- Assign users to projects.
- Decide whether a user can view only, add stock, deduct stock, or manage project settings.

Suggested roles:

- `warehouse_disabled`: no access.
- `warehouse_viewer`: can view stock and reports only.
- `warehouse_operator`: can upload invoices and create movements.
- `warehouse_manager`: can edit items, fix balances, and approve corrections.
- `admin`: full access across all projects.

Admin email remains the master controller:

`gemy.essam.ge@gmail.com`

## Data Model

Use Firestore collections.

### users/{uid}

Existing user profile.

Add:

```json
{
  "warehouseEnabled": true,
  "warehouseRole": "warehouse_operator"
}
```

### warehouseProjects/{projectId}

```json
{
  "name": "Canex Stock",
  "status": "active",
  "createdBy": "adminUid",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### warehouseProjects/{projectId}/members/{uid}

```json
{
  "uid": "userUid",
  "email": "user@example.com",
  "role": "warehouse_operator",
  "status": "active"
}
```

### warehouseProjects/{projectId}/invoices/{invoiceId}

This stores every uploaded warehouse document.

```json
{
  "invoiceNumber": "INV-123",
  "source": "Canex",
  "documentType": "purchase_invoice",
  "movementType": "inbound",
  "currency": "EUR",
  "totalAmount": 10000,
  "uploadedBy": "userUid",
  "fileName": "Canex invoice 001.pdf",
  "status": "reviewed",
  "createdAt": "timestamp",
  "reviewedAt": "timestamp"
}
```

Document types:

- `purchase_invoice`: adds stock.
- `sales_invoice`: deducts stock.
- `sd_document`: deducts/reserves stock depending on business rule.
- `adjustment`: manual correction.

Movement types:

- `inbound`
- `outbound`
- `reservation`
- `adjustment_in`
- `adjustment_out`

### warehouseProjects/{projectId}/items/{itemKey}

The item master record. The system should learn/update this automatically from reviewed invoice lines.

```json
{
  "itemKey": "CANEX-184060-RAL8019SD-6000",
  "itemCode": "184060",
  "internalCode": "184060",
  "description": "Glazing bead 22-27",
  "material": "Aluminium",
  "productType": "Glazing bead",
  "finish": "RAL8019SD",
  "lengthMm": 6000,
  "unit": "BAR",
  "secondaryUnit": "LM",
  "weightKg": 78.57,
  "aliases": [
    "Glzng bead 22-27",
    "Glazing bead 22-27"
  ],
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

Important: do not rely only on description text. Build `itemKey` from stable fields:

- supplier/source
- item code/internal code
- finish/color
- length
- product type when available

### warehouseProjects/{projectId}/movements/{movementId}

Every stock increase/decrease must be stored as an immutable movement.

```json
{
  "invoiceId": "invoiceDocId",
  "invoiceNumber": "INV-123",
  "movementType": "inbound",
  "itemKey": "CANEX-184060-RAL8019SD-6000",
  "quantity": 45,
  "unit": "BAR",
  "lmQuantity": 270,
  "kgQuantity": 78.57,
  "unitPrice": 37.5,
  "netTotal": 10125,
  "currency": "EUR",
  "createdBy": "userUid",
  "createdAt": "timestamp"
}
```

### warehouseProjects/{projectId}/stock/{itemKey}

Current balance snapshot for fast UI.

```json
{
  "itemKey": "CANEX-184060-RAL8019SD-6000",
  "quantityBar": 45,
  "quantityLm": 270,
  "quantityKg": 78.57,
  "lastUnitCost": 37.5,
  "averageCost": 37.5,
  "currency": "EUR",
  "updatedAt": "timestamp"
}
```

The source of truth should be movements. Stock snapshot is only a calculated cache.

## Parsing And Matching Rules

Reuse the existing Smart Invoice Intelligence Engine.

For every uploaded warehouse invoice:

1. Extract metadata.
2. Extract lines.
3. Understand product fields:
   - item code
   - internal code
   - product name
   - material
   - color/finish
   - length
   - BAR quantity
   - LM quantity
   - KG quantity
   - unit price
   - net total
4. Match each line to an existing warehouse item.
5. If confidence is high, auto-select the item.
6. If confidence is low, mark as "needs review".
7. User confirms before saving.

Matching priority:

1. Exact item code + length + finish.
2. Exact item code + length.
3. Item code + similar description.
4. Similar description + finish + length.
5. No match: create new item after user confirmation.

## Review Screen

Before saving any warehouse invoice, show a review table.

Columns:

- Match status
- Item code
- Description
- Product type
- Finish/color
- Length
- BAR quantity
- LM quantity
- KG quantity
- Unit price
- Net total
- Matched warehouse item
- Action

Actions:

- Accept line.
- Edit parsed fields.
- Link to existing item.
- Create new item.
- Ignore line.
- Mark as service/non-stock item.

Important: packing, freight, tax, discount, bank info, footer, and address text must not become stock items.

## Stock Deduction Rules

For outgoing invoice or SD:

1. Parse document.
2. Match lines to warehouse items.
3. Show available balance for each item.
4. If enough stock, allow confirmation.
5. If stock is insufficient, show warning:
   - available
   - requested
   - shortage
6. Admin/manager can allow negative stock only if enabled for that project.

Suggested default: block negative stock.

## Costing

Start simple:

- Store last unit cost.
- Store weighted average cost.
- Keep original invoice cost per inbound movement.

Later option:

- FIFO cost layers.

Recommended first version:

- Weighted average is enough and much easier to maintain.

## UI Pages

### Admin Panel

Add Warehouse section:

- Enable/disable warehouse access per user.
- Create/edit projects.
- Assign users to projects.
- Set role per user per project.

### Warehouse Dashboard

For authorized users:

- Project selector.
- Total stock value.
- Number of SKUs/items.
- Low stock items.
- Recent movements.

### Upload Warehouse Invoice

Steps:

1. Choose project.
2. Choose document type:
   - purchase invoice/add stock
   - sales invoice/deduct stock
   - SD/deduct or reserve
3. Upload file.
4. Review parsed lines.
5. Confirm save.

### Stock Items

Searchable table:

- item code
- description
- finish
- length
- BAR
- LM
- KG
- average cost
- last movement date

### Item Ledger

Click any item to see:

- all inbound movements
- all outbound movements
- invoice links
- balance after each movement

## Safety Requirements

Do not directly update stock from parser output.

Required flow:

`Upload -> Parse -> Review -> Confirm -> Save invoice -> Create movements -> Recalculate stock`

Every movement must be immutable. If a mistake happens, create an adjustment movement instead of editing old movement silently.

## Best Implementation Phases

### Phase 1: Core Warehouse

- Firestore schema.
- Admin project/member access.
- Warehouse dashboard page.
- Manual create/edit item.
- Upload purchase invoice.
- Review lines.
- Save inbound movements.
- Stock balance table.

### Phase 2: Deduction

- Upload sales invoice/SD.
- Match outgoing lines to stock items.
- Show available stock.
- Deduct stock after confirmation.
- Block negative stock by default.

### Phase 3: Learning And Automation

- Auto item matching by item code, finish, length, description.
- Save aliases.
- Remember corrections.
- If user maps a line once, next time system should recognize it.

### Phase 4: Reports

- Stock valuation.
- Movement report.
- Project consumption report.
- Supplier invoice history.
- Export Excel/PDF.

## Important Opinion

This module should not be mixed inside the ETA invoice submission flow. It should be a separate Warehouse area that reuses the parser.

Reason:

- ETA invoices are tax/legal documents.
- Warehouse movements are operational/accounting records.
- Mixing them too tightly will make errors dangerous and hard to debug.

The best design is:

- Same parser engine.
- Separate warehouse review.
- Separate warehouse Firestore collections.
- Clear admin-controlled permissions.

## MVP Recommendation

Build the first version for one project type only, for example Canex Stock, but design the data model as generic project-based from day one.

The MVP should support:

1. Admin creates project.
2. Admin assigns users.
3. User uploads supplier invoice.
4. System parses lines.
5. User reviews/corrects.
6. System saves items and inbound movements.
7. User sees stock balance.
8. User uploads outgoing invoice.
9. System deducts from stock after review.

Do not start with advanced costing or complex reservations. Add them after the stock movement cycle is stable.
