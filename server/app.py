from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Enum, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from datetime import datetime, date
import enum
import io
import os
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import hashlib
import hmac
import secrets
import jwt

# --- Config ---
DB_URL = os.environ.get("DB_URL", "sqlite:///finance.db")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
PORT = int(os.environ.get("PORT", "5000"))

app = Flask(__name__)
CORS(app)
engine = create_engine(DB_URL, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

class TxType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False)
    category = Column(String(100), nullable=False)
    type = Column(Enum(TxType), nullable=False)
    amount = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    transactions = relationship("Transaction", backref="user")

Base.metadata.create_all(engine)

# Helpers

def to_dict(tx: Transaction):
    return {
        "id": tx.id,
        "date": tx.date.isoformat(),
        "category": tx.category,
        "type": tx.type.value,
        "amount": tx.amount,
        "notes": tx.notes or "",
        "user_id": tx.user_id,
    }

# --- Auth helpers ---
def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()

def generate_token(user_id: int) -> str:
    payload = {"sub": user_id, "iat": int(datetime.utcnow().timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

def require_user():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return int(payload.get("sub"))
    except Exception:
        return None

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/transactions")
def list_transactions():
    user_id = require_user()
    if not user_id:
        return {"error": "Unauthorized"}, 401
    session = SessionLocal()
    try:
        q = session.query(Transaction).filter(Transaction.user_id == user_id)
        # optional filters
        start = request.args.get("from")
        end = request.args.get("to")
        tx_type = request.args.get("type")
        category = request.args.get("category")
        if start:
            q = q.filter(Transaction.date >= datetime.fromisoformat(start).date())
        if end:
            q = q.filter(Transaction.date <= datetime.fromisoformat(end).date())
        if tx_type in ("income", "expense"):
            q = q.filter(Transaction.type == TxType(tx_type))
        if category:
            q = q.filter(Transaction.category == category)
        q = q.order_by(Transaction.date.desc(), Transaction.id.desc())
        items = [to_dict(tx) for tx in q.all()]
        return jsonify(items)
    finally:
        session.close()

@app.post("/api/transactions")
def create_transaction():
    user_id = require_user()
    if not user_id:
        return {"error": "Unauthorized"}, 401
    data = request.get_json(force=True)
    required = ["date", "category", "type", "amount"]
    missing = [k for k in required if k not in data or data[k] in (None, "")]
    if missing:
        return {"error": f"Missing fields: {', '.join(missing)}"}, 400
    try:
        tx = Transaction(
            date=datetime.fromisoformat(data["date"]).date(),
            category=str(data["category"]).strip(),
            type=TxType(str(data["type"]).lower()),
            amount=float(data["amount"]),
            notes=str(data.get("notes") or "").strip() or None,
            user_id=user_id,
        )
    except Exception as e:
        return {"error": f"Invalid payload: {e}"}, 400
    session = SessionLocal()
    try:
        session.add(tx)
        session.commit()
        session.refresh(tx)
        return to_dict(tx), 201
    finally:
        session.close()

@app.put("/api/transactions/<int:tx_id>")
def update_transaction(tx_id: int):
    user_id = require_user()
    if not user_id:
        return {"error": "Unauthorized"}, 401
    data = request.get_json(force=True)
    session = SessionLocal()
    try:
        tx = session.get(Transaction, tx_id)
        if not tx:
            return {"error": "Not found"}, 404
        if tx.user_id != user_id:
            return {"error": "Forbidden"}, 403
        if "date" in data:
            tx.date = datetime.fromisoformat(data["date"]).date()
        if "category" in data:
            tx.category = str(data["category"]).strip()
        if "type" in data:
            tx.type = TxType(str(data["type"]).lower())
        if "amount" in data:
            tx.amount = float(data["amount"])
        if "notes" in data:
            tx.notes = (str(data["notes"]).strip() or None)
        session.commit()
        return to_dict(tx)
    finally:
        session.close()

@app.delete("/api/transactions/<int:tx_id>")
def delete_transaction(tx_id: int):
    user_id = require_user()
    if not user_id:
        return {"error": "Unauthorized"}, 401
    session = SessionLocal()
    try:
        tx = session.get(Transaction, tx_id)
        if not tx:
            return {"error": "Not found"}, 404
        if tx.user_id != user_id:
            return {"error": "Forbidden"}, 403
        session.delete(tx)
        session.commit()
        return {"deleted": True}
    finally:
        session.close()

@app.get("/api/summary")
def summary():
    """Return totals grouped by month or year and by type."""
    period = request.args.get("period", "month")  # month|year
    session = SessionLocal()
    try:
        user_id = require_user()
        if not user_id:
            return {"income": {}, "expense": {}}, 401
        rows = session.query(Transaction).filter(Transaction.user_id == user_id).all()
        if not rows:
            return {"income": {}, "expense": {}}
        df = pd.DataFrame([
            {"date": r.date, "type": r.type.value, "amount": r.amount} for r in rows
        ])
        # Ensure datetime dtype for .dt accessors
        df["date"] = pd.to_datetime(df["date"])  
        if period == "year":
            grp = df.groupby([df["date"].dt.year, "type"])  # type: ignore
            idx_fmt = lambda y: f"{int(y)}"
        else:
            grp = df.groupby([df["date"].dt.to_period("M"), "type"])  # type: ignore
            idx_fmt = lambda p: p.strftime("%Y-%m")
        result = {"income": {}, "expense": {}}
        for (idx, t), val in grp["amount"].sum().items():
            result[t][idx_fmt(idx)] = float(round(val, 2))
        return result
    finally:
        session.close()

@app.get("/api/category-summary")
def category_summary():
    start = request.args.get("from")
    end = request.args.get("to")
    session = SessionLocal()
    try:
        user_id = require_user()
        if not user_id:
            return {}, 401
        q = session.query(Transaction).filter(Transaction.user_id == user_id)
        if start:
            q = q.filter(Transaction.date >= datetime.fromisoformat(start).date())
        if end:
            q = q.filter(Transaction.date <= datetime.fromisoformat(end).date())
        rows = q.all()
        if not rows:
            return {}
        df = pd.DataFrame([
            {"category": r.category, "type": r.type.value, "amount": r.amount}
            for r in rows
        ])
        grp = df.groupby(["category", "type"])  # sum by category and type
        out = {}
        for (cat, t), val in grp["amount"].sum().items():
            out.setdefault(cat, {})[t] = float(round(val, 2))
        return out
    finally:
        session.close()

@app.get("/api/chart/spending.png")
def spending_chart():
    start = request.args.get("from")
    end = request.args.get("to")
    session = SessionLocal()
    try:
        user_id = require_user()
        if not user_id:
            # return an empty chart image
            fig, ax = plt.subplots(figsize=(6, 3))
            ax.text(0.5, 0.5, "Unauthorized", ha="center", va="center")
            ax.axis('off')
            buf = io.BytesIO()
            fig.savefig(buf, format='png')
            plt.close(fig)
            buf.seek(0)
            return send_file(buf, mimetype='image/png')
        q = session.query(Transaction).filter(Transaction.user_id == user_id)
        if start:
            q = q.filter(Transaction.date >= datetime.fromisoformat(start).date())
        if end:
            q = q.filter(Transaction.date <= datetime.fromisoformat(end).date())
        rows = q.all()
        df = pd.DataFrame([
            {"date": r.date, "type": r.type.value, "amount": r.amount} for r in rows
        ])
        if df.empty:
            fig, ax = plt.subplots(figsize=(6, 3))
            ax.text(0.5, 0.5, "No data", ha="center", va="center")
            ax.axis('off')
        else:
            # Ensure datetime dtype for .dt accessors
            df["date"] = pd.to_datetime(df["date"])  
            df = df[df["type"] == "expense"]
            if df.empty:
                fig, ax = plt.subplots(figsize=(6, 3))
                ax.text(0.5, 0.5, "No expense data", ha="center", va="center")
                ax.axis('off')
            else:
                ts = df.groupby(df["date"].dt.to_period("M"))["amount"].sum()
                fig, ax = plt.subplots(figsize=(6, 3))
                ts.index = ts.index.to_timestamp()
                ax.plot(ts.index, ts.values, marker='o')
                ax.set_title("Monthly Spending")
                ax.set_xlabel("Month")
                ax.set_ylabel("Amount")
                ax.grid(True, alpha=0.3)
                fig.tight_layout()
        buf = io.BytesIO()
        fig.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        return send_file(buf, mimetype='image/png')
    finally:
        session.close()

# --- Auth endpoints ---
@app.post("/api/auth/signup")
def signup():
    data = request.get_json(force=True)
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email or not password:
        return {"error": "Email and password required"}, 400
    session = SessionLocal()
    try:
        if session.query(User).filter(User.email == email).first():
            return {"error": "Email already registered"}, 409
        salt = secrets.token_hex(16)
        password_hash = hash_password(password, salt)
        user = User(email=email, password_hash=password_hash, salt=salt)
        session.add(user)
        session.commit()
        session.refresh(user)
        token = generate_token(user.id)
        return {"token": token, "user": {"id": user.id, "email": user.email}}
    finally:
        session.close()

@app.post("/api/auth/login")
def login():
    data = request.get_json(force=True)
    email = str(data.get("email") or "").strip().lower()
    password = str(data.get("password") or "")
    if not email or not password:
        return {"error": "Email and password required"}, 400
    session = SessionLocal()
    try:
        user = session.query(User).filter(User.email == email).first()
        if not user:
            return {"error": "Invalid credentials"}, 401
        if hash_password(password, user.salt) != user.password_hash:
            return {"error": "Invalid credentials"}, 401
        token = generate_token(user.id)
        return {"token": token, "user": {"id": user.id, "email": user.email}}
    finally:
        session.close()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=True)
