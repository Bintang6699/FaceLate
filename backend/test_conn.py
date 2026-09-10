import os
from sqlalchemy import create_engine

urls_to_test = [
    # Original port 5432
    "postgresql://postgres.fhqatkqvytaccylkfedu:SMP01DOMPU69@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
    # Pooler port 6543
    "postgresql://postgres.fhqatkqvytaccylkfedu:SMP01DOMPU69@aws-1-ap-south-1.pooler.supabase.com:6543/postgres",
    # Direct with just postgres
    "postgresql://postgres:SMP01DOMPU69@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
    "postgresql://postgres:SMP01DOMPU69@aws-1-ap-south-1.pooler.supabase.com:6543/postgres"
]

for url in urls_to_test:
    print("Testing:", url)
    try:
        engine = create_engine(url, connect_args={"connect_timeout": 5})
        conn = engine.connect()
        print("SUCCESS!")
        conn.close()
    except Exception as e:
        print("FAIL:", e)
    print("-" * 20)
