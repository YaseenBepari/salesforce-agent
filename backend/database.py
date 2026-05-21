import os
import sqlite3
from datetime import datetime
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "copilot.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Audit Logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id TEXT NOT NULL,
            username TEXT NOT NULL,
            action_type TEXT NOT NULL,
            description TEXT NOT NULL,
            target_object TEXT,
            status TEXT NOT NULL,
            approved_by TEXT,
            created_at TEXT NOT NULL
        )
    """)
    
    # Create Conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    
    conn.commit()
    conn.close()

def log_audit_event(org_id: str, username: str, action_type: str, description: str, target_object: str = None, status: str = "PENDING", approved_by: str = None) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO audit_logs (org_id, username, action_type, description, target_object, status, approved_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (org_id, username, action_type, description, target_object, status, approved_by, created_at))
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    return log_id

def update_audit_log_status(log_id: int, status: str, approved_by: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE audit_logs
        SET status = ?, approved_by = ?
        WHERE id = ?
    """, (status, approved_by, log_id))
    conn.commit()
    conn.close()

def get_audit_logs(org_id: str = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if org_id:
        cursor.execute("SELECT * FROM audit_logs WHERE org_id = ? ORDER BY id DESC LIMIT 100", (org_id,))
    else:
        cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100")
    
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_chat_message(org_id: str, session_id: str, role: str, content: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.utcnow().isoformat()
    cursor.execute("""
        INSERT INTO conversations (org_id, session_id, role, content, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, (org_id, session_id, role, content, created_at))
    conn.commit()
    conn.close()

def get_chat_history(org_id: str, session_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT role, content, created_at 
        FROM conversations 
        WHERE org_id = ? AND session_id = ? 
        ORDER BY id ASC
    """, (org_id, session_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Initialize on import to make sure db and tables are set up
init_db()
