import psycopg2
urls = [
    "postgresql://postgres:SMP01DOMPU69@db.fhqatkqvytaccylkfedu.supabase.co:5432/postgres",
    "postgresql://postgres.fhqatkqvytaccylkfedu:SMP01DOMPU69@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" # Trying ap-southeast-1 just in case
]
for url in urls:
    print("Testing:", url)
    try:
        conn = psycopg2.connect(url, connect_timeout=3)
        print("SUCCESS!")
        conn.close()
    except Exception as e:
        print("FAIL:", e)
    print("-" * 20)
