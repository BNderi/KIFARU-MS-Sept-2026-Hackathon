# Kifaru Backend Prototype

Small dependency-free Node.js API for validating bank-submitted fraud reports.

## Run

```bash
npm start
```

Default URL: `http://127.0.0.1:3000`

## Test

```bash
npm test
```

## Main endpoints

- `GET /health`
- `GET /banks`
- `GET /risk-codes`
- `GET /validations`
- `POST /validate`
- `POST /validate-csv`
- `GET /banks/:bank/reports`
- `GET /banks/:bank/alerts`
- `GET /banks/:bank/submissions`
- `GET /banks/:bank/summary`

## Example validation request

```bash
curl -X POST http://127.0.0.1:3000/validate \
  -H 'Content-Type: application/json' \
  -d '{
    "reporting_bank": "NCBA",
    "receiving_bank": "KCB",
    "transaction_id": "TX-90831",
    "customer_ref": "*A5f6",
    "amount": "KES 1240000",
    "currency": "KES",
    "device_status": "new_device",
    "password_reset_within_1h": true,
    "ip_country_changed": true,
    "transfers_5m": 6,
    "beneficiary_age_minutes": 8,
    "prior_fraud_link": true,
    "bank_flag_source": "AG Screener"
  }'
```

## Example CSV upload

```bash
curl -X POST http://127.0.0.1:3000/validate-csv \
  -H 'Content-Type: text/csv' \
  --data-binary @logs.csv
```

Expected CSV headers can include:

`reporting_bank,receiving_bank,transaction_id,customer_ref,amount,currency,device_status,password_reset_within_1h,ip_country_changed,transfers_5m,beneficiary_age_minutes,prior_fraud_link,bank_flag_source`
