import sys
import bcrypt

def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        print("Exception:", e)
        return False

hashed = get_password_hash("admin123")
print("Hash:", hashed)
print("Verify:", verify_password("admin123", hashed))
print("Verify wrong:", verify_password("admin12", hashed))
