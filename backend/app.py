"""
Personal Finance Data Analysis API
Flask + TinyDB backend for managing and analyzing personal transactions.
"""

import os
import json
from datetime import datetime
from collections import defaultdict

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from tinydb import TinyDB, Query, where

# ---------------------------------------------------------------------------
# App & DB setup
# ---------------------------------------------------------------------------

app = Flask(__name__)
CORS(app)

DB_PATH = os.environ.get("TINYDB_PATH", "/app/data/db.json")
db = TinyDB(DB_PATH)
transactions = db.table("transactions")
Transaction = Query()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _serialize(doc):
    """Convert a TinyDB document to a plain dict with its doc_id exposed."""
    data = dict(doc)
    data["id"] = doc.doc_id
    return data


def _parse_date(date_str):
    """Parse a YYYY-MM-DD string into a date object."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def _validate_transaction(data):
    """Return (cleaned_data, error_message). error_message is None on success."""
    required = ["date", "amount", "category", "type"]
    for field in required:
        if field not in data:
            return None, f"Missing required field: {field}"

    if data["type"] not in ("income", "expense"):
        return None, "type must be 'income' or 'expense'"

    try:
        _parse_date(data["date"])
    except (ValueError, TypeError):
        return None, "date must be in YYYY-MM-DD format"

    try:
        amount = float(data["amount"])
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return None, "amount must be a positive number"

    return {
        "date": data["date"],
        "amount": amount,
        "category": data["category"].strip(),
        "type": data["type"],
        "description": data.get("description", "").strip(),
        "created_at": datetime.utcnow().isoformat(),
    }, None

# ---------------------------------------------------------------------------
# CRUD Routes
# ---------------------------------------------------------------------------

@app.route("/api/transactions", methods=["GET"])
def list_transactions():
    """List transactions with optional filters: category, type, from, to."""
    results = transactions.all()

    # Optional filters
    category = request.args.get("category")
    txn_type = request.args.get("type")
    date_from = request.args.get("from")
    date_to = request.args.get("to")

    if category:
        results = [r for r in results if r.get("category", "").lower() == category.lower()]
    if txn_type:
        results = [r for r in results if r.get("type") == txn_type]
    if date_from:
        try:
            d = _parse_date(date_from)
            results = [r for r in results if _parse_date(r["date"]) >= d]
        except ValueError:
            pass
    if date_to:
        try:
            d = _parse_date(date_to)
            results = [r for r in results if _parse_date(r["date"]) <= d]
        except ValueError:
            pass

    # Sort newest first
    results.sort(key=lambda r: r.get("date", ""), reverse=True)

    return jsonify([_serialize(r) for r in results])


@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    """Add a single transaction."""
    data = request.get_json(force=True)
    clean, err = _validate_transaction(data)
    if err:
        return jsonify({"error": err}), 400

    doc_id = transactions.insert(clean)
    clean["id"] = doc_id
    return jsonify(clean), 201


@app.route("/api/transactions/<int:doc_id>", methods=["DELETE"])
def delete_transaction(doc_id):
    """Delete a transaction by its document ID."""
    if not transactions.contains(doc_id=doc_id):
        return jsonify({"error": "Transaction not found"}), 404
    transactions.remove(doc_ids=[doc_id])
    return jsonify({"deleted": doc_id})

# ---------------------------------------------------------------------------
# Analytics Routes
# ---------------------------------------------------------------------------

@app.route("/api/analytics/summary", methods=["GET"])
def analytics_summary():
    """Total income, total expenses, net savings, transaction count."""
    all_txns = transactions.all()

    # Apply optional date filters
    date_from = request.args.get("from")
    date_to = request.args.get("to")
    if date_from:
        try:
            d = _parse_date(date_from)
            all_txns = [t for t in all_txns if _parse_date(t["date"]) >= d]
        except ValueError:
            pass
    if date_to:
        try:
            d = _parse_date(date_to)
            all_txns = [t for t in all_txns if _parse_date(t["date"]) <= d]
        except ValueError:
            pass

    total_income = sum(t["amount"] for t in all_txns if t["type"] == "income")
    total_expense = sum(t["amount"] for t in all_txns if t["type"] == "expense")

    return jsonify({
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_savings": round(total_income - total_expense, 2),
        "transaction_count": len(all_txns),
    })


@app.route("/api/analytics/by-category", methods=["GET"])
def analytics_by_category():
    """Group spending/income by category."""
    all_txns = transactions.all()

    date_from = request.args.get("from")
    date_to = request.args.get("to")
    if date_from:
        try:
            d = _parse_date(date_from)
            all_txns = [t for t in all_txns if _parse_date(t["date"]) >= d]
        except ValueError:
            pass
    if date_to:
        try:
            d = _parse_date(date_to)
            all_txns = [t for t in all_txns if _parse_date(t["date"]) <= d]
        except ValueError:
            pass

    income_by_cat = defaultdict(float)
    expense_by_cat = defaultdict(float)

    for t in all_txns:
        if t["type"] == "income":
            income_by_cat[t["category"]] += t["amount"]
        else:
            expense_by_cat[t["category"]] += t["amount"]

    return jsonify({
        "income": {k: round(v, 2) for k, v in sorted(income_by_cat.items())},
        "expense": {k: round(v, 2) for k, v in sorted(expense_by_cat.items())},
    })


@app.route("/api/analytics/monthly-trend", methods=["GET"])
def analytics_monthly_trend():
    """Monthly income vs expense trend (last 12 months by default)."""
    all_txns = transactions.all()

    monthly = defaultdict(lambda: {"income": 0.0, "expense": 0.0})

    for t in all_txns:
        month_key = t["date"][:7]  # YYYY-MM
        monthly[month_key][t["type"]] += t["amount"]

    # Sort by month
    sorted_months = sorted(monthly.keys())

    return jsonify({
        "labels": sorted_months,
        "income": [round(monthly[m]["income"], 2) for m in sorted_months],
        "expense": [round(monthly[m]["expense"], 2) for m in sorted_months],
    })


@app.route("/api/analytics/top-expenses", methods=["GET"])
def analytics_top_expenses():
    """Top 5 expense categories by total amount."""
    all_txns = transactions.all()

    date_from = request.args.get("from")
    date_to = request.args.get("to")
    if date_from:
        try:
            d = _parse_date(date_from)
            all_txns = [t for t in all_txns if _parse_date(t["date"]) >= d]
        except ValueError:
            pass
    if date_to:
        try:
            d = _parse_date(date_to)
            all_txns = [t for t in all_txns if _parse_date(t["date"]) <= d]
        except ValueError:
            pass

    expense_by_cat = defaultdict(float)
    for t in all_txns:
        if t["type"] == "expense":
            expense_by_cat[t["category"]] += t["amount"]

    top = sorted(expense_by_cat.items(), key=lambda x: x[1], reverse=True)[:5]

    return jsonify({
        "labels": [t[0] for t in top],
        "amounts": [round(t[1], 2) for t in top],
    })

# ---------------------------------------------------------------------------
# Import / Export
# ---------------------------------------------------------------------------

@app.route("/api/import", methods=["POST"])
def import_transactions():
    """Bulk import transactions from a JSON array."""
    data = request.get_json(force=True)
    if not isinstance(data, list):
        return jsonify({"error": "Request body must be a JSON array"}), 400

    imported = 0
    errors = []
    for i, item in enumerate(data):
        clean, err = _validate_transaction(item)
        if err:
            errors.append({"index": i, "error": err})
        else:
            transactions.insert(clean)
            imported += 1

    return jsonify({"imported": imported, "errors": errors}), 201


@app.route("/api/export", methods=["GET"])
def export_transactions():
    """Export all transactions as a downloadable JSON file."""
    all_txns = [_serialize(t) for t in transactions.all()]
    response = Response(
        json.dumps(all_txns, indent=2),
        mimetype="application/json",
        headers={"Content-Disposition": "attachment; filename=transactions_export.json"},
    )
    return response

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "transactions": len(transactions)})

# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
